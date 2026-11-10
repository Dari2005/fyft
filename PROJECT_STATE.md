# Fyft — Project State

> Read this first, before doing any work. Update it at the end of every session
> if anything below changed. Keep it short and factual. **Never put secrets
> here** (this repo is public).

_Last updated: 2026-11-10 (accent purple → magenta; new "fyft" logo)_

## What this is

**Fyft** — a mobile app (Android first, iOS later) for discovering ALL events in
Skopje (concerts, parties, sports, meetups…), not just parties: map, event list,
a "Going" count with a crowd meter, follow ORGANIZERS (no friends — see
decision 8), reminders and push notifications. No chat, no "interested".

**North star (Dari, 2026-11-08): Fyft exists so people don't go to empty
parties.** "How many are going" is the most important thing on every
screen — judge every feature and design by that.
Stack: React Native (Expo SDK 57, expo-router, TypeScript) + Supabase
(Postgres, Auth, RLS, Realtime, Storage). Push via Expo Push Service + FCM.
Goal of the repo: a portfolio project (public GitHub), so code quality and an
honest README matter. Brand name stays **Fyft** (Dari decided 2026-11-03 —
do not rename).

## Structure (short)

- `app/` screens: `(tabs)/` = Events (list), Map (landing), Profile — 3 tabs;
  `party/[id]`, `user/[id]`, `people`, `notifications`,
  `create`, `auth`.
- Search + filters are shared by Events and Map: `components/EventFilterBar.tsx`
  (search bar + chips) and `lib/eventFilters.ts` (matching logic). Chips:
  All / Tonight(Today by day) / Tomorrow / This weekend, then Following
  (= organizers I follow; toggle). Events adds sort chips (Soonest / Near me / Most going) in front.
  Search matches title, address and event type. Filter state is per screen
  (not shared between tabs).
- `lib/`: `supabase`, `AuthContext`, `SocialContext` (organizer follows only),
  `notifications` (local reminders + push registration), `tonight` (05:00 day
  boundary, used by the Tonight/Tomorrow chips), `eventFilters`, `geo`, `media`.
- `supabase/`: `schema.sql` + `migration_*.sql` (run in SQL Editor).
- `.github/workflows/ci.yml`: `tsc --noEmit` + `expo lint` on push/PR (file prepared locally; first push needs a git token with `workflow` scope — the current OAuth token is rejected for workflow files).

## Standing decisions — do NOT silently revert

1. **No ratings. At all.** No event ratings, no organizer ratings
   (Dari, 2026-11-01). The `party_ratings` table is an unused leftover (the
   dead `rating*` styles were removed with the 2026-11-08 detail redesign).
2. **Event type is free-text** (`parties.party_type`). No preset genre or
   category lists, ever. **No venue choice** (House/Club) in the form either.
3. **Organizer bar on the event detail** (avatar + @username + Follow): v2
   brought it back after Dari's 2026-11-01 "no organizer name at all" call.
   His re-decision is PENDING — don't treat either way as settled.
4. **Design: "Dark Glass" + "Light"** (Dari, 2026-11-08; replaced "Bold Violet 2").
   Two themes, chosen in Profile → Appearance: **Auto** (default, follows
   the phone) / Light / Dark — saved on the device. NOT time/sunset based
   (Dari asked; rejected as surprising). Light = cool gray background
   `#e6e7eb`, WHITE cards, neutral gray borders, purple only on active
   things (Dari rejected all-white and lilac borders). Dark is described
   below. Theme code: palettes in `constants/theme.ts`, provider + hooks in
   `lib/ThemeContext.tsx`; every screen builds styles with
   `makeStyles = (Colors: Palette) => StyleSheet.create(...)` +
   `useThemedStyles(makeStyles)` and reads `useColors()` for inline colors.
   **Never import a palette / hardcode a theme color in a screen** — it
   would not switch. **Accent color = MAGENTA** (Dari, 2026-11-10; it
   replaced purple everywhere — "purple" below means this accent): dark
   `primary #dc5ad8`, `primaryBright #f08ce9`, `border #4a2748`; light
   `primary #b832b4`, `primaryBright #a3279f`. Dark Glass details:
   Near-black background, neutral gray glass surfaces, and **every border
   is a thin purple line**: soft `Colors.border` on ordinary
   edges, bright `Colors.primary` on active/primary ones.
   **Purple is never a fill** — primary buttons, active chips, active tab,
   FAB use `outline(colors)` (surface + purple border). Dari rejected:
   neon glow, gradients, Uber black/white, a left date block on cards, and
   "too much purple" fills. Event card = "design A": purple date line on
   top (`SAT 14 NOV · 23:00`, 24h) + LIVE badge, title, place, footer with
   going count + event-type tag (no names). Icons are inline SVG
   (`components/Icon.tsx`, tab icons in `(tabs)/_layout.tsx`) — no emoji
   in chrome, and icon fonts never rendered in his builds, so don't
   reintroduce them. Google maps use `lib/mapStyle.ts` (dark).
   **Logo: "fyft"** (Dari, 2026-11-10; replaced the 2026-11-08 "fyft.")
   — lowercase letters in Outfit ExtraBold (OFL), letter-spaced +14, ONLY
   in the magenta accent (`Colors.primary`), no dot; stored as SVG outlines
   (`LOGO_PATH`), no font file. In-app `components/Logo.tsx`; icon / adaptive
   foreground / splash / favicon PNGs generated by `scripts/make-logo.js`
   (keep both in sync). Icon/splash backgrounds are `#0b0b0f`.
   App icon = wordmark only, NO frame (2026-11-09: the purple frame was
   clipped by the Android launcher mask into stray lines). Adaptive
   foreground wordmark width 420/1024 so it stays inside the safe circle.
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
6. The `follows` table now holds ORGANIZER follows only (see 8). Notification prefs live
   in their own private table (they hold a saved location), not `profiles`.
