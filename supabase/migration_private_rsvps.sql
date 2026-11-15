-- Migration: private RSVPs, numbers-only going counts
-- (run once in the Supabase SQL editor; safe to run again).
-- Design: docs/designs/private_rsvps.md
--
-- Before: `rsvps` (party_id, user_id, status) had "public read", so anyone
-- with the public anon key could list who goes to which event. Realtime on
-- `rsvps` also sent the user id of every cancellation to every listener
-- (Supabase does not apply RLS to DELETE events).
-- Now:
--   * `party_counts` holds one number per event. Everyone can read it, no
--     client can write it; a trigger on `rsvps` keeps it up to date, and it
--     is the table the event page listens to for live counts.
--   * `rsvps` is readable only by its owner and is removed from Realtime.
--
-- Update the app BEFORE running this: older app code would count only your
-- own RSVP afterwards and show 0 or 1 going everywhere.

-- ---------------------------------------------------------------------------
-- 1. party_counts: numbers only, no user ids. A missing row means 0.
-- ---------------------------------------------------------------------------
create table if not exists public.party_counts (
  party_id uuid primary key references public.parties (id) on delete cascade,
  going_count int not null default 0 check (going_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.party_counts enable row level security;

-- Read-only for the API. There is no insert/update/delete policy either, so
-- RLS blocks client writes even if a grant comes back.
revoke all on public.party_counts from anon, authenticated;
grant select on public.party_counts to anon, authenticated;

drop policy if exists "party_counts: public read" on public.party_counts;
create policy "party_counts: public read"
  on public.party_counts for select using (true);

-- ---------------------------------------------------------------------------
-- 2. Keep party_counts in step with rsvps: +1 when a row becomes "going",
--    -1 when it stops being "going". The row lock taken by
--    `on conflict do update` orders two RSVPs made at the same moment, so
--    none is lost. The -1 is a plain UPDATE, so cascaded deletes (an event
--    being deleted) can never fail on a foreign key.
-- ---------------------------------------------------------------------------
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

  return null; -- AFTER trigger: the return value is ignored
end;
$$;

drop trigger if exists rsvps_sync_party_counts on public.rsvps;
create trigger rsvps_sync_party_counts
  after insert or delete or update of status, party_id on public.rsvps
  for each row execute function public.sync_party_counts();

-- ---------------------------------------------------------------------------
-- 3. Repair tool + backfill: set every event's count to the real number of
--    "going" RSVPs. SQL editor only (not callable through the API).
--    Run `select public.reconcile_party_counts();` if counts ever look off.
-- ---------------------------------------------------------------------------
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

select public.reconcile_party_counts();

-- ---------------------------------------------------------------------------
-- 4. rsvps: private. Each user reads only their own rows (organizers too);
--    the insert/update/delete own-row policies are unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "rsvps: public read" on public.rsvps;
drop policy if exists "rsvps: read own" on public.rsvps;
create policy "rsvps: read own"
  on public.rsvps for select to authenticated
  using (auth.uid() = user_id);

-- My plans, reminders and the policy above all filter on user_id.
create index if not exists rsvps_user_idx on public.rsvps (user_id);

-- ---------------------------------------------------------------------------
-- 5. Realtime: stop publishing rsvps (DELETE events skip RLS and would carry
--    user ids), publish party_counts instead.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rsvps'
  ) then
    alter publication supabase_realtime drop table public.rsvps;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'party_counts'
  ) then
    alter publication supabase_realtime add table public.party_counts;
  end if;
end;
$$;

-- Let the REST API see the new table right away.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Checks to run afterwards (each should match the comment):
--
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime';
--   -> party_counts is listed, rsvps is not
--
-- select pc.party_id, pc.going_count, count(r.party_id) filter (where r.status = 'going') as real
-- from public.party_counts pc left join public.rsvps r using (party_id)
-- group by 1, 2 having pc.going_count <> count(r.party_id) filter (where r.status = 'going');
--   -> no rows
-- ---------------------------------------------------------------------------
