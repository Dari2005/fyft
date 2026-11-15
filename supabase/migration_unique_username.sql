-- Migration: never fail a sign-up because the username is taken
-- (run once in the Supabase SQL editor; safe to run again).
--
-- Before: a new account's profile got the chosen username, or the part of
-- the email before "@". `profiles.username` is unique, so a Google account
-- whose email prefix was already someone's username made the whole sign-up
-- fail ("Database error saving new user").
-- Now: if the name is taken (ignoring upper/lower case) the trigger adds a
-- number — dari, dari2, dari3 … The app also checks the name before an
-- email sign-up, so people who type a username are told it is taken
-- instead of being renamed.

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
    -- Two sign-ups grabbed the same name at the same moment: fall back to a
    -- suffix from the user id, which cannot collide.
    insert into public.profiles (id, username)
    values (new.id, base || '_' || left(replace(new.id::text, '-', ''), 6))
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;
