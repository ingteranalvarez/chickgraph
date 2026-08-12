revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  username,
  country_code,
  rating,
  wins,
  losses,
  games_played
) on public.profiles to anon, authenticated;
