# Fyft 🎉

A mobile app (iOS + Android) where anyone can publish parties — house or club — and
people can browse them, RSVP, and comment. Built with **React Native (Expo)** +
**TypeScript**, backend on **Supabase** (Postgres + Auth + RLS).

This is a Phase 1 MVP: everything except real ticket payments (payments are
Phase 2 — intentionally not built here).

## Project structure

```
app/                  # expo-router screens (file-based navigation)
  index.tsx           # home: party list
  auth.tsx            # sign in / sign up
  create.tsx          # publish a party
  party/[id].tsx      # party detail (RSVP + live capacity ✅, comments coming in M4)
components/           # reusable UI (PartyCard, PrimaryButton, TextField)
hooks/                # data hooks (useParties)
lib/                  # supabase client, AuthContext, shared types
constants/            # theme colors & spacing
supabase/schema.sql   # full database schema + RLS policies (run once)
```

## Setup

1. **Create a free Supabase project** at https://supabase.com (no code needed —
   create it in the dashboard).
2. In the Supabase dashboard go to **SQL Editor** and run the whole contents of
   `supabase/schema.sql`. This creates tables, RLS policies, the auto-profile
   trigger, and the anti-spam trigger (max 3 parties per user per day).
3. Copy `.env.example` to `.env` and fill in your project values (Dashboard →
   Project Settings → API):
   ```bash
   cp .env.example .env
   ```
4. Install and start:
   ```bash
   npm install
   npx expo start
   ```
   Scan the QR code with the **Expo Go** app, or press `w` for web.

> **Note:** `react-native-maps` is installed for the upcoming map view, but it
> needs a development build — it is not bundled in Expo Go. Until then the app
> runs fine in Expo Go; when you're ready for the map, build with
> `npx expo run:android` / `eas build --profile development`. See the project
> `AGENTS.md` for the native-module rules.

## Phase 1 milestones

- **M1 — Skeleton + Auth** ✅ (this commit)
  Expo router app, Supabase client, sign in/sign up, party list, create-party
  form, schema.sql with RLS + 3/day anti-spam trigger.
- **M2 — Map browse + location**
  `react-native-maps` view of parties, `expo-location` for current position,
  address autocomplete / tap-to-set-pin (replaces manual lat/lng inputs).
- **M3 — RSVP + live capacity** ✅ (this commit)
  "Доаѓам / Заинтересиран" buttons with toggle (tap again to remove),
  live "going" count + progress bar + ПОЛНО badge (realtime subscription on
  `rsvps`), report-party button with reason picker wired to the `reports`
  table. Note: enable `rsvps` in Dashboard → Database → Replication for the
  live updates to arrive from other users' devices.
- **M4 — Comments**
  Comment list + composer on the party detail screen.
- **M5 — Polish & store**
  App icon, splash, profile screen (my parties), EAS build for TestFlight/Play.

**Phase 2 (out of scope):** real ticket purchasing, payments, refunds — needs a
legal entity and a payment provider.

## Anti-spam

- Rate limit: **max 3 published parties per user per day** — enforced
  server-side by the `party_creation_limit` trigger in `supabase/schema.sql`
  (plus a client-side pre-check in `app/create.tsx` for nicer UX).
- Report flow: `reports` table (one report per user per party); moderation
  happens in the Supabase dashboard for now.

## Scripts

| Command            | What it does                          |
|--------------------|---------------------------------------|
| `npx expo start`   | dev server (QR for Expo Go)           |
| `npx tsc --noEmit` | typecheck                             |
| `npx expo lint`    | lint (if configured)                  |
| `npx expo-doctor`  | diagnose dependency/SDK issues        |
