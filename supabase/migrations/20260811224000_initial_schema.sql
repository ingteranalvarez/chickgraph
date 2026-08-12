create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,18}$'),
  username_key text generated always as (lower(username)) stored,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  is_16_plus boolean not null check (is_16_plus),
  rating integer not null default 1000 check (rating >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  created_at timestamptz not null default now(),
  constraint profiles_username_key_unique unique (username_key)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('public', 'private')),
  status text not null default 'waiting'
    check (status in ('waiting', 'starting', 'active', 'finished', 'abandoned')),
  invite_code text unique check (invite_code is null or invite_code ~ '^[A-Z2-9]{6}$'),
  created_by uuid not null references public.profiles (id),
  seed integer not null check (seed >= 0),
  version integer not null default 0 check (version >= 0),
  state jsonb,
  last_shot jsonb,
  winner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (match_id, user_id),
  unique (match_id, seat)
);

create table public.matchmaking_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table public.shots (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  turn_number integer not null check (turn_number >= 0),
  user_id uuid not null references public.profiles (id),
  expression text not null check (char_length(expression) between 1 and 120),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (match_id, turn_number)
);

create table public.messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);

create index match_players_user_id_idx on public.match_players (user_id, joined_at desc);
create index matches_status_updated_idx on public.matches (status, updated_at desc);
create index matchmaking_queue_joined_idx on public.matchmaking_queue (joined_at);
create index messages_match_created_idx on public.messages (match_id, created_at desc);
create index profiles_leaderboard_idx on public.profiles (rating desc, wins desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'Username cannot be changed.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_identity
before update on public.profiles
for each row execute function public.protect_profile_identity();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := new.raw_user_meta_data ->> 'username';
  requested_country text := upper(new.raw_user_meta_data ->> 'country_code');
  requested_age boolean := coalesce((new.raw_user_meta_data ->> 'is_16_plus')::boolean, false);
begin
  if requested_username is not null then
    insert into public.profiles (id, username, country_code, is_16_plus)
    values (new.id, requested_username, requested_country, requested_age);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_match_player(target_match_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_players
    where match_id = target_match_id and user_id = target_user_id
  );
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generated text := '';
begin
  for index in 1..6 loop
    generated := generated || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return generated;
end;
$$;

create or replace function public.current_open_match(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  where mp.user_id = target_user_id
    and m.status in ('waiting', 'starting', 'active')
  order by m.created_at desc
  limit 1;
$$;

create or replace function public.join_public_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  opponent_id uuid;
  existing_match_id uuid;
  new_match_id uuid;
  match_seed integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = caller_id) then
    raise exception 'Complete your profile before matchmaking.' using errcode = 'check_violation';
  end if;

  existing_match_id := public.current_open_match(caller_id);
  if existing_match_id is not null then
    delete from public.matchmaking_queue where user_id = caller_id;
    return jsonb_build_object('status', 'matched', 'matchId', existing_match_id);
  end if;

  delete from public.matchmaking_queue where joined_at < now() - interval '15 minutes';

  select q.user_id
  into opponent_id
  from public.matchmaking_queue q
  where q.user_id <> caller_id
    and public.current_open_match(q.user_id) is null
  order by q.joined_at
  for update of q skip locked
  limit 1;

  if opponent_id is null then
    insert into public.matchmaking_queue (user_id, joined_at)
    values (caller_id, now())
    on conflict (user_id) do update set joined_at = excluded.joined_at;
    return jsonb_build_object('status', 'waiting', 'matchId', null);
  end if;

  match_seed := floor(random() * 2147483647)::integer;
  insert into public.matches (kind, status, created_by, seed)
  values ('public', 'starting', opponent_id, match_seed)
  returning id into new_match_id;

  insert into public.match_players (match_id, user_id, seat)
  values (new_match_id, opponent_id, 0), (new_match_id, caller_id, 1);

  delete from public.matchmaking_queue where user_id in (caller_id, opponent_id);
  return jsonb_build_object('status', 'matched', 'matchId', new_match_id);
end;
$$;

create or replace function public.leave_public_queue()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.matchmaking_queue where user_id = auth.uid();
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function public.create_private_match()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  existing_match_id uuid;
  existing_code text;
  new_match_id uuid;
  new_code text;
  attempts integer := 0;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = caller_id) then
    raise exception 'Complete your profile before creating a room.' using errcode = 'check_violation';
  end if;

  select m.id, m.invite_code
  into existing_match_id, existing_code
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  where mp.user_id = caller_id and m.kind = 'private' and m.status = 'waiting'
  order by m.created_at desc
  limit 1;

  if existing_match_id is not null then
    return jsonb_build_object('status', 'waiting', 'matchId', existing_match_id, 'inviteCode', existing_code);
  end if;

  delete from public.matchmaking_queue where user_id = caller_id;
  loop
    attempts := attempts + 1;
    new_code := public.generate_invite_code();
    exit when not exists (select 1 from public.matches where invite_code = new_code);
    if attempts >= 10 then
      raise exception 'Could not allocate an invite code.';
    end if;
  end loop;

  insert into public.matches (kind, status, invite_code, created_by, seed)
  values ('private', 'waiting', new_code, caller_id, floor(random() * 2147483647)::integer)
  returning id into new_match_id;

  insert into public.match_players (match_id, user_id, seat)
  values (new_match_id, caller_id, 0);

  return jsonb_build_object('status', 'waiting', 'matchId', new_match_id, 'inviteCode', new_code);
