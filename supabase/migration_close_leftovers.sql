-- Migration: close the unused `comments` and `party_ratings` tables
-- (run once in the Supabase SQL editor; safe to run again).
--
-- Both are leftovers: the per-event chat was removed (decision 9) and there
-- are no ratings at all (decision 1). They still had "public read", and both
-- rows carry a user_id, so anyone with the anon key could see who commented
-- on or rated which event. The app reads neither table.
-- Now: no API access at all (no grants, no policies) and not in Realtime.
-- The tables and their data stay; bringing a feature back means a new
-- migration with its own grants and policies.

-- comments ------------------------------------------------------------------
drop policy if exists "comments: public read" on public.comments;
drop policy if exists "comments: authenticated insert" on public.comments;
drop policy if exists "comments: author update" on public.comments;
drop policy if exists "comments: author delete" on public.comments;
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;

-- party_ratings -------------------------------------------------------------
do $$
begin
  if to_regclass('public.party_ratings') is not null then
    drop policy if exists "party_ratings: public read" on public.party_ratings;
    drop policy if exists "party_ratings: insert own" on public.party_ratings;
    drop policy if exists "party_ratings: update own" on public.party_ratings;
    drop policy if exists "party_ratings: delete own" on public.party_ratings;
    alter table public.party_ratings enable row level security;
    revoke all on public.party_ratings from anon, authenticated;
  end if;
end;
$$;

-- Realtime: DELETE events skip RLS, so a published table can still leak.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime drop table public.comments;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'party_ratings'
  ) then
    alter publication supabase_realtime drop table public.party_ratings;
  end if;
end;
$$;

notify pgrst, 'reload schema';
