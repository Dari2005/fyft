# Fyft — Project State

> Read this first, before doing any work. Update it at the end of every session
> if anything below changed. Keep it short and factual. **Never put secrets
> here** (this repo is public).

_Last updated: 2026-11-08 (fresh install + dev server check)_

## What this is

**Fyft** — a mobile app (Android first, iOS later) for discovering ALL events in
Skopje (concerts, parties, sports, meetups…), not just parties: map, event list,
RSVPs with live capacity, per-event chat, follow people/organizers, "friends
going", reminders and push notifications.
Stack: React Native (Expo SDK 57, expo-router, TypeScript) + Supabase
(Postgres, Auth, RLS, Realtime, Storage). Push via Expo Push Service + FCM.
Goal of the repo: a portfolio project (public GitHub), so code quality and an
honest README matter. Brand name stays **Fyft** (Dari decided 2026-11-03 —
do not rename).

## Structure (short)

- `app/` screens: `(tabs)/` = Events (list + filters), Tonight, Map (landing),
  Profile; `party/[id]`, `chat/[id]`, `user/[id]`, `people`, `notifications`,
  `create`, `auth`.
- `lib/`: `supabase`, `AuthContext`, `SocialContext` (follows + friendsGoing),
  `notifications` (local reminders + push registration), `tonight` (05:00 day
  boundary), `geo`, `media`.
- `supabase/`: `schema.sql` + `migration_*.sql` (run in SQL Editor).
- `.github/workflows/ci.yml`: `tsc --noEmit` + `expo lint` on push/PR (file prepared locally; first push needs a git token with `workflow` scope — the current OAuth token is rejected for workflow files).

## Standing decisions — do NOT silently revert

1. **No ratings. At all.** No event ratings, no organizer ratings
   (Dari, 2026-11-01). The `party_ratings` table is unused leftover, as are
   the dead `rating*` styles in `app/party/[id].tsx`.
2. **Event type is free-text** (`parties.party_type`). No preset genre or
   category lists, ever. **No venue choice** (House/Club) in the form either.
3. **Organizer bar on the event detail** (avatar + @username + Follow): v2
   brought it back after Dari's 2026-11-01 "no organizer name at all" call.
   His re-decision is PENDING — don't treat either way as settled.
4. **Design:** "Bold Violet 2" — dark + violet (`constants/theme.ts`,
   primary `#9333ea`). Tab icons are inline SVG; icon fonts never rendered
   in his builds — don't reintroduce them.
5. **Secrets stay OUT of git:** `.env`, `google-maps-key.local`,
   `google-services.json`, Firebase `*adminsdk*.json` (all gitignored;
   google-services.json is local-only by Dari's convention, like the Maps
   key). Maps key reaches cloud builds via the `GOOGLE_MAPS_API_KEY` env
   var on expo.dev account **darijan10** (not `darijans-team`). Google
   Cloud billing must stay OPEN or the map dies.
   The Maps key (Google Cloud project `fyft-512123`) is restricted
   (2026-11-07): Android apps only (`com.dari2005.fyft` + the EAS
   development keystore SHA-1) and Maps SDK for Android only. When the
   app goes to Google Play, add the Play App Signing SHA-1 too. iOS will
   need a separate key restricted to the iOS bundle ID. Firebase lives in
   a different Google project (`fyft-9d540`).
6. One `follows` table for friends and organizers. Notification prefs live
   in their own private table (they hold a saved location), not `profiles`.
7. Internal names stay (`parties` table, `/party/[id]` route, `party_type`
   column) although the UI says "events". No migration for wording.

## Fragile fixes — do not undo

- **MapView renders only while the Map tab is focused** (`useIsFocused`,
  `app/(tabs)/index.tsx`). A live MapView in a detached screen crashes
  Android ("child already has a parent").
- **Realtime channel names have a unique random suffix** per effect run
  (`hooks/useRsvps.ts`, `hooks/useComments.ts`) — reusing a subscribed
  channel name throws when the effect re-runs.