7. Internal names stay (`parties` table, `/party/[id]` route, `party_type`
   column) although the UI says "events". No migration for wording.

8. **No friends layer** (Dari, 2026-11-08). Only organizers can be followed;
   nobody can see who is going where. Removed: "friends going" (cards,
   detail, filter chip), Find people, the "Going to" list and following
   count on other profiles. Going counts are numbers only. Profile has
   "My events" + "My plans" (my own going RSVPs, visible only to me).
   `app/people.tsx` = "Organizers" (search only returns accounts with at
   least one event). Do not bring friends back without asking Dari.
9. **Crowd meter, no chat, no "interested"** (Dari, 2026-11-08). Every
   card + the event detail show "N / capacity going" + a label and bar:
   Be the first / Quiet so far / Getting busy / Busy / Almost full / Full
   (`lib/crowd.ts` — thresholds live there; with capacity it is relative
   25/60/90 %, without it fixed 10 / 25 people). Only "Going" exists (the
   button is "I'm going"; reminders only for going). **Capacity is
   required** when creating an event ("How many people can come?", plain
   number, no preset chips — Dari rejected presets). Per-event chat
   removed (`app/chat`, `hooks/useComments` deleted; `comments` table left).
   **Event card = "B"**: big photo on the left (calendar icon when there is
   no photo), date + title + place + crowd meter on the right, no
   description. Videos stay in the app (create + event detail) but are
   NEVER shown on the Events card (Dari, 2026-11-08). The map pin preview uses the
   SAME `PartyCard` (+ ✕ and a "Show more details" button under it), so both always look identical.
10. **New event form = layout "A"** (Dari, 2026-11-10, `app/create.tsx`):
   one screen of grouped cards: big 16:9 cover (first photo/video) + thumb
   strip → name + type → When → Where (address search + mini map) → How
   many (−/+ stepper, steps of 5, still typeable) → About → Publish.
   **No example placeholders** like "Rave, BBQ" (Dari rejected them); SVG
   icons only, no emoji.
11. **Confirm dialogs use `components/ConfirmDialog`** (centered, app
   styled), not the native `Alert` (Dari: it looks ugly). Done for Delete
   event; Report / Sign in / error alerts still use `Alert`. Copy avoids
   jargon ("everyone who said they're going", never "RSVPs").

## Fragile fixes — do not undo

- **MapView renders only while the Map tab is focused** (`useIsFocused`,
  `app/(tabs)/index.tsx`). A live MapView in a detached screen crashes
  Android ("child already has a parent").
- **Realtime channel names have a unique random suffix** per effect run
  (`hooks/useRsvps.ts`) — reusing a subscribed
  channel name throws when the effect re-runs.
- **Map opens instantly on Skopje**; GPS centering runs in the background
  (last-known → Balanced, skipped after user drag). Never gate the map
  behind a location await.
- Parties refetch silently on Map/Events tab focus; `useParties` must not
  flash the spinner once it has data.
- **`<Link asChild>` + `Pressable`: use a plain `style`, never a function
  style** (`({ pressed }) => …`) — Link drops it and the child renders
  unstyled (happened to PartyCard, 2026-11-08).
- **Emoji + text = separate Text nodes** in Android buttons/labels (an
  emoji inside the label's `Text` truncates its end). `PrimaryButton`
  has an `icon` prop for this.

## Setup status

- Supabase: `schema.sql` and all migrations applied, including
  `migration_social_notifications.sql`. Realtime on `rsvps` (`comments` too, but the chat was removed).
- Push: Firebase project created; `google-services.json` in project root
  (local only); FCM V1 service-account key uploaded to EAS; EAS
  `projectId` set in `app.json` (fixed 2026-11-09). Push is sent by a Postgres trigger
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

- **New event form redesign (2026-11-10, JS-only).** tsc + lint pass; not
  yet seen on Dari's phone. Check: cover photo + thumbs, −/+ stepper,
  address search via keyboard "search" key, edit mode still prefills.
- **Magenta accent + new logo (2026-11-10).** Colors/logo in the app are
  JS-only (tsc + lint pass, not yet seen on the phone). The home-screen
  icon, splash and notification color are **native** — they need a new
  dev build to show.
- **Map: no green (2026-11-10, JS-only, Dari picked option 2)** — parks and
  `landscape.natural` (mountains/forests) are a slightly darker gray in
  both map styles (`lib/mapStyle.ts`). Not yet seen on the phone.
- **Styled delete dialog (2026-11-10, JS-only)** — tsc + lint pass, not
  yet seen on the phone.
- Two-account test: follow an ORGANIZER → they publish → push arrives.
  If push fails: `select status_code, content from net._http_response
  order by created desc limit 5;`
- **Tonight tab removed → filter chips (2026-11-08, JS-only).** Tonight /
  Tomorrow / Following are now chips on Events AND Map (friends removed later); the
  Map also got a floating search bar and draws only matching pins. tsc +
  lint pass and Metro bundled it for Android, but not yet confirmed on
  Dari's phone (check: chips over the map are readable, keyboard closes on
  map tap, pin preview still opens). "Today" chip was replaced by "Tonight"
  (05:00 boundary).
