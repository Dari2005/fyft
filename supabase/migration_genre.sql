-- Migration: add music genre to parties (run once in Supabase SQL editor).
-- Safe to re-run: uses "if not exists".

alter table public.parties
  add column if not exists genre text
  check (genre in ('techno', 'house', 'hiphop', 'pop', 'narodno', 'rock', 'disco', 'other'));