- **Map opens instantly on Skopje**; GPS centering runs in the background
  (last-known → Balanced, skipped after user drag). Never gate the map
  behind a location await.
- Parties refetch silently on Map/Events tab focus; `useParties` must not
  flash the spinner once it has data.
- **Emoji + text = separate Text nodes** in Android buttons/labels (an
  emoji inside the label's `Text` truncates its end). `PrimaryButton`
  has an `icon` prop for this.

## Setup status

- Supabase: `schema.sql` and all migrations applied, including
  `migration_social_notifications.sql`. Realtime on `rsvps`, `comments`.
- Push: Firebase project created; `google-services.json` in project root
  (local only); FCM V1 service-account key uploaded to EAS; EAS
  `projectId` set in `app.json`. Push is sent by a Postgres trigger
  (`notify_new_party` → `pg_net` → Expo API); no extra server.
- Android development build WITH `expo-notifications` is installed on the
  test phone.
- Git: GitHub `main` is the single source of truth (v2 merged 2026-11-06).
  **Workflow (Dari, 2026-11-06):** the Claude working on Dari's PC cannot
  use GitHub at all. It delivers, at the end of each session, a full
  project zip + an updated version of this file via Dari; the other Muse
  (this repo's manager) reviews the changes, merges them, commits and
  pushes. The old local `master` folder on Dari's PC is retired — nobody
  works from it anymore.

## Not verified yet

- Two-account test: follow → publish → push arrives; "friends going" shows.
  If push fails: `select status_code, content from net._http_response
  order by created desc limit 5;`
- Tonight/Tomorrow/Friends/Following filter chips exist in the PC working
  copy — confirm they reach GitHub and test on a real device.
- Google Cloud budget alert — not set up yet.
- **`expo-dev-client` is NOT in `package.json`** (found 2026-11-08).
  `npx expo start --dev-client` still starts Metro but warns it can't
  determine the deep-link URI scheme. Check whether the phone's dev build
  connects; if not, add it with `npx expo install expo-dev-client`
  (**native** — batch it with the next dev build).
- `npm install` (2026-11-08) reports 23 audit vulnerabilities (6 high) and
  `expo` 57.0.29 → ~57.0.32 available (`npx expo install --check`). Not
  addressed yet.

## Local environment notes (Windows PC)

- PowerShell execution policy blocks `npx.ps1`. Use `npx.cmd …` in
  PowerShell (or run from cmd / Git Bash) instead of changing the policy.
  Dev server: `npx.cmd expo start --dev-client` (Metro on :8081).

## Known limitations / roadmap

1. **House-party safety** (top priority before public launch): exact address
   is public. Plan: approximate area until organizer approves, 18+ option,
   verification.
2. Past events are not pruned from the Events list (filters hide them).
3. Capacity is only visual; the DB does not block RSVPs over capacity.
4. `usePartyStats` loads all "going" rows client-side — move to a view/RPC.
5. Moderation is manual (reports table); auto-hide after N reports planned.
6. Get 5–10 real organizers publishing regularly (the app is useless empty).
7. Songkick auto-import of Skopje concerts is the planned content seed
   (needs Dari's free Songkick API key, kept server-side).

## Working rules

- Read `AGENTS.md` + this file before working. Check versioned Expo docs
  before touching Expo/RN APIs (SDK 57).
- Run `npx tsc --noEmit` and `npx expo lint` before declaring done. Never
  claim a change works on Dari's phone until he confirms it there.
- Label every change **JS-only** (Metro, no build) or **native** (needs
  `eas build --profile development --platform android`, ~20 min). Batch
  native changes; Dari hates a build per tweak.
- Add packages with `npx expo install <pkg>`. New Supabase tables need
  explicit GRANTs + RLS in the same migration.
- Commit per feature with clear messages; update this file when state changes.
