-- ============================================================================
-- Party App — Supabase schema (Phase 1 MVP)
-- Run this whole file in the Supabase Dashboard → SQL Editor after creating
-- your free project at https://supabase.com. It is idempotent: safe to run
-- more than once.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Tables
-- --------------------------------------------------------------------------

-- Public user profiles (1:1 with auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Published parties.
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text,
  venue_type text,
  media jsonb not null default '[]'::jsonb,
  party_type text,
  latitude double precision,
  longitude double precision,
  address text,
  host_name text check (host_name is null or char_length(host_name) between 1 and 60),
  starts_at timestamptz not null,
  capacity int check (capacity is null or capacity > 0),
  created_at timestamptz not null default now()
);
create index if not exists parties_starts_at_idx on public.parties (starts_at);
create index if not exists parties_organizer_idx on public.parties (organizer_id);

-- RSVPs: one row per (party, user).
create table if not exists public.rsvps (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
-- My plans, reminders and the "read own" policy filter on user_id.
create index if not exists rsvps_user_idx on public.rsvps (user_id);

-- Going counts, numbers only (no user ids). Kept up to date by the
-- sync_party_counts trigger on rsvps; read by everyone, written by no client.
-- A missing row means 0. Published to Realtime (see
-- migration_private_rsvps.sql) so the event page count updates live.
create table if not exists public.party_counts (
  party_id uuid primary key references public.parties (id) on delete cascade,
  going_count int not null default 0 check (going_count >= 0),
  updated_at timestamptz not null default now()
);

-- Comments on parties.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_party_idx on public.comments (party_id, created_at desc);

-- User reports of parties (spam / inappropriate). One per (party, reporter).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (party_id, reporter_id)
);

-- --------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up. A taken username (case-
-- insensitive) gets a number added — dari, dari2 … — so a sign-up never
-- fails on the unique constraint (see migration_unique_username.sql).
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    ),
    30
  );

  candidate := base;
  while exists (
    select 1 from public.profiles where lower(username) = lower(candidate)
  ) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  begin
    insert into public.profiles (id, username)
    values (new.id, candidate)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, base || '_' || left(replace(new.id::text, '-', ''), 6))
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- Anti-spam: max 3 published parties per user per day (server-side, DB trigger)
-- The app also does a client-side pre-check in app/create.tsx for nicer UX,
-- but this trigger is the real enforcement — it cannot be bypassed.
-- --------------------------------------------------------------------------
create or replace function public.enforce_party_creation_limit()
returns trigger
language plpgsql
as $$
declare
  todays_count int;
begin
  select count(*) into todays_count
  from public.parties
  where organizer_id = new.organizer_id
    and created_at >= date_trunc('day', now());

  if todays_count >= 3 then
    raise exception 'Daily party limit reached (3 per day). Try again tomorrow.';
  end if;

  return new;
end;
$$;

drop trigger if exists party_creation_limit on public.parties;
create trigger party_creation_limit
  before insert on public.parties
  for each row execute function public.enforce_party_creation_limit();

-- --------------------------------------------------------------------------
-- Going counts: +1 when an rsvp becomes "going", -1 when it stops being
-- "going" (see migration_private_rsvps.sql for the reasoning).
-- --------------------------------------------------------------------------
create or replace function public.sync_party_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_going boolean := tg_op in ('UPDATE', 'DELETE') and old.status = 'going';
  is_going boolean := tg_op in ('INSERT', 'UPDATE') and new.status = 'going';
  moved boolean := tg_op = 'UPDATE' and old.party_id <> new.party_id;
begin
  if was_going and (not is_going or moved) then
    update public.party_counts
       set going_count = greatest(going_count - 1, 0),
           updated_at = now()
     where party_id = old.party_id;
  end if;

  if is_going and (not was_going or moved) then
    insert into public.party_counts as pc (party_id, going_count)
    values (new.party_id, 1)
    on conflict (party_id) do update
      set going_count = pc.going_count + 1,
          updated_at = now();
  end if;

  return null;
