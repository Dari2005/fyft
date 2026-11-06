-- Fyft migration: following (people + organizers), push tokens, notification
-- preferences and server-side push for new events.
-- Run once in the Supabase SQL editor. Idempotent: safe to run again.
--
-- One table, `follows`, powers BOTH features:
--   * "follow an organizer" -> get a push when they publish an event
--   * "friends"             -> the people you follow; their "going" RSVPs show
--                              up on cards / event pages as "friends going"

-- ---------------------------------------------------------------------------
-- follows: follower_id follows followee_id (any profile, organizer or friend)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

-- New tables need explicit grants or the API denies access (see the ratings
-- migration for the same note).
grant select on public.follows to anon;
grant select, insert, delete on public.follows to authenticated;

drop policy if exists "follows: public read" on public.follows;
create policy "follows: public read"
  on public.follows for select using (true);

drop policy if exists "follows: insert own" on public.follows;
create policy "follows: insert own"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "follows: delete own" on public.follows;
create policy "follows: delete own"
  on public.follows for delete using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- push_tokens: Expo push tokens, one row per device token. Private to owner.
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
grant select, insert, update, delete on public.push_tokens to authenticated;

drop policy if exists "push_tokens: own" on public.push_tokens;
create policy "push_tokens: own"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- notification_prefs: kept OUT of `profiles` on purpose — profiles are
-- publicly readable and this holds the user's home location.
-- No row = defaults (follow-pushes on, nearby off).
-- ---------------------------------------------------------------------------
create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  following_enabled boolean not null default true,
  nearby_enabled boolean not null default false,
  nearby_lat double precision,
  nearby_lng double precision,
  nearby_radius_km int not null default 5 check (nearby_radius_km between 1 and 50),
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;
grant select, insert, update, delete on public.notification_prefs to authenticated;

drop policy if exists "notification_prefs: own" on public.notification_prefs;
create policy "notification_prefs: own"
  on public.notification_prefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Server-side push for NEW events.
-- AFTER INSERT on parties -> find recipients -> POST to the Expo push API
-- through pg_net (async, so the insert never waits on the network).
--
--   recipients = followers of the organizer (following_enabled, default on)
--                UNION users with nearby_enabled whose saved home is within
--                their radius of the event pin
--                minus the organizer.
-- A person who qualifies both ways gets ONE push (the "from someone you
-- follow" wording wins). Any failure here is swallowed with a WARNING so
-- publishing an event can never break because of notifications.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.notify_new_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_name text;
  batch record;
begin
  select coalesce(username, 'someone') into organizer_name
  from public.profiles where id = new.organizer_id;

  for batch in
    with recipients as (
      -- followers of the organizer
      select f.follower_id as user_id, true as from_follow
      from public.follows f
      left join public.notification_prefs np on np.user_id = f.follower_id
      where f.followee_id = new.organizer_id
        and coalesce(np.following_enabled, true)
      union all
      -- people who want events near their saved location
      select np.user_id, false as from_follow
      from public.notification_prefs np
      where new.latitude is not null
        and new.longitude is not null
        and np.nearby_enabled
        and np.nearby_lat is not null
        and np.nearby_lng is not null
        and 6371 * 2 * asin(sqrt(
              power(sin(radians(new.latitude - np.nearby_lat) / 2), 2) +
              cos(radians(np.nearby_lat)) * cos(radians(new.latitude)) *
              power(sin(radians(new.longitude - np.nearby_lng) / 2), 2)
            )) <= np.nearby_radius_km
    ),
    one_per_user as (
      select user_id, bool_or(from_follow) as from_follow
      from recipients
      where user_id <> new.organizer_id
      group by user_id
    ),
    msgs as (
      select
        jsonb_build_object(
          'to', t.token,
          'sound', 'default',
          'channelId', 'default',
          'title', case when r.from_follow
                        then '@' || organizer_name || ' posted a new event'
                        else 'New event near you' end,
          'body', new.title,
          'data', jsonb_build_object('partyId', new.id)
        ) as m,
        (row_number() over (order by t.token) - 1) / 100 as grp
      from one_per_user r
      join public.push_tokens t on t.user_id = r.user_id
    )
    -- Expo accepts up to 100 messages per request.
    select jsonb_agg(m) as payload from msgs group by grp
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := batch.payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      )
    );
  end loop;

  return new;
exception when others then
  raise warning 'notify_new_party failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists party_notify_followers on public.parties;
create trigger party_notify_followers
  after insert on public.parties
  for each row execute function public.notify_new_party();
