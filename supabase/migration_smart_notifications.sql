-- Migration: smart notifications
-- (run once in the Supabase SQL editor; safe to run again).
--
-- Adds two push categories on top of migration_social_notifications.sql:
--
-- 1. "Getting busy": when an event's going count crosses 50 / 75 / 90 % of
--    its capacity. Each user picks ONE threshold (default 75 %). Recipients:
--    people going to it, followers of its organizer, and the organizer.
--    Detected in the database (trigger on party_counts), so it works when
--    nobody has the app open. Each (event, threshold) is sent once ever
--    (party_alerts), even if the count drops and rises again.
-- 2. "Changes to my events": cancelled (deleted), new time, new place.
--    Recipients: people going to it (never the organizer, who made the change).
--
-- No push for events that are hidden (reports) or already over (4 h after the
-- start, same as LIVE_WINDOW_MS in lib/tonight.ts).
-- Pushes go through pg_net to the Expo push API like notify_new_party, and
-- only to devices in push_tokens (= notification permission granted). Every
-- failure is swallowed with a WARNING so RSVPs, edits and deletes never fail
-- because of notifications.
-- Nobody learns who is going: each push goes only to its own recipient.

-- --------------------------------------------------------------------------
-- Preferences (No row = defaults: both on, 75 %).
-- --------------------------------------------------------------------------
alter table public.notification_prefs
  add column if not exists busy_enabled boolean not null default true;
alter table public.notification_prefs
  add column if not exists busy_threshold int not null default 75;
alter table public.notification_prefs
  add column if not exists changes_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_prefs_busy_threshold_check'
  ) then
    alter table public.notification_prefs
      add constraint notification_prefs_busy_threshold_check
      check (busy_threshold in (50, 75, 90));
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- party_alerts: which (event, threshold) alerts were already sent.
-- Internal only: RLS on, no policies, no grants.
-- --------------------------------------------------------------------------
create table if not exists public.party_alerts (
  party_id uuid not null references public.parties (id) on delete cascade,
  kind text not null check (kind in ('busy')),
  threshold int not null,
  sent_at timestamptz not null default now(),
  primary key (party_id, kind, threshold)
);
alter table public.party_alerts enable row level security;
revoke all on public.party_alerts from anon, authenticated;

