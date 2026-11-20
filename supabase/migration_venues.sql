-- Migration: central venues (run once in the Supabase SQL editor; safe to
-- run again). Run AFTER migration_trust.sql and migration_smart_notifications.sql.
--
-- A venue (club, bar, kafana, concert place) is NOT an account: no login, no
-- feed. Venues are created and edited only in the Supabase dashboard / SQL
-- editor (no client write access). An event keeps two separate things:
--   parties.organizer_id = who listed it (an account)
--   parties.venue_id     = where it happens (a venue), optional
-- Users follow venues (venue_followers, private like follows) and get a push
-- when a followed venue gets a new event, no matter which account listed it.
--
-- Who may attach an event to a venue: only verified organizers for now
-- (profiles.is_verified), enforced in guard_party_write. Otherwise anyone
-- could list a fake party "at Stanica 26" and push it to its followers.
-- Later, venue owners can get the right through a venue_members table
-- (claim + approval); that check goes in the same place.
--
-- Add a venue:
--   insert into public.venues (name, address, latitude, longitude)
--   values ('Stanica 26', 'Bul. Partizanski Odredi 26, Skopje', 41.9965, 21.4165);
-- Link old events whose "Who is hosting?" text matches a venue name exactly
-- (case-insensitive); safe to run again after adding venues:
--   select public.link_events_to_venues();

-- --------------------------------------------------------------------------
-- venues
-- --------------------------------------------------------------------------
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  address text,
  latitude double precision,
  longitude double precision,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);
-- No duplicates: "Stanica 26" and "stanica 26 " are the same venue.
create unique index if not exists venues_name_unique on public.venues (lower(trim(name)));

alter table public.venues enable row level security;
revoke all on public.venues from anon, authenticated;
grant select on public.venues to anon, authenticated;

drop policy if exists "venues: public read" on public.venues;
create policy "venues: public read" on public.venues for select using (true);

-- --------------------------------------------------------------------------
-- parties.venue_id
-- --------------------------------------------------------------------------
alter table public.parties
  add column if not exists venue_id uuid references public.venues (id) on delete set null;
create index if not exists parties_venue_idx on public.parties (venue_id);

-- --------------------------------------------------------------------------
-- venue_followers: private, each user reads only their own rows.
-- --------------------------------------------------------------------------
create table if not exists public.venue_followers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);
create index if not exists venue_followers_venue_idx on public.venue_followers (venue_id);

alter table public.venue_followers enable row level security;
revoke all on public.venue_followers from anon, authenticated;
grant select, insert, delete on public.venue_followers to authenticated;

drop policy if exists "venue_followers: read own" on public.venue_followers;
create policy "venue_followers: read own"
  on public.venue_followers for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "venue_followers: insert own" on public.venue_followers;
create policy "venue_followers: insert own"
  on public.venue_followers for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "venue_followers: delete own" on public.venue_followers;
create policy "venue_followers: delete own"
  on public.venue_followers for delete to authenticated
  using (auth.uid() = user_id);

-- Numbers only: how many people follow a venue.
create or replace function public.venue_follower_count(target_venue uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.venue_followers where venue_id = target_venue;
$$;
revoke execute on function public.venue_follower_count(uuid) from public;
grant execute on function public.venue_follower_count(uuid) to anon, authenticated;

-- Never publish follower rows to Realtime (DELETE events skip RLS).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'venue_followers'
  ) then
    alter publication supabase_realtime drop table public.venue_followers;
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- Only verified organizers may attach an event to a venue.
-- Same function as migration_trust.sql plus the venue check (still
-- SECURITY INVOKER: current_user is the API role for app requests).
-- --------------------------------------------------------------------------
create or replace function public.guard_party_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.hidden_at := null;
      if not public.current_user_confirmed() then
        raise exception 'Confirm your email before posting events.'
          using errcode = 'P0001';
      end if;
    else
      new.hidden_at := old.hidden_at;
    end if;

    if new.venue_id is not null
       and (tg_op = 'INSERT' or new.venue_id is distinct from old.venue_id)
       and not exists (
         select 1 from public.profiles where id = auth.uid() and is_verified
       ) then
      raise exception 'Only verified organizers can pick a venue.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- New-event push: venue followers join the existing recipients.
-- One push per person; wording priority: venue > followed organizer > nearby.
-- Venue follows use the same "following" switch as organizer follows.
-- --------------------------------------------------------------------------
create or replace function public.notify_new_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_name text;
  venue_name text;
  batch record;
begin
  select coalesce(username, 'someone') into organizer_name
  from public.profiles where id = new.organizer_id;

  if new.venue_id is not null then
    select name into venue_name from public.venues where id = new.venue_id;
  end if;

  for batch in
    with recipients as (
      -- followers of the venue (rank 1)
      select vf.user_id, 1 as rank
      from public.venue_followers vf
      left join public.notification_prefs np on np.user_id = vf.user_id
      where new.venue_id is not null
        and vf.venue_id = new.venue_id
        and coalesce(np.following_enabled, true)
      union all
      -- followers of the organizer (rank 2)
      select f.follower_id, 2
      from public.follows f
      left join public.notification_prefs np on np.user_id = f.follower_id
      where f.followee_id = new.organizer_id
        and coalesce(np.following_enabled, true)
      union all
      -- people who want events near their saved location (rank 3)
      select np.user_id, 3
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
      select user_id, min(rank) as rank
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
          'title', case r.rank
                     when 1 then 'New event at ' || coalesce(venue_name, 'a venue you follow')
                     when 2 then '@' || organizer_name || ' posted a new event'
                     else 'New event near you' end,
          'body', new.title,
          'data', jsonb_build_object('partyId', new.id)
        ) as m,
        (row_number() over (order by t.token) - 1) / 100 as grp
      from one_per_user r
      join public.push_tokens t on t.user_id = r.user_id
    )
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

-- --------------------------------------------------------------------------
-- Link existing events to venues by exact (case-insensitive) host name.
-- Only fills empty venue_id; returns how many events were linked.
-- --------------------------------------------------------------------------
create or replace function public.link_events_to_venues()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  linked int;
begin
  update public.parties p
     set venue_id = v.id
    from public.venues v
   where p.venue_id is null
     and p.host_name is not null
     and lower(trim(p.host_name)) = lower(trim(v.name));
  get diagnostics linked = row_count;
  return linked;
end;
$$;
revoke execute on function public.link_events_to_venues() from public, anon, authenticated;

select public.link_events_to_venues();

notify pgrst, 'reload schema';
