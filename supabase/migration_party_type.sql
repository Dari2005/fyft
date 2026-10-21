-- Migration: free-text party type (run once in the Supabase SQL editor).
-- The organizer types it themselves (e.g. "Birthday", "Rave", "BBQ").

alter table public.parties
  add column if not exists party_type text;
