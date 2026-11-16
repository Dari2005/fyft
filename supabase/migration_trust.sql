-- Migration: trust and anti-fake-event measures
-- (run once in the Supabase SQL editor; safe to run again).
--
-- 1. Verified organizers: profiles.is_verified. Shown as a badge on their
--    events and profile. Only the SQL editor / service role can set it:
--      update public.profiles set is_verified = true where username = '...';
-- 2. Auto-hide: an event disappears for everyone except its organizer once
--    3 different users have reported it (parties.hidden_at). Events of
--    verified organizers are never auto-hidden. To restore one:
--      update public.parties set hidden_at = null where id = '...';
--    To list hidden events:
--      select id, title, hidden_at from public.parties where hidden_at is not null;
-- 3. Confirmed email before publishing: the database refuses a new event
--    from an account whose email (or phone) is not confirmed. Email
--    confirmation is already on in Auth settings; this also covers the case
--    where it gets switched off.
--
-- The app works before this runs: it reads verified ids in a separate,
-- optional query and never selects the new columns directly.

-- --------------------------------------------------------------------------
-- Columns
-- --------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_verified boolean not null default false;

alter table public.parties
  add column if not exists hidden_at timestamptz;

-- --------------------------------------------------------------------------
-- Clients cannot set is_verified or hidden_at.
-- These guards are SECURITY INVOKER on purpose: current_user is the API role
-- ('anon' / 'authenticated') for app requests, and the table owner when the
-- write comes from the SQL editor or from the security-definer report
-- trigger below, which must be allowed through.
-- --------------------------------------------------------------------------

-- True when the signed-in user has confirmed their email or phone.
-- No argument, so nobody can ask about another user.
create or replace function public.current_user_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
  );
$$;
revoke execute on function public.current_user_confirmed() from public, anon;
grant execute on function public.current_user_confirmed() to authenticated;

create or replace function public.guard_profile_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_verified := false;
    else
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_write on public.profiles;
create trigger profiles_guard_write
  before insert or update on public.profiles
  for each row execute function public.guard_profile_write();

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
  end if;
  return new;
end;
$$;

drop trigger if exists parties_guard_write on public.parties;
create trigger parties_guard_write
  before insert or update on public.parties
  for each row execute function public.guard_party_write();

-- --------------------------------------------------------------------------
-- Hidden events: visible only to their organizer.
-- --------------------------------------------------------------------------
drop policy if exists "parties: public read" on public.parties;
create policy "parties: public read"
  on public.parties for select
  using (hidden_at is null or auth.uid() = organizer_id);

-- --------------------------------------------------------------------------
-- Auto-hide after 3 reports from different users (reports has
-- unique (party_id, reporter_id), so one user counts once).
-- --------------------------------------------------------------------------
create or replace function public.auto_hide_reported_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_count int;
  organizer_verified boolean;
begin
  select count(*) into report_count
  from public.reports
  where party_id = new.party_id;

  if report_count >= 3 then
    select coalesce(pr.is_verified, false) into organizer_verified
    from public.parties p
    join public.profiles pr on pr.id = p.organizer_id
    where p.id = new.party_id;

    if not coalesce(organizer_verified, false) then
      update public.parties
         set hidden_at = now()
       where id = new.party_id
         and hidden_at is null;
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.auto_hide_reported_party() from public, anon, authenticated;

drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide
  after insert on public.reports
  for each row execute function public.auto_hide_reported_party();

notify pgrst, 'reload schema';
