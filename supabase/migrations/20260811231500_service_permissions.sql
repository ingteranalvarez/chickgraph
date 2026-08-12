grant select, insert, update, delete on
  public.profiles,
  public.matches,
  public.match_players,
  public.matchmaking_queue,
  public.shots,
  public.messages
to service_role;

grant usage, select on all sequences in schema public to service_role;
