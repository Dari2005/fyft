-- Migration: retire the fixed venue type (house/club).
-- Parties now carry only the organizer's free-text party_type.
-- The column stays (old rows keep their values) but is no longer required.

alter table public.parties
  drop constraint if exists parties_venue_type_check;

alter table public.parties
  alter column venue_type drop not null;
