create or replace function public.enforce_single_open_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where mp.user_id = new.user_id
      and mp.match_id <> new.match_id
      and m.status in ('waiting', 'starting', 'active')
  ) then
    raise exception 'A player can only have one open match.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger match_players_single_open_match
before insert or update of match_id, user_id on public.match_players
for each row execute function public.enforce_single_open_match();

revoke all on function public.enforce_single_open_match() from public, anon, authenticated;
