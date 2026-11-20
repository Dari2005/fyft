# Fyft — Project State

> Read this first, before doing any work. Update it at the end of every session
> if anything below changed. Keep it short and factual. **Never put secrets
> here** (this repo is public).

_Last updated: 2026-11-20 (GitHub Pages on; account deletion, forgot password, privacy page; venues; design fixes; design + accessibility review; smart notifications; trust: verified, auto-hide, confirmed email; share links; README rewritten; security review of the privacy migrations: no findings)_

## What this is

**Fyft** — a mobile app (Android first, iOS later) for nights out in Skopje
(parties, live music, kafana nights — evening only, re-confirmed 2026-11-15,
see decision 12): map, event list,
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
   (Dari, 2026-11-01). The `party_ratings` table is an unused leftover with NO API access
   (closed 2026-11-15, `migration_close_leftovers.sql`) (the
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
   `primary #b832b4`, `primaryBright #a3279f`.
   2026-11-10: Dari looked at full redesigns (photo-first, timeline, grid,
   swipe, tickets, poster, "Heat", Instagram-style black/white) and chose
   to KEEP the current design for now. Don't redesign unasked.
   Dark Glass details:
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
   **Logo update 2026-11-15 — "2C", crowd bar:** the same wordmark plus the
   app's crowd meter under it, cut in two by the tail of the "y" (left
   piece full, right piece a `Colors.track` bar filled part-way). Numbers
   live in `LOGO_BAR` (`components/Logo.tsx`) and are repeated in
   `scripts/make-logo.js`; the logo's width/height did not change. Dari
   picked it from sketches (he passed on: three bars, monogram f, pin,
   y-as-a-person, moon, two circles, stacked/outlined/slanted letters).
   Icon / adaptive foreground / splash / favicon PNGs were regenerated —
   **native: they show only after the next build.** Claude's caveat: at
   launcher-icon size the bar is a pixel or two, so the icon is no more
   readable than before.
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
   removed (`app/chat`, `hooks/useComments` deleted; `comments` table left,
   with NO API access since 2026-11-15 — `migration_close_leftovers.sql`).
   **Event card = "B"**: big photo on the left (calendar icon when there is
   no photo), date + title + place + crowd meter on the right, no
   description. Videos stay in the app (create + event detail) but are
   NEVER shown on the Events card (Dari, 2026-11-08). The map pin preview uses the
   SAME `PartyCard` (+ ✕ and a "Show more details" button under it), so both always look identical.
10. **New event form = layout "A"** (Dari, 2026-11-10, `app/create.tsx`):
   one screen of grouped cards: big 16:9 cover (first photo/video) + thumb
   strip → name → category → When → Where (address search + mini map) → How
   many (−/+ stepper, steps of 5, still typeable) → About → Publish.
   **No example placeholders** like "Rave, BBQ" (Dari rejected them); SVG
   icons only, no emoji.
11. **Confirm dialogs use `components/ConfirmDialog`** (centered, app
   styled), not the native `Alert` (Dari: it looks ugly). Done for Delete
   event; Report / Sign in / error alerts still use `Alert`. Copy avoids
   jargon ("everyone who said they're going", never "RSVPs").

12. **Evening-only, three fixed categories** (Dari, 2026-11-14): every
   event is **Party** (clubs, discos, bars with a DJ, house parties),
   **Live music** (concerts, gigs, jazz, rock) or **Kafana** (kafana night
   with live music). Rule: an event = something special happens that night,
   not a venue simply being open. Stored in `parties.party_type` as
   `party|live|kafana` (`lib/categories.ts`); old free-text values count as
   Party — no SQL needed. Required in the create form (3 buttons, no free
   text); filter on Events + Map; label + icon on the card and event
   page. Dari rejected merging Live music + Kafana (different crowds) and a
   separate "Bar night" (overlaps Party).
   **Re-confirmed 2026-11-15:** Dari weighed "all events in Skopje, crowd
   count only for parties" and chose to stay evening-only after seeing the
   competition: **Happens.mk** (Play + App Store, released 2026-10-06, 100+
   installs) already does "all Skopje events on a map" (music, theatre,
   exhibitions, workshops; date/category/neighborhood filters, saved events,
   MK/EN). Fyft's difference is the going count + crowd meter, so it stays
   "where is it busy tonight". Don't re-propose all-events without new facts.
   **Label renamed "Kafana" → "Kafana night"** (Dari, 2026-11-15; he
   disliked the bare name, not the category). Only the label in
   `lib/categories.ts` changed; the stored key stays `kafana`. JS-only; seen
   in the browser Type menu, not yet on the phone (check that the three
   category buttons in New event still fit on one row).

