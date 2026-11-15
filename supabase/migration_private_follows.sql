-- Migration: private follows, numbers-only follower count
-- (run once in the Supabase SQL editor; safe to run again).
--
-- Before: `follows` had "public read", so anyone with the anon key could list
-- who follows which organizer.
-- Now: each signed-in user reads only the follows they made (the Follow
-- buttons and the "Only organizers I follow" filter need exactly that).
-- Organizers see a NUMBER of followers, never names, through
-- `follower_count()`. The push trigger `notify_new_party` is security
-- definer and still sees every follower.
--
-- Update the app BEFORE running this: older app code counts followers by
-- reading `follows` and would show 0 afterwards.

-- Numbers only: how many people follow this profile.
create or replace function public.follower_count(profile_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.follows where followee_id = profile_id;
$$;

revoke execute on function public.follower_count(uuid) from public;
grant execute on function public.follower_count(uuid) to anon, authenticated;

-- follows: own rows only.
drop policy if exists "follows: public read" on public.follows;
drop policy if exists "follows: read own" on public.follows;
create policy "follows: read own"
  on public.follows for select to authenticated
  using (auth.uid() = follower_id);

revoke all on public.follows from anon;
-- "follows: insert own" / "follows: delete own" are unchanged.

-- Realtime: never publish follows (DELETE events skip RLS).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follows'
  ) then
    alter publication supabase_realtime drop table public.follows;
  end if;
end;
$$;

notify pgrst, 'reload schema';
