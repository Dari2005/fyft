-- Migration: in-app account deletion (run once in the Supabase SQL editor;
-- safe to run again). Google Play requires apps with sign-up to let users
-- delete their account from inside the app.
--
-- delete_my_account() deletes the CALLER's auth user (auth.uid(), never an
-- argument). Everything owned by the account goes with it through the
-- existing ON DELETE CASCADE chain: profile, events (people going get the
-- "Cancelled" push), RSVPs (going counts drop through the party_counts
-- trigger), follows, venue follows, push tokens, notification settings and
-- reports. Photos in the party-media bucket are removed by the app first
-- (storage policy "party media owner delete"), because Storage files must be
-- deleted through the Storage API, not SQL.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = 'P0001';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