-- --------------------------------------------------------------------------
-- push_to_users: one Expo push per device of each user (100 per request).
-- --------------------------------------------------------------------------
create or replace function public.push_to_users(
  recipients uuid[],
  push_title text,
  push_body text,
  push_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
begin
  if recipients is null or cardinality(recipients) = 0 then
    return;
  end if;

  for batch in
    with msgs as (
      select
        jsonb_build_object(
          'to', t.token,
          'sound', 'default',
          'channelId', 'default',
          'title', push_title,
          'body', push_body,
          'data', coalesce(push_data, '{}'::jsonb)
        ) as m,
        (row_number() over (order by t.token) - 1) / 100 as grp
      from public.push_tokens t
      where t.user_id = any (recipients)
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
end;
$$;

revoke execute on function public.push_to_users(uuid[], text, text, jsonb)
  from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- 1. Getting busy (AFTER INSERT/UPDATE on party_counts).
-- --------------------------------------------------------------------------
create or replace function public.notify_party_busy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  old_count int := case when tg_op = 'UPDATE' then old.going_count else 0 end;
  t int;
  inserted int;
  going_ids uuid[];
  follower_ids uuid[];
  org_enabled boolean;
  org_threshold int;
begin
  if new.going_count <= old_count then
    return null;
  end if;

  select id, title, organizer_id, capacity, starts_at, hidden_at into p
  from public.parties where id = new.party_id;

  if p.id is null or p.capacity is null or p.capacity <= 0
     or p.hidden_at is not null
     or p.starts_at < now() - interval '4 hours' then
    return null;
  end if;

  foreach t in array array[50, 75, 90] loop
    -- crossed t % on this change (integer math, no rounding surprises)
    if old_count * 100 < t * p.capacity and new.going_count * 100 >= t * p.capacity then
      insert into public.party_alerts (party_id, kind, threshold)
      values (p.id, 'busy', t)
      on conflict do nothing;
      get diagnostics inserted = row_count;
      continue when inserted = 0;

      -- people going (not the organizer) who chose this threshold
      select coalesce(array_agg(distinct r.user_id), '{}') into going_ids
      from public.rsvps r
      left join public.notification_prefs np on np.user_id = r.user_id
      where r.party_id = p.id and r.status = 'going'
        and r.user_id <> p.organizer_id
        and coalesce(np.busy_enabled, true)
        and coalesce(np.busy_threshold, 75) = t;

      -- followers of the organizer who are not going and chose this threshold
      select coalesce(array_agg(distinct f.follower_id), '{}') into follower_ids
      from public.follows f
      left join public.notification_prefs np on np.user_id = f.follower_id
      where f.followee_id = p.organizer_id
        and f.follower_id <> all (going_ids)
        and coalesce(np.busy_enabled, true)
        and coalesce(np.busy_threshold, 75) = t;

      perform public.push_to_users(
        going_ids,
        'Getting busy: ' || p.title,
        'The event you''re going to is ' || t || '% full.',
        jsonb_build_object('partyId', p.id)
      );
      perform public.push_to_users(
        follower_ids,
        'Getting busy: ' || p.title,
        'An event from an organizer you follow is ' || t || '% full.',
        jsonb_build_object('partyId', p.id)
      );
      -- the organizer, with the same setting (no prefs row = on, 75 %)
      org_enabled := null;
      org_threshold := null;
      select np.busy_enabled, np.busy_threshold into org_enabled, org_threshold
      from public.notification_prefs np where np.user_id = p.organizer_id;
      if coalesce(org_enabled, true) and coalesce(org_threshold, 75) = t then
        perform public.push_to_users(
          array[p.organizer_id],
          'Your event is getting busy',
          p.title || ' is ' || t || '% full.',
          jsonb_build_object('partyId', p.id)
        );
      end if;
    end if;
  end loop;

  return null;
exception when others then
  raise warning 'notify_party_busy failed: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_party_busy() from public, anon, authenticated;

drop trigger if exists party_counts_notify_busy on public.party_counts;
create trigger party_counts_notify_busy
  after insert or update of going_count on public.party_counts
  for each row execute function public.notify_party_busy();

-- --------------------------------------------------------------------------
-- 2. Changes: new time / new place (AFTER UPDATE) and cancelled (BEFORE
--    DELETE, while the rsvps still exist; pg_net sends only after commit).
-- --------------------------------------------------------------------------
create or replace function public.going_recipients_for_changes(target uuid, organizer uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct r.user_id), '{}')
  from public.rsvps r
  left join public.notification_prefs np on np.user_id = r.user_id
  where r.party_id = target and r.status = 'going'
    and r.user_id <> organizer
    and coalesce(np.changes_enabled, true);
$$;

revoke execute on function public.going_recipients_for_changes(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.notify_party_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  time_changed boolean;
  place_changed boolean;
  when_text text;
  push_title text;
  push_body text;
begin
  if tg_op = 'DELETE' then
    if old.hidden_at is null and old.starts_at >= now() - interval '4 hours' then
      perform public.push_to_users(
        public.going_recipients_for_changes(old.id, old.organizer_id),
        'Cancelled: ' || old.title,
        'This event was cancelled by its organizer.',
        '{}'::jsonb
      );
    end if;
    return old;
  end if;

  if new.hidden_at is not null or new.starts_at < now() - interval '4 hours' then
    return null;
  end if;

  time_changed := new.starts_at is distinct from old.starts_at;
  place_changed := new.address is distinct from old.address
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude;

  if not time_changed and not place_changed then
    return null;
  end if;

  when_text := to_char(new.starts_at at time zone 'Europe/Skopje', 'Dy DD Mon, HH24:MI');

  if time_changed and place_changed then
    push_title := 'Time and place changed: ' || new.title;
    push_body := when_text || coalesce(' at ' || new.address, '');
  elsif time_changed then
    push_title := 'New time: ' || new.title;
    push_body := 'Now ' || when_text || '.';
  else
    push_title := 'New place: ' || new.title;
    push_body := coalesce('Now at ' || new.address || '.', 'The location on the map changed.');
  end if;

  perform public.push_to_users(
    public.going_recipients_for_changes(new.id, new.organizer_id),
    push_title,
    push_body,
    jsonb_build_object('partyId', new.id)
  );
  return null;
exception when others then
  raise warning 'notify_party_changed failed: %', sqlerrm;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.notify_party_changed() from public, anon, authenticated;

drop trigger if exists parties_notify_changed on public.parties;
create trigger parties_notify_changed
  after update of starts_at, address, latitude, longitude on public.parties
  for each row execute function public.notify_party_changed();

drop trigger if exists parties_notify_cancelled on public.parties;
create trigger parties_notify_cancelled
  before delete on public.parties
  for each row execute function public.notify_party_changed();

notify pgrst, 'reload schema';
