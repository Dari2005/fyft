-- Migration: optional host / venue name on an event (run once in the Supabase
-- SQL editor). Shown on the event page instead of the account that posted it
-- ("Stanica 26 · posted by @darijan"). The app works without this column:
-- it simply never shows or saves a host name until the migration is run.

alter table public.parties
  add column if not exists host_name text
  check (host_name is null or char_length(host_name) between 1 and 60);