13. **Filters = ONE row of dropdowns, no sideways scrolling** (Dari,
   2026-11-14; `components/Dropdown.tsx`): When ▾ (Any time / Tonight /
   Tomorrow / This weekend), Type ▾ (All types / Party / Live music /
   Kafana + an "Only organizers I follow" checkbox inside — Dari's choice;
   Claude warned it hides Following), and on Events a Sort ▾ (Soonest /
   Near me / Most going). A pill turns magenta when not on its default.
   Map stays as it is (Dari, 2026-11-14): no Sort on the map, and he
   rejected count/crowd-colored pins + a my-location button. Plain magenta
   pins; don't re-propose unasked.
   The map filter row ends with a count of matching pins ("12 events",
   Dari chose option A 2026-11-14; events without a location are not
   counted).
   Tapping a pin zooms in a little (`PIN_ZOOM_DELTA` 0.035, never zooms
   out) and puts the pin above the middle so the preview card does not
   cover it (Dari, 2026-11-14).

14. **Design + accessibility review fixes** (Dari approved, 2026-11-14; no
   redesign, only fixes):
   - **"I'm going" is always the bright `outline()` button** — it was the
     quietest button on the event page. "You're going" = check + magenta
     text. Never give it the soft border again.
   - **Over events are hidden** from Events + Map (`isOver` in
     `lib/tonight.ts`, applied in `makeEventMatcher`): over = after the
     05:00 cutoff following the start (never sooner than start + 4 h).
     Profile lists are untouched. The event page of an over event shows a
     disabled "This event is over" instead of "I'm going".
   - Crowd meter: new palette token `track` (the empty bar was invisible on
     `surface`); the card says "0 / 30 going" like the event page.
   - Touch targets ≥ 44: filter pills (`PILL_SLOP` touch padding in
     `Dropdown`, the filter row has matching padding — keep them in sync),
     Back/Share (44 touch area around the 38 circle), Directions/Follow
     (`hitSlop`).
   - Screen reader: one spoken sentence per event card, roles/states on
     filter pills, menu items, the follow checkbox, category buttons,
     Follow, "I'm going"; labels on the map "+" and hero photos.
   Second round (Dari approved "1–4", 2026-11-14):
   - **Address from the pin:** tapping the mini map in New event drops the
     pin and fills the address field from it (`dropPin`, Photon
     `/reverse`, no key — same service as the address search). It never
     overwrites text the organizer typed, only an empty field or its own
     earlier suggestion. **An address or a pin is now required** to
     publish/save.
   - **Sign-in before New event:** the map "+" goes to `/auth` when signed
     out (like the Events button), and `/create` itself shows a "Sign in to
     publish an event" screen instead of the form.
   - Light theme `success` `#167a3b` and `warning` `#8f5f0a` (were 3.3:1 and
     3.6:1 on white; now ≥ 4.5:1). Dark theme unchanged.
   - Unselected category buttons use `textSoft`, not `muted`.
   Third round (Dari saw sketches A–D and said "do all", 2026-11-14):
   - **A — empty Events with a next step:** an empty Tonight / Tomorrow /
     This weekend shows "Nothing tonight yet · 3 events this weekend" + a
     button that switches the When filter (weekend first, else "See all
     events"). No suggestion → the old empty text.
   - **B — no native `Alert` anywhere:** `lib/DialogContext.tsx`
     (`DialogProvider` in `app/_layout.tsx`, `useDialog()` → `notify` /
     `ask` / `choose`). Report is a list of reasons + "Send report";
     sign-in prompts and errors use it too. Its main button is `outline()`
     (magenta is never a fill). `ConfirmDialog` stays for the red Delete.
     **Never add `Alert.alert` again.**
   - **C — card text:** date 12, place 13, count 21 / 13, crowd label 13,
     bar 6 px; the count row wraps instead of cutting the label.
   - **D — host name:** optional "Who is hosting?" field in New event →
     `parties.host_name` (≤ 60). The event page shows it as the headline of
     "Hosted by" with "Posted by @account" under it; Follow still follows
     the account. Search matches it. Column added (`migration_host_name.sql` run 2026-11-15). This settles the
     old "Hosted by @darijan" open question.
   - Bug found on the way: "This weekend" matched ANY Saturday/Sunday, even
     weeks ahead (`isWeekend` in `lib/eventFilters.ts`). Now only this
     weekend's Saturday + Sunday.
   Still open from the review (Claude advised against the first two):
   control borders are below 3:1 (fixing it would change the Dark Glass
   look); map pins have no screen-reader name (a marker title would open a
   callout on Android); "@" in front of a display name (goes away with the
   host-name idea below).

15. **Account first, Google sign-in** (Dari, 2026-11-15):
   - **First open:** `FirstOpenGate` (`app/_layout.tsx`) pushes
     `/auth?welcome=1` once per install when nobody is signed in
     (AsyncStorage `fyft.welcomed`). Dari asked for "an account right
     away"; Claude added a **"Look around first"** way out because a hard
     wall before any content loses first-time visitors. It is one block in
     `app/auth.tsx` (`isWelcome`) if Dari wants it gone.
   - **`app/auth.tsx` redone:** logo, "Create your account" / "Welcome
     back", "Continue with Google" on top, email below. **No emoji, no
     example placeholders.** Opens on "Create account" until this device has
     signed in once (`fyft.hasAccount`), then on "Sign in". After signing in
     it goes BACK to where the person was (the event), not to the map.
   - **Google:** `signInWithGoogle` in `lib/AuthContext.tsx` — Supabase
     OAuth through `expo-web-browser`, returning on `fyft://auth-callback`
     (`app/auth-callback.tsx` only keeps that link from opening "not
     found"). No new package, so JS-only. **Set up and working on Dari's
     phone (2026-11-15).** Google Auth Platform is still in "Testing", so
     only the Gmail accounts listed under Audience → Test users can sign in;
     "Publish app" there before real users come. Setup that was done: (1) Google Cloud → OAuth client (type Web) with redirect
     `https://<project-ref>.supabase.co/auth/v1/callback`; (2) Supabase →
     Auth → Providers → Google: paste client ID + secret, enable; (3)
     Supabase → Auth → URL Configuration → Redirect URLs: add `fyft://**`.
     Google accounts get `profiles.username` = the part of their email
     before "@". **Taken names (2026-11-15):** the `handle_new_user` trigger
     adds a number (dari, dari2 …, case-insensitive) instead of failing the
     sign-up, and email sign-up checks the typed username first ("That
     username is taken"). `migration_unique_username.sql` run 2026-11-15.
   - Also: the bell emoji on the signed-out Notifications screen is now the
     SVG bell icon.

16. **RSVPs are private** (Dari, 2026-11-15; design `docs/designs/private_rsvps.md`,
   made with the EGM brainstorm/draft flow). Each user reads only their own
   `rsvps` rows — **organizers too: they see the number, never names**.
   Going counts come ONLY from `party_counts` (numbers, no user ids; kept by
   the `sync_party_counts` trigger, +1/−1; `select public.reconcile_party_counts();`
   in the SQL editor repairs drift). The app reads it through
   `lib/goingCounts.ts`. **Never re-add public read on `rsvps`, never put
   `rsvps` back in Realtime** (Supabase skips RLS for DELETE events, so
   cancellations would leak user ids), never count `rsvps` for a shown number.
   Same rule for the leftovers `comments` and `party_ratings`: no grants, no
   policies, not in Realtime (they held who commented on / rated what). A
   feature that brings either back needs its own migration and Dari's OK.
   **`follows` is private too** (Dari, 2026-11-15): each user reads only the
   follows they made; follower numbers come from the RPC
   `follower_count(profile_id)` (`fetchFollowerCount` in
   `lib/SocialContext.tsx`). `notify_new_party` is security definer and
   still sees all followers. Still public on purpose: `profiles`, `parties`,
   `party_counts`.

## Fragile fixes — do not undo

- **MapView renders only while the Map tab is focused** (`useIsFocused`,
  `app/(tabs)/index.tsx`). A live MapView in a detached screen crashes
  Android ("child already has a parent").
- **Live counts listen to `party_counts`, not `rsvps`** (`subscribeGoingCount`
  in `lib/goingCounts.ts`). Never embed `party_counts` in the `parties`
  select — if the table were missing the whole list would fail.
- **Realtime channel names have a unique random suffix** per effect run
  (`lib/goingCounts.ts`) — reusing a subscribed
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
  `migration_social_notifications.sql`, `migration_host_name.sql` and
  `migration_unique_username.sql` (both run by Dari 2026-11-15; `host_name`
  confirmed through the API) and `migration_private_rsvps.sql` (run by Claude
  in the SQL editor in Dari's Chrome, 2026-11-15). Realtime publication =
  `party_counts` only (`rsvps` taken out; `comments` taken out by
  `migration_close_leftovers.sql`, run by Claude 2026-11-15).
  `migration_private_follows.sql` run by Claude 2026-11-15 (follows: read
  own; anon has no access; `follower_count()` RPC).
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

- **Play Store blockers (2026-11-20, JS-only + `migration_delete_account.sql`,
  run by Claude)** — Delete account: `delete_my_account()` (security
  definer, deletes `auth.uid()` only, execute for authenticated only); the
  app first removes the user's files in `party-media/<uid>/`, then calls it,
  then signs out locally. Profile footer: "Privacy policy · Delete account"
  (ConfirmDialog, destructive). Forgot password: link on Sign in →
  `resetPasswordForEmail` with redirect `fyft://reset-password` (allowed by
  `fyft://**`), new `app/reset-password.tsx` reads tokens from the link,
  sets the session, saves the new password; the message never reveals
  whether the email exists. Pages: `docs/privacy/`, `docs/delete-account/`
  (`lib/legal.ts`), linked from Profile (signed in and out) and sign-up.
  Checked: rolled-back SQL test (auth user, profile, events, push tokens,
  follows gone; other user kept; anon → permission denied), browser (sign-up
  legal line, "Forgot password?" with empty email → message, expired-link
  screen). tsc + lint pass. NOT verified: a real reset email → app on the
  phone, deleting a real account in the app (Storage cleanup), the pages
  online: live since 2026-11-20 (GitHub Pages on). Privacy text decision to confirm with Dari:
  "meant for 18 and over".

- **Venues (2026-11-20, JS-only + `migration_venues.sql`, run by Claude in
  Dari's Chrome)** — Decision (Dari, 2026-11-20): people follow VENUES
  (Stanica 26, Ciao), not the account that lists them. A venue is not an
  account; Dari manages venues in the SQL editor; `organizer_id` and
  `venue_id` stay independent. Only verified organizers may pick a venue
  (DB guard), so nobody can push a fake party "at Stanica" to its followers.
  Later, venue owners get access only when Dari approves them (future
  `venue_members`; not built). Event page: "Venue" box with Follow (venue)
  + "Listed by Fyft"; the old "Hosted by"/host_name stays for events without
  a venue. Cards show the venue name; search and the Following filter include
  venues. New event: venue search (verified only) fills address + pin.
  Push: notify_new_party adds venue followers ("New event at <venue>"), one
  push per person. Checked: rolled-back SQL test (venue follower count 2;
  verified insert with venue ok; unverified with venue refused, without ok;
  client insert into venues refused; a user sees only own follow rows; push
  queue: venue followers got "New event at TEST Venue", organizer follower
  got "@… posted", the person following both got ONE push), anon API
  (venue_followers and venue insert → 401), browser at 375 px with a
  temporary venue + event (card, event page, venue page; deleted after).
  tsc + lint pass. NOT verified: the New event venue picker (needs sign-in),
  Follow venue tapping (needs sign-in), a real push on the phone, two
  unexplained 404s in the browser console on the venue page. No real venues
  exist yet — Dari must add them.
- **Design fixes (2026-11-20, a14dd44, JS-only)** — findings 1–5 of the
  review below fixed (category icon on photo-less cards, one-line category,
  `inputBorder` color 3:1 on fields and search, no Follow next to a host
  name, single-person icon). Finding 6 was not a problem (Follow has
  hitSlop 8).

- **Design critique + accessibility review (2026-11-20, no code changed)** —
  browser preview at 375 px, dark and light, with 2 temporary
  "DESIGN TEST" events (inserted with fake counts, then deleted). Text
  contrast passes AA in both themes (muted 5.6–6.1:1 dark, 4.8–5.9:1 light).
  Open findings, not fixed yet: (1) on the event page a host name shows
  "Stanica 26 · Follow" but Follow follows the posting account, not the
  venue; (2) text-field and search borders are 1.2–1.5:1 (WCAG 1.4.11 wants
  3:1 for input edges); (3) card category "Live music" wraps to two lines
  and squeezes the place; (4) cards without a photo spend a third of the width
  on a calendar icon; (5) signed-out Profile uses the two-people icon (reads
  as "friends"); (6) Follow button 84x31 and Directions 96x28 (Directions has
  hitSlop; Follow compact to check). Signed-in screens (Profile, Create,
  Notifications) were not seen — needs Dari signed in.

- **Smart notifications (2026-11-16, JS-only + `migration_smart_notifications.sql`,
  run by Claude in Dari's Chrome)** — new `notification_prefs` columns
  `busy_enabled` (default on), `busy_threshold` (50/75/90, default 75),
  `changes_enabled` (default on); internal `party_alerts` (once per
  event+threshold, RLS on, no grants); `push_to_users()`; triggers
  `notify_party_busy` (party_counts: going users, organizer's followers who
  are not going, and the organizer, each at their own threshold) and
  `notify_party_changed` (parties: new time / new place / cancelled → going
  users with changes on, never the organizer). Skips hidden events and events
  over 4 h past the start. Notifications screen: two toggles + threshold
  chips; saving retries without the new columns if missing. Checked by a
  rolled-back SQL test reading `net.http_request_queue`: 25 % → no push,
  50 % → the 50 % user, crossing 50 % again → nothing, 75 % → going user +
  follower, title-only edit → nothing, new time / new place / delete → going
  user with changes on (the one with changes off got none). tsc + lint pass.
  NOT verified: a real push arriving on the phone, the settings screen on the
  phone (needs sign-in; not looked at in the browser), the organizer's "your
  event is getting busy" push (Dari's account had no push token in the test).
  Decision (Claude, 2026-11-16): one threshold per user rather than three
  switches, so a follower gets at most one "busy" push per event.
- **Trust (2026-11-16, JS-only + `migration_trust.sql`, run by Claude in
  Dari's Chrome)** — `profiles.is_verified` (badge on PartyCard, event page
  host line, organizer page; read via `lib/verified.ts` in its own query so
  the app survives a missing column), `parties.hidden_at` (auto-set after 3
  reports by `reports_auto_hide`, not for verified organizers; "public read"
  now = `hidden_at is null or own`; organizer sees a notice), DB refuses a new
  event from an unconfirmed account (`guard_party_write` +
  `current_user_confirmed()`). Clients cannot set `is_verified`/`hidden_at`
  (invoker guard triggers keyed on `current_user`). Checked: rolled-back SQL
  test (2 reports → visible, 3 → hidden; other user sees 0, organizer 1;
  organizer un-hide and self-verify both blocked; confirmed user can post,
  unconfirmed gets "Confirm your email before posting events."), anon API
  (verified list readable, `rpc/current_user_confirmed` → 401), browser
  (badge on event page + organizer page, no console errors). Dari's account
  (the only real user) set `is_verified = true`. NOT verified: the badge
  inside the card title on the phone (Svg nested in Text; no upcoming event to
  look at in the browser), the hidden notice on screen. Moderation is manual:
  list hidden events with
  `select id, title, hidden_at from parties where hidden_at is not null`.
- **Share links (2026-11-16, JS-only + static page)** — the existing Share
  button now sends title, date, venue (host name, address) and
  `https://dari2005.github.io/fyft/e/?id=<id>` (`lib/shareLink.ts`). The page
  `docs/e/index.html` validates the uuid, opens the app via an Android
  `intent://` link (fallback back to the page with `noapp=1`) or `fyft://`
  elsewhere, else shows "Fyft is not on this phone". tsc + lint pass; page
  states checked in the browser at phone width. NOT done/verified: GitHub
  Pages turned on 2026-11-20 by Claude in Dari's Chrome (main, /docs; pages return 200); link →
  app on the phone; that the first-open sign-up screen does not hide the
  event. Of the 4-feature prompt Dari chose only Share (Who's Going broke
  decision 8/16; smart notifications and venue profiles left for after launch).
- **Private follows (2026-11-15, JS-only + SQL, run)** — tsc + lint pass;
  checked: anon read of `follows` → permission denied, `follower_count` RPC
  → 200, policies in SQL, organizer profile in the browser shows
  "0 followers" from the RPC. NOT checked (only one account exists): a
  count above 0, Follow/Unfollow + the "Only organizers I follow" filter on
  the phone, and the follow push (two-account test, already listed below).

- **Private RSVPs (2026-11-15, JS-only + `migration_private_rsvps.sql`, run
  2026-11-15)** — tsc + lint pass. Checked: SQL editor (publication =
  `comments, party_counts`, no `rsvps`; `rsvps` policies = read own
  [authenticated] + insert/update/delete own; `party_counts` grants =
  SELECT only; counts match `rsvps`; a rolled-back trigger test went
  0 → 1 → 0 (interested) → 1 → 0 (deleted)), API with the anon key
  (`rsvps` → `[]`; `party_counts` insert/patch and
  `rpc/reconcile_party_counts` → 401), browser preview (counts come from
  `party_counts`). **Dari confirmed on the phone (2026-11-15): "it works"**
  (the checks given were: "I'm going" 0 → 1 → 0, live count on a second
  device, My plans, the reminder). Still unchecked: deleting an event that
  has "going", the follow push. A signed-in API read of
  `rsvps` was not tested (no test account); the policy itself was checked.
- **Account first + Google (2026-11-15, JS-only)** — tsc + lint pass. Seen
  in the browser: the welcome screen appears on a fresh install, "Look
  around first" closes it, it does not come back. **Google sign-in works on
  Dari's phone (2026-11-15).** Still unseen: the welcome screen on the
  phone, email sign-up → going back to the event, and a Google account
  whose email prefix is already a taken username (fix and migration in place, not yet tested). Note: Supabase has email
  confirmation ON, so email sign-ups must confirm before the first sign-in.

- **Review fixes (2026-11-14, JS-only)** — tsc + lint pass and checked in
  a browser (web preview, both themes); not yet seen on the phone and not
  tested with TalkBack. Check: filter pills still open their menu right
  under the pill, Back/Share sit where they were, "I'm going" stands out.
  In the browser the capacity stepper pushed "+" off-screen — may be
  web-only; check on the phone.
- **Third round, A–D (2026-11-14, JS-only + one SQL migration)** — tsc +
  lint pass. Seen in the browser: the empty Events suggestion, the Report
  dialog, the two sign-in dialogs, the bigger card text. NOT seen: host
  name (form field, saving, the event page — the column exists since
  2026-11-15, nobody has saved one yet), and every dialog that needs a
  signed-in user or a phone (report sent, location/photo permission,
  notification settings). Dialogs were not checked on Android at all.
- **Second round (2026-11-14, JS-only)** — tsc + lint pass. Seen in the
  browser: the sign-in screen on `/create` and the map "+" going to
  `/auth`. NOT seen anywhere (the form needs a signed-in user): the address
  filling in after a map tap, the "add where it is" error, the category
  buttons, the new light-theme green/amber. Check all four on the phone.

- **Dropdown filters (2026-11-14, JS-only)** — tsc + lint pass, Metro
  bundled for Android; not yet confirmed on the phone (check the menu opens
  under the pill, also over the map).
- **Categories (2026-11-14, JS-only)** — tsc + lint pass, not yet seen on
  the phone.
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
- **DECIDED 2026-11-14: Option A, evening-only.** (Start-time rule: Dari
  2026-11-14 chose NO block and NO warning for now — any start time is
  allowed; evening-only is a content rule, kept by who posts. Revisit if
  daytime events start appearing; Claude suggested a block before 16:00.) Option A: Fyft = going out in the EVENING only (parties,
  clubs, gigs, concerts, bar nights); soft: default start 21:00, warning
  (not a block) for starts before 17:00; drop the "Daytime/Tonight" split
  and end-time ideas. Option B: all events incl. daytime — then add an
  optional `ends_at` column (exact LIVE, multi-day), split "Today" into
  Daytime / Tonight, add "Happening now". Claude recommended A for launch
  (the empty-party problem is a night problem; easier to fill the app).
  Either way: hide events that are already over (roadmap 2). Do NOT build
  A or B until Dari decides. → Dari chose A.
- **Open question (Dari, 2026-11-08):** at launch Dari will publish most
  events himself, so they would all show "Hosted by @darijan". Proposed:
  an optional "Host / venue name" on the event (new `parties.host_name`
  column + form field), shown instead of the account. → Built 2026-11-14
  (decision 14, "D"); column added 2026-11-15.
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
  Third build 2026-11-10 (magenta accent, new "fyft" icon/splash):
  https://expo.dev/accounts/darijan10/projects/fyft/builds/873cb9dd-b7cc-4627-ae9a-507c76a22856
  Fourth build 2026-11-15 (logo with crowd bar on icon/splash; started by
  Claude at Dari's request, no haptics, no Expo update):
  https://expo.dev/accounts/darijan10/projects/fyft/builds/df4547b6-81b7-42e5-8ce7-4383b563043b
  After installing: check the icon/splash, and that the map is not black
  (the CLI reported no plain/sensitive EAS env vars for "development"; the
  Maps key is expected as a secret-visibility `GOOGLE_MAPS_API_KEY`).
- `npm install` (2026-11-08) reports 23 audit vulnerabilities (6 high) and
  `expo` 57.0.29 → ~57.0.32 available (`npx expo install --check`). Not
  addressed yet.

## Local environment notes (Windows PC)

- PowerShell execution policy blocks `npx.ps1`. Use `npx.cmd …` in
  PowerShell (or run from cmd / Git Bash) instead of changing the policy.
  Dev server: `npx.cmd expo start --dev-client` (Metro on :8081).
- **Browser preview of the app** (Dari asked for it, 2026-11-14):
  `npx.cmd expo start --web --port 8081` → http://localhost:8081 (in the
  Claude desktop app: preview config `fyft-web` in `.claude/launch.json`).
  It works because `app.json` has `web.output: "single"` (`"static"`
  crashed on server rendering: Supabase/AsyncStorage → `window is not
  defined`) and `metro.config.js` swaps `react-native-maps` and
  `expo-notifications` for stand-ins from `scripts/web-preview/` **on web
  only** — Android/iOS bundles are unchanged. Limits: the map is a flat
  gray placeholder (pins are tappable but not at real positions), no
  notifications, pickers/camera behave like a browser. Good for looking at
  layout and both themes; it does NOT replace checking on the phone.

## Known limitations / roadmap

1. **House-party safety** (top priority before public launch): exact address
   is public. Plan: approximate area until organizer approves, 18+ option,
   verification.
2. ~~Past events are not pruned~~ — done 2026-11-14 (decision 14); the rows
   stay in the DB, they are only hidden client-side.
3. Capacity is required in the create form but only visual: it drives the
   crowd meter, and the DB does not block RSVPs over capacity (column is
   still nullable for old events).
4. ~~`usePartyStats` loads all "going" rows client-side~~ — done 2026-11-15
   (`party_counts`, decision 16).
5. Moderation is manual (reports table); ~~auto-hide after N reports~~ done
   2026-11-16 (`migration_trust.sql`, 3 reports).
8. ~~Launch blockers found 2026-11-20~~ built the same day (account
   deletion, privacy policy, forgot password) — see "Not verified yet".
   Still open: the contact email on both public pages (Dari is making a
   separate Fyft Gmail), and Supabase Auth "Site URL"
   is still `http://localhost:3000`, so the sign-up confirmation email lands
   on a dead page after confirming (the account IS confirmed). Fix: set Site
   URL to `https://dari2005.github.io/fyft/` (Dari's call; dashboard setting).
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
- Update `README.md` when setup, structure, the migration list or features
  change (rewritten 2026-11-16 after going stale since 11-08; it had told
  readers to add `rsvps` to Realtime and paste keys into `app.json`). New
  migrations go at the end of its numbered run order.
- Security review of the privacy migrations (2026-11-16, `/security-review`):
  no exploitable findings. It caught `$` instead of `$$` in
  `migration_social_notifications.sql` (`follower_count`), fixed in 4625ba0;
  the live DB was not affected.

