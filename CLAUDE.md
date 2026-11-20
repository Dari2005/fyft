# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read first:** `AGENTS.md` (Expo rules: SDK 57, fetch versioned docs before touching Expo/RN APIs, `npx expo install` for packages, no hand-edited `ios/`/`android/`) and `PROJECT_STATE.md` (current status, standing product decisions that must not be silently reverted, fragile fixes, what is unverified on the phone). Update `PROJECT_STATE.md` at the end of a session when anything changed, and `README.md` when setup, structure, migrations or features change (the repo is public; README is its front page and must never give unsafe instructions such as adding `rsvps` to Realtime or putting keys in `app.json`).

## Commands

On this Windows PC, PowerShell blocks `npx.ps1`: use `npx.cmd …` (or Git Bash).

```bash
npx tsc --noEmit                         # typecheck — run before calling anything done
npx expo lint                            # lint (eslint-config-expo) — same
npx.cmd expo start --dev-client          # Metro for the Android dev build on the phone
npx.cmd expo start --web --port 8081     # browser preview (Claude preview config: fyft-web)
npx expo install <pkg>                   # add packages (SDK-compatible versions)
npx eas-cli@latest build --profile development --platform android   # native changes only (~20 min)
```

There is no test suite. Verification = tsc + lint + looking at the screen (browser preview, then the phone).

Every change is either **JS-only** (reloads over Metro) or **native** (new package with native code, `app.json` plugins, icon/splash PNGs → needs an EAS build). Say which, and batch native changes.

## Architecture

- **Routes live in `app/`** (not `src/app/` as AGENTS.md's template says). `app/(tabs)/`: `index.tsx` = Map (landing tab), `list.tsx` = Events, `profile.tsx`. Stack screens: `party/[id]` (event page), `create` (new/edit event, `?edit=<id>`), `auth` (`?welcome=1` on first open), `auth-callback` (Google OAuth return link), `user/[id]`, `venue/[id]`, `people` (titled "Organizers"), `notifications`.
- **Root providers** in `app/_layout.tsx`: `ThemeProvider` → `AuthProvider` → `SocialProvider` (organizer follows) → `DialogProvider`, plus two effect-only components: `NotificationsBridge` (reminders, push token, notification taps) and `FirstOpenGate` (shows sign-up once per install).
- **Theming:** two palettes with identical keys in `constants/theme.ts`. Screens build styles with `makeStyles = (Colors: Palette) => StyleSheet.create(...)` + `useThemedStyles(makeStyles)`, and read `useColors()` for inline colors. Never import a palette or hardcode a theme color in a screen — it would not switch themes. The accent (magenta) is never a fill: primary/active controls use `outline(Colors)`.
- **Dialogs:** `useDialog()` from `lib/DialogContext.tsx` (`notify` / `ask` / `choose`). Do not use `Alert.alert`; `components/ConfirmDialog` is only for the destructive Delete.
- **Events data:** `hooks/useParties` loads all events once; Events and Map filter client-side with the same `makeEventMatcher` (`lib/eventFilters.ts`), driven by `components/EventFilterBar.tsx` (one row of `Dropdown` pills). Time logic is in `lib/tonight.ts`: a night ends at 05:00, events are "live" for 4 h after start, and `isOver` hides finished events everywhere. Going counts come ONLY from the numbers-only `party_counts` table through `lib/goingCounts.ts` (`hooks/usePartyStats` for lists/map, `hooks/useRsvps` for the event page, live via Realtime on `party_counts`). `rsvps` is private (each user reads only their own rows) and is not in Realtime — never count it for a number shown in the app. Crowd label/thresholds: `lib/crowd.ts`. Categories (`party` / `live` / `kafana`, stored in `parties.party_type`): `lib/categories.ts`.
- **Venues** (`migration_venues.sql`, `lib/venues.ts`): a venue is not an account. `parties.organizer_id` = who listed it, `parties.venue_id` = where (optional, only verified organizers may set it — `guard_party_write`). Venues are managed in the SQL editor only (no client writes) and cached once per session by `useVenues()`. Venue follows live in `SocialContext` (`venue_followers`, private; numbers via `venue_follower_count`). `FollowButton` takes `profile` or `venue`. Future venue owners get access through a `venue_members` table checked in the same guard — not built yet.
- **One card everywhere:** `components/PartyCard.tsx` is used by the Events list and the map pin preview.
- **Backend (Supabase):** `supabase/schema.sql` + `supabase/migration_*.sql`, run by hand in the SQL editor (there is no migration runner — new columns must not break the app before the SQL is run; see the column-dropping retry in `app/create.tsx`). New tables need explicit GRANTs + RLS in the same migration. Internal names stay old (`parties`, `party_type`, `/party/[id]`) though the UI says "events". Push notifications are sent by Postgres triggers through `pg_net` to the Expo push API; no app server. New event → `notify_new_party` (latest version in migration_venues.sql: venue followers, organizer followers and nearby, one push per person); getting busy (50/75/90 %, once per event+threshold via `party_alerts`) → `notify_party_busy` on `party_counts`; new time / place / cancelled → `notify_party_changed` on `parties` (both in migration_smart_notifications.sql, sending through `push_to_users`). Push `data.partyId` opens the event (`NotificationsBridge`).
- **Auth:** `lib/AuthContext.tsx` — email/password plus `signInWithGoogle` (Supabase OAuth through `expo-web-browser`, returning on `fyft://auth-callback`; needs Google enabled in the Supabase dashboard).
- **Icons and logo:** inline SVG only (`components/Icon.tsx`; emoji and icon fonts are banned in UI chrome). The wordmark + crowd bar is SVG data in `components/Logo.tsx`, duplicated in `scripts/make-logo.js`, which renders the icon/splash/favicon PNGs — keep the two in sync.
- **Config and secrets:** `app.config.js` injects the Google Maps key from the `GOOGLE_MAPS_API_KEY` env var (EAS) or the gitignored `google-maps-key.local`. `.env` holds `EXPO_PUBLIC_SUPABASE_*`. The repo is public — never commit keys or put them in `PROJECT_STATE.md`.
- **Browser preview:** `metro.config.js` swaps `react-native-maps` and `expo-notifications` for stubs in `scripts/web-preview/` on web only, and `app.json` uses `web.output: "single"` (static rendering crashes on Supabase's storage). The map there is a gray placeholder; Google sign-in, push and pickers do not work in the browser.
