-- Fyft migration: party ratings + comment media (photos/videos in chat).
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor) once.
-- Profile pictures need NO migration: profiles.avatar_url already exists.

-- ---------------------------------------------------------------------------
-- Party ratings: one rating (1-5 stars) per user per party, changeable.
-- ---------------------------------------------------------------------------
create table if not exists public.party_ratings (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
create index if not exists party_ratings_party_idx on public.party_ratings (party_id);

alter table public.party_ratings enable row level security;

-- No API access: ratings were dropped from the product (decision 1) and the
-- old "public read" exposed who rated what. Closed by
-- migration_close_leftovers.sql; kept closed here so a re-run can't reopen it.
revoke all on public.party_ratings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Comment media: a comment may carry ONE photo or video (same public
-- "party-media" storage bucket as party media). Text becomes optional
-- when media is attached, so the body check is relaxed from 1..1000
-- to 0..1000 characters.
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists media_url text,
  add column if not exists media_type text
    check (media_type in ('image', 'video'));

alter table public.comments
  drop constraint if exists comments_body_check;

alter table public.comments
  add constraint comments_body_check
  check (char_length(body) between 0 and 1000);
