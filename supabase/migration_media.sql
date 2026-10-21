-- Migration: party photos & videos (run once in the Supabase SQL editor).
-- 1) media column on parties: jsonb array of {"url": string, "type": "image"|"video"}
-- 2) public Storage bucket "party-media" + policies (public read,
--    authenticated users upload/delete only inside their own folder).

alter table public.parties
  add column if not exists media jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('party-media', 'party-media', true)
on conflict (id) do nothing;

drop policy if exists "party media public read" on storage.objects;
create policy "party media public read"
  on storage.objects for select
  using (bucket_id = 'party-media');

drop policy if exists "party media auth upload" on storage.objects;
create policy "party media auth upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'party-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "party media owner delete" on storage.objects;
create policy "party media owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'party-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
