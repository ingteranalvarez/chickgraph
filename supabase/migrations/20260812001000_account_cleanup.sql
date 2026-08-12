alter table public.matches
  drop constraint matches_created_by_fkey,
  add constraint matches_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete cascade;

alter table public.matches
  drop constraint matches_winner_id_fkey,
  add constraint matches_winner_id_fkey
    foreign key (winner_id) references public.profiles (id) on delete set null;

alter table public.shots
  drop constraint shots_user_id_fkey,
  add constraint shots_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.messages
  drop constraint messages_user_id_fkey,
  add constraint messages_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