end;
$$;

create or replace function public.join_private_match(requested_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  selected_match public.matches%rowtype;
  player_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = caller_id) then
    raise exception 'Complete your profile before joining a room.' using errcode = 'check_violation';
  end if;

  select * into selected_match
  from public.matches
  where invite_code = upper(trim(requested_code)) and kind = 'private'
  for update;

  if selected_match.id is null then
    raise exception 'Room not found.' using errcode = 'no_data_found';
  end if;
  if public.is_match_player(selected_match.id, caller_id) then
    return jsonb_build_object('status', selected_match.status, 'matchId', selected_match.id);
  end if;
  if selected_match.status <> 'waiting' then
    raise exception 'This room is no longer open.' using errcode = 'check_violation';
  end if;

  select count(*) into player_count from public.match_players where match_id = selected_match.id;
  if player_count >= 2 then
    raise exception 'This room is full.' using errcode = 'check_violation';
  end if;

  delete from public.matchmaking_queue where user_id = caller_id;
  insert into public.match_players (match_id, user_id, seat)
  values (selected_match.id, caller_id, 1);
  update public.matches set status = 'starting' where id = selected_match.id;

  return jsonb_build_object('status', 'starting', 'matchId', selected_match.id);
end;
$$;

create or replace function public.initialize_match(match_id_to_initialize uuid, initial_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  initialized_match public.matches%rowtype;
begin
  if (initial_state ->> 'matchId')::uuid <> match_id_to_initialize
    or (initial_state ->> 'version')::integer <> 1 then
    raise exception 'Invalid initial match state.' using errcode = 'check_violation';
  end if;

  update public.matches
  set state = initial_state, status = 'active', version = 1, started_at = now()
  where id = match_id_to_initialize
    and status = 'starting'
    and state is null
  returning * into initialized_match;

  if initialized_match.id is null then
    select * into initialized_match from public.matches where id = match_id_to_initialize;
  end if;
  return to_jsonb(initialized_match);
end;
$$;

create or replace function public.commit_match_state(
  target_match_id uuid,
  expected_version integer,
  next_state jsonb,
  shot_result jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  committed_match public.matches%rowtype;
  previous_status text;
  new_status text := next_state ->> 'status';
  winner uuid := nullif(next_state ->> 'winnerId', '')::uuid;
  player_zero uuid;
  player_one uuid;
  rating_zero integer;
  rating_one integer;
  expected_zero numeric;
  expected_one numeric;
  score_zero numeric;
  score_one numeric;
begin
  if (next_state ->> 'matchId')::uuid <> target_match_id
    or (next_state ->> 'version')::integer <> expected_version + 1
    or new_status not in ('active', 'finished', 'abandoned') then
    raise exception 'Invalid committed match state.' using errcode = 'check_violation';
  end if;

  select status into previous_status from public.matches where id = target_match_id for update;
  update public.matches
  set state = next_state,
      last_shot = coalesce(shot_result, last_shot),
      status = new_status,
      version = expected_version + 1,
      winner_id = winner,
      finished_at = case when new_status = 'finished' then now() else finished_at end
  where id = target_match_id and version = expected_version
  returning * into committed_match;

  if committed_match.id is null then
    raise exception 'The match state is stale.' using errcode = 'serialization_failure';
  end if;

  if shot_result is not null then
    insert into public.shots (match_id, turn_number, user_id, expression, result)
    values (
      target_match_id,
      (shot_result ->> 'turnNumber')::integer,
      (shot_result ->> 'shooterId')::uuid,
      shot_result ->> 'expression',
      shot_result
    );
  end if;

  if new_status = 'finished' and previous_status <> 'finished' then
    select user_id into player_zero from public.match_players where match_id = target_match_id and seat = 0;
    select user_id into player_one from public.match_players where match_id = target_match_id and seat = 1;
    if player_zero is not null and player_one is not null then
      select rating into rating_zero from public.profiles where id = player_zero for update;
      select rating into rating_one from public.profiles where id = player_one for update;
      expected_zero := 1.0 / (1.0 + power(10.0, (rating_one - rating_zero) / 400.0));
      expected_one := 1.0 - expected_zero;
      score_zero := case when winner = player_zero then 1.0 else 0.0 end;
      score_one := 1.0 - score_zero;

      update public.profiles
      set rating = greatest(0, round(rating_zero + 32 * (score_zero - expected_zero))),
          wins = wins + case when score_zero = 1 then 1 else 0 end,
          losses = losses + case when score_zero = 0 then 1 else 0 end,
          games_played = games_played + 1
      where id = player_zero;
      update public.profiles
      set rating = greatest(0, round(rating_one + 32 * (score_one - expected_one))),
          wins = wins + case when score_one = 1 then 1 else 0 end,
          losses = losses + case when score_one = 0 then 1 else 0 end,
          games_played = games_played + 1
      where id = player_one;
    end if;
  end if;

  return to_jsonb(committed_match);
end;
$$;

create or replace function public.send_match_message(target_match_id uuid, message_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  inserted_message public.messages%rowtype;
  recent_count integer;
  cleaned_body text := trim(message_body);
begin
  if caller_id is null or not public.is_match_player(target_match_id, caller_id) then
    raise exception 'You are not part of this match.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(cleaned_body) < 1 or char_length(cleaned_body) > 240 then
    raise exception 'Messages must contain between 1 and 240 characters.' using errcode = 'check_violation';
  end if;
  select count(*) into recent_count
  from public.messages
  where user_id = caller_id and created_at > now() - interval '10 seconds';
  if recent_count >= 5 then
    raise exception 'You are sending messages too quickly.' using errcode = 'check_violation';
  end if;

  insert into public.messages (match_id, user_id, body)
  values (target_match_id, caller_id, cleaned_body)
  returning * into inserted_message;
  return to_jsonb(inserted_message);
end;
$$;

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.shots enable row level security;
alter table public.messages enable row level security;

create policy profiles_public_read on public.profiles for select using (true);
create policy profiles_own_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and is_16_plus);
create policy matches_participant_read on public.matches for select to authenticated
  using (public.is_match_player(id));
create policy match_players_participant_read on public.match_players for select to authenticated
  using (public.is_match_player(match_id));
create policy queue_own_read on public.matchmaking_queue for select to authenticated
  using (user_id = auth.uid());
create policy shots_participant_read on public.shots for select to authenticated
  using (public.is_match_player(match_id));
create policy messages_participant_read on public.messages for select to authenticated
  using (public.is_match_player(match_id));

grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles to anon, authenticated;
grant insert on public.profiles to authenticated;
grant select on public.matches, public.match_players, public.matchmaking_queue, public.shots, public.messages to authenticated;
grant usage, select on sequence public.messages_id_seq to authenticated;

revoke all on function public.join_public_queue() from public;
revoke all on function public.leave_public_queue() from public;
revoke all on function public.create_private_match() from public;
revoke all on function public.join_private_match(text) from public;
revoke all on function public.send_match_message(uuid, text) from public;
revoke all on function public.current_open_match(uuid) from public, anon, authenticated;
revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.is_match_player(uuid, uuid) from public, anon;
grant execute on function public.join_public_queue() to authenticated;
grant execute on function public.leave_public_queue() to authenticated;
grant execute on function public.create_private_match() to authenticated;
grant execute on function public.join_private_match(text) to authenticated;
grant execute on function public.send_match_message(uuid, text) to authenticated;
grant execute on function public.is_match_player(uuid, uuid) to authenticated, service_role;

revoke all on function public.initialize_match(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.commit_match_state(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.initialize_match(uuid, jsonb) to service_role;
grant execute on function public.commit_match_state(uuid, integer, jsonb, jsonb) to service_role;

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.messages;