end;
$$;

drop trigger if exists rsvps_sync_party_counts on public.rsvps;
create trigger rsvps_sync_party_counts
  after insert or delete or update of status, party_id on public.rsvps
  for each row execute function public.sync_party_counts();

-- Repair tool / backfill (SQL editor only): set every count to the real number.
create or replace function public.reconcile_party_counts()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.party_counts as pc (party_id, going_count, updated_at)
  select p.id, count(r.party_id) filter (where r.status = 'going'), now()
  from public.parties p
  left join public.rsvps r on r.party_id = p.id
  group by p.id
  on conflict (party_id) do update
    set going_count = excluded.going_count,
        updated_at = now()
    where pc.going_count is distinct from excluded.going_count;
$$;

revoke execute on function public.sync_party_counts() from public, anon, authenticated;
revoke execute on function public.reconcile_party_counts() from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.rsvps enable row level security;
alter table public.party_counts enable row level security;

-- party_counts: read-only for the API; no write policy exists.
revoke all on public.party_counts from anon, authenticated;
grant select on public.party_counts to anon, authenticated;

drop policy if exists "party_counts: public read" on public.party_counts;
create policy "party_counts: public read"
  on public.party_counts for select using (true);
alter table public.comments enable row level security;
alter table public.reports enable row level security;

-- profiles: everyone can read; users can create/update only their own row.
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read"
  on public.profiles for select using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update using (auth.uid() = id);

-- parties: public read; authenticated users insert as themselves; only the
-- organizer can update/delete.
drop policy if exists "parties: public read" on public.parties;
create policy "parties: public read"
  on public.parties for select using (true);

drop policy if exists "parties: authenticated insert" on public.parties;
create policy "parties: authenticated insert"
  on public.parties for insert
  with check (auth.role() = 'authenticated' and auth.uid() = organizer_id);

drop policy if exists "parties: organizer update" on public.parties;
create policy "parties: organizer update"
  on public.parties for update using (auth.uid() = organizer_id);

drop policy if exists "parties: organizer delete" on public.parties;
create policy "parties: organizer delete"
  on public.parties for delete using (auth.uid() = organizer_id);

-- rsvps: private. Users (organizers too) read and manage only their own
-- rows; nobody can list who goes where. Counts come from party_counts.
-- Never re-add a public read policy here.
drop policy if exists "rsvps: public read" on public.rsvps;
drop policy if exists "rsvps: read own" on public.rsvps;
create policy "rsvps: read own"
  on public.rsvps for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "rsvps: insert own" on public.rsvps;
create policy "rsvps: insert own"
  on public.rsvps for insert with check (auth.uid() = user_id);

drop policy if exists "rsvps: update own" on public.rsvps;
create policy "rsvps: update own"
  on public.rsvps for update using (auth.uid() = user_id);

drop policy if exists "rsvps: delete own" on public.rsvps;
create policy "rsvps: delete own"
  on public.rsvps for delete using (auth.uid() = user_id);

-- comments: unused leftover (the chat was removed). No API access at all —
-- no policies, no grants (see migration_close_leftovers.sql).
drop policy if exists "comments: public read" on public.comments;
drop policy if exists "comments: authenticated insert" on public.comments;
drop policy if exists "comments: author update" on public.comments;
drop policy if exists "comments: author delete" on public.comments;
revoke all on public.comments from anon, authenticated;

-- reports: users can file reports and see only their own (moderation view
-- would go through the Supabase dashboard or a service-role backend).
drop policy if exists "reports: insert own" on public.reports;
create policy "reports: insert own"
  on public.reports for insert
  with check (auth.role() = 'authenticated' and auth.uid() = reporter_id);

drop policy if exists "reports: read own" on public.reports;
create policy "reports: read own"
  on public.reports for select using (auth.uid() = reporter_id);