- **"Dark Glass" redesign (2026-11-08, JS-only)** — new palette + purple
  outlines app-wide, new event card, Events list grouped by night
  ("Tonight · 2", "Tomorrow", "Sat 14 Nov") when sorted by Soonest,
  pulsing skeleton cards on first load, dark Google map (Map tab + create
  mini-map). tsc + lint pass; NOT yet seen on Dari's phone. Check there:
  dark map style applies, purple borders visible but not loud, avatars on
  cards, the less-touched screens (party detail, create, profile,
  notifications) only got the token swap — may need polish.
- **Event detail redesign (2026-11-08, JS-only)**: photo/video hero that
  fades into the background (own back + Share buttons; stack header hidden
  for `party/[id]`), date line + LIVE, title, type tag, one info block
  (address + Directions, going/capacity bar), "Hosted by" block
  (organizer decision still pending, kept as before), About, owner
  Edit/Delete, Report. an "I'm going" button sits in a dock that stays
  on screen. Share uses RN `Share` (text only, no web link yet). Not yet
  seen on Dari's phone.
- **Light theme + Appearance picker (2026-11-08, JS-only)** — not yet seen
  on Dari's phone. Check both themes on every screen; light map =
  `LIGHT_MAP_STYLE`, dark = `DARK_MAP_STYLE` (`lib/mapStyle.ts`, MapView
  remounts via `key={scheme}` so the switch always applies). "Tonight" chip reads
  "Today" in the daytime (same 05:00 rule as the section headers).
- **Privacy gap (DB):** the app no longer SHOWS who is going, but `rsvps`
  rows (with user ids) are probably still readable through the API by any
  signed-in user (the old friends feature needed that). Tighten RLS so
  users read only their own RSVPs and expose counts via a view/RPC (also
  fixes roadmap 4). Needs a migration — not done.
- **OPEN DECISION — evening-only? (Dari thinking, answer expected
  2026-11-09).** Option A: Fyft = going out in the EVENING only (parties,
  clubs, gigs, concerts, bar nights); soft: default start 21:00, warning
  (not a block) for starts before 17:00; drop the "Daytime/Tonight" split
  and end-time ideas. Option B: all events incl. daytime — then add an
  optional `ends_at` column (exact LIVE, multi-day), split "Today" into
  Daytime / Tonight, add "Happening now". Claude recommended A for launch
  (the empty-party problem is a night problem; easier to fill the app).
  Either way: hide events that are already over (roadmap 2). Do NOT build
  A or B until Dari decides.
- **Open question (Dari, 2026-11-08):** at launch Dari will publish most
  events himself, so they would all show "Hosted by @darijan". Proposed:
  an optional "Host / venue name" on the event (new `parties.host_name`
  column + form field), shown instead of the account. Not decided/built.
- **EAS `projectId` fixed (2026-11-09):** `eas init --account darijan10`
  linked the EXISTING project `4ed63e10-2f8b-4bab-9bdc-258a4438c9c8`
  (`app.json` → `extra.eas.projectId`, `owner: darijan10`). Push needs the
  new dev build to be installed before it can be verified.
- **New logo (2026-11-08)**: in-app wordmark is JS-only (Events + Map
  headers). The home-screen icon, adaptive icon and splash are **native**
  — they only change after the next `eas build --profile development`
  (batch with `expo-dev-client` + haptics).
- Haptics (RSVP / chip taps) proposed — `expo-haptics` is **native**;
  batch with the next dev build (together with `expo-dev-client`).
- Google Cloud budget alert — not set up yet.
- `expo-dev-client` added 2026-11-09 (`npx expo install`), part of the
  2026-11-09 dev build. Build started 2026-11-09:
  https://expo.dev/accounts/darijan10/projects/fyft/builds/cd7f22da-fda1-41d4-bd34-e242dca94951
  (includes new icon/splash, expo-dev-client, projectId; NOT haptics).
  After installing it: verify icon, splash, push (two-account test).
  Second build 2026-11-09 (icon without frame):
  https://expo.dev/accounts/darijan10/projects/fyft/builds/16b081b9-c284-4e94-9a98-20e2b31b837b
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
3. Capacity is required in the create form but only visual: it drives the
   crowd meter, and the DB does not block RSVPs over capacity (column is
   still nullable for old events).
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

