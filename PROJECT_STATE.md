# Fyft — Project State (read this first, whoever works on the app)

Single source of truth for any AI/developer picking up Fyft. If you change
something significant, update this file in the same commit.

## What it is

Fyft — an app for ALL events in Skopje (concerts, parties, sports, meetups,
birthdays…), not just parties. Anyone can publish an event; users browse a
full-screen map + list, RSVP with live capacity, and chat per event.
Brand name stays **Fyft** (decided by Dari, 2026-11-03 — do not rename).

## Stack

- React Native (Expo SDK 57) + TypeScript, expo-router
- Supabase (Postgres + Auth + RLS + Realtime on `rsvps` and `comments`)
- Google Maps via react-native-maps; EAS development builds
- GitHub: https://github.com/Dari2005/fyft (public, `main`)

## Standing decisions — DO NOT silently revert these

1. **No ratings. At all.** No party ratings, no organizer ratings
   (Dari, 2026-11-01). The `party_ratings` table exists but is unused;
   dead `rating*` styles in `app/party/[id].tsx` are leftovers, not a feature.
2. **Event type is free-text.** Organizers type it themselves
   (`parties.party_type`). No preset genre/category lists, ever.
3. **No venue choice** (House/Club) in the form. Removed 2026-10-22.
4. **Secrets stay local, never committed:** `.env`, `google-maps-key.local`,
   `google-services.json` (all gitignored). Maps key reaches cloud builds
   via the `GOOGLE_MAPS_API_KEY` env var on the expo.dev account
   **darijan10** (there is also a `darijans-team` account — wrong one).
   Google Cloud billing account must stay OPEN or the map dies.
5. **Design:** "Bold Violet 2" — dark + violet (`constants/theme.ts`,
   primary `#9333ea`). Tab icons are inline SVG (react-native-svg);
   icon fonts (@expo/vector-icons) never rendered in his builds — don't
   reintroduce them.
6. **Emoji + text must be separate Text nodes** on Android buttons/labels:
   an emoji inside the same `Text` as a bold label truncates the label's
   end (bit us on filter chips and the Navigate button). `PrimaryButton`
   has an `icon` prop for this.

## Fragile fixes — do not undo

- **MapView renders only while the Map tab is focused** (`useIsFocused` in
  `app/(tabs)/index.tsx`). A live MapView inside a detached screen crashes
  Android with "child already has a parent".
- **Realtime channel names carry a unique random suffix** per effect run
  (`hooks/useRsvps.ts`, `hooks/useComments.ts`). Reusing a subscribed
  channel name throws "cannot add postgres_changes callbacks after
  subscribe()" when the effect re-runs (auth resolving changes userId).
- **Map opens instantly on Skopje**; GPS centering happens in the
  background (last-known → Balanced fix, skipped after the user drags).
  Never gate the map behind a location await.
- Parties refetch silently on Map/Events tab focus (`useFocusEffect`);
  `useParties` must not flash the spinner once it has data.

## Current state (2026-11-06)

- v2 social release merged (commit `54c1b03`): follows (People screen,
  public profiles, FollowButton), friends-going on cards/detail,
  Tonight tab (05:00 night cutoff, Live now), notifications.
- The **organizer bar (avatar + @username + Follow) is back on the event
  detail** in v2. This conflicts with Dari's 2026-11-01 "no organizer name
  at all" call; his re-decision is PENDING — don't treat either way as
  settled until he answers.
- `expo-notifications` is a native dependency → v2 needs a fresh EAS
  build; Metro alone won't run it.
- `supabase/migration_social_notifications.sql` must be run in the
  Supabase SQL editor for follows/push to work — run status UNCONFIRMED.
- Push design: Expo Push Service; tokens in `push_tokens`; a pg_net
  trigger on `parties` insert notifies followers + opted-in nearby users.
  Android push needs `google-services.json` in the project root at build
  time (local-only file, see secrets above).

## Workflow rules

- Label every change **JS-only** (runs via Metro, no build) or **native**
  (needs an EAS build). Dari hates 20-minute builds for JS changes —
  batch native changes.
- Internal names stay as they are (`parties` table, `/party/[id]` route,
  `party_type` column) even though the UI says "events". No migration for
  wording.
- New Supabase tables need explicit GRANTs + RLS in the same migration
  (Supabase requires this for tables created after 2026-10-30).
- Verify with `npx tsc --noEmit` and `npx expo lint` before calling
  something done. Never claim a change works on Dari's phone until he
  confirms it there.
