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

revoke all on function public.generate_invite_code() from public, anon, authenticated;
