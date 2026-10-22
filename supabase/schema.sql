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
-- Auto-create a profile row when a user signs up
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
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
-- Row Level Security
-- --------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.rsvps enable row level security;
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

-- rsvps: public read; users manage only their own RSVP rows.
drop policy if exists "rsvps: public read" on public.rsvps;
create policy "rsvps: public read"
  on public.rsvps for select using (true);

drop policy if exists "rsvps: insert own" on public.rsvps;
create policy "rsvps: insert own"
  on public.rsvps for insert with check (auth.uid() = user_id);

drop policy if exists "rsvps: update own" on public.rsvps;
create policy "rsvps: update own"
  on public.rsvps for update using (auth.uid() = user_id);

drop policy if exists "rsvps: delete own" on public.rsvps;
create policy "rsvps: delete own"
  on public.rsvps for delete using (auth.uid() = user_id);

-- comments: public read; authenticated insert as self; edit/delete own only.
drop policy if exists "comments: public read" on public.comments;
create policy "comments: public read"
  on public.comments for select using (true);

drop policy if exists "comments: authenticated insert" on public.comments;
create policy "comments: authenticated insert"
  on public.comments for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "comments: author update" on public.comments;
create policy "comments: author update"
  on public.comments for update using (auth.uid() = user_id);

drop policy if exists "comments: author delete" on public.comments;
create policy "comments: author delete"
  on public.comments for delete using (auth.uid() = user_id);

-- reports: users can file reports and see only their own (moderation view
-- would go through the Supabase dashboard or a service-role backend).
drop policy if exists "reports: insert own" on public.reports;
create policy "reports: insert own"
  on public.reports for insert
  with check (auth.role() = 'authenticated' and auth.uid() = reporter_id);

drop policy if exists "reports: read own" on public.reports;
create policy "reports: read own"
  on public.reports for select using (auth.uid() = reporter_id);
