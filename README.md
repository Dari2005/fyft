# Fyft

A mobile app (Android first, iOS later) for nights out in Skopje: parties,
live music and kafana nights on a map and in a list, with a crowd meter that
shows how many people are going. Built with **React Native (Expo SDK 57)** +
**TypeScript** and **expo-router**; the backend is **Supabase** (Postgres,
Auth, Row Level Security, Realtime, Storage).

**Privacy rule:** going counts are numbers only. Nobody can see who is going
where, and there is no friends layer. RSVPs, follows and the old comments are
private at the database level (see `docs/designs/private_rsvps.md`).

Current status, standing product decisions and what is still unverified live
in [`PROJECT_STATE.md`](PROJECT_STATE.md). Coding rules for AI assistants are
in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

## What the app does

- **Map** (landing tab) and **Events** list, sharing one filter bar: Tonight,
  Tomorrow, This weekend, category (Party / Live / Kafana night), Following.
  A night ends at 05:00; an event counts as live for 4 h after it starts and
  disappears once it is over.
- **Event page:** photos and videos, host name, address, crowd meter based on
  the going count and capacity, "I'm going" (updates live for everyone).
  **Share** sends the name, date, venue and an https link
  (`https://dari2005.github.io/fyft/e/?id=<id>`). That page, `docs/e/index.html`
  on GitHub Pages, opens `fyft://party/<id>` in the app or shows a fallback.
- **Create / edit an event:** pin on the map, address search, category,
  capacity, media. Max 3 new events per user per day (enforced in the database).
- **Follow organizers** and get a push when they publish; push for new events
  near you; local reminder 1 h before an event you are going to.
- **Profile:** your plans (private), your events, appearance (light / dark),
  notification settings. Sign in with email/password or Google.
- **Trust:** organizers verified by Fyft get a badge on their events and
  profile (set only in the SQL editor:
  `update profiles set is_verified = true where username = '...'`). An event
  reported by 3 different users is hidden for everyone except its organizer
  until it is restored (`update parties set hidden_at = null where id = '...'`);
  verified organizers' events are never auto-hidden. Publishing needs a
  confirmed email, enforced in the database.
- **Report** an event (reviewed in the Supabase dashboard).

## Project structure

```
app/                      expo-router routes
  (tabs)/index.tsx        Map (landing tab)
  (tabs)/list.tsx         Events list
  (tabs)/profile.tsx      Profile
  party/[id].tsx          event page
  create.tsx              new / edit event (?edit=<id>)
  auth.tsx, auth-callback.tsx   sign in / sign up, Google OAuth return
  user/[id].tsx           organizer page (follower count + upcoming events)
  people.tsx              find / manage organizers you follow
  notifications.tsx       notification settings
  _layout.tsx             providers: theme, auth, follows, dialogs
components/               shared UI (PartyCard, EventFilterBar, Icon, Logo, ...)
hooks/                    useParties, usePartyStats, useRsvps
lib/                      Supabase client, contexts, filters, time logic,
                          crowd levels, categories, going counts
constants/theme.ts        light and dark palettes
supabase/                 schema.sql + migration_*.sql
scripts/make-logo.js      renders icon / splash / favicon PNGs
scripts/web-preview/      stubs for the browser preview (maps, notifications)
docs/designs/             design documents
docs/e/index.html         share-link landing page (GitHub Pages)
```

## Setup

### 1. Supabase

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run `supabase/schema.sql`, then the migrations in this
   order (each is safe to run again):
   1. `migration_party_type.sql`
   2. `migration_media.sql` (also creates the public `party-media` bucket)
   3. `migration_no_venue.sql`
   4. `migration_ratings_chat_media.sql`
   5. `migration_social_notifications.sql` (follows, push tokens, push trigger)
   6. `migration_host_name.sql`
   7. `migration_unique_username.sql`
   8. `migration_private_rsvps.sql`
   9. `migration_close_leftovers.sql`
   10. `migration_private_follows.sql`
   11. `migration_trust.sql` (verified organizers, auto-hide after 3 reports,
       confirmed email required to publish)
3. **Realtime:** only `party_counts` should be in the `supabase_realtime`
   publication (the migrations set this up). Never add `rsvps`, `follows` or
   `comments`: Realtime does not apply RLS to DELETE events, so it would leak
   who is going where.
4. For Google sign-in: enable the Google provider in Authentication →
   Providers and add `fyft://auth-callback` to the redirect URLs.

### 2. Local config (never commit these, the repo is public)

- Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).
- Put the Google Maps API key (Maps SDK for Android enabled) in
  `google-maps-key.local` (see `maps-key.txt.example`). On EAS it comes from
  the `GOOGLE_MAPS_API_KEY` environment variable. `app.config.js` injects it;
  do not paste keys into `app.json`.

### 3. Share links (GitHub Pages)

In the GitHub repo: Settings → Pages → Deploy from a branch → `main`, folder
`/docs`. Without this, shared links show GitHub's 404 page (the event details
are still in the message text). If the repo is forked or renamed, change
`SHARE_PAGE_URL` in `lib/shareLink.ts`.

### 4. Run it

```bash
npm install
npx expo start --dev-client
```

The app needs a **development build** (Google Maps and push notifications do
not work in Expo Go). Build one when native code changes (new native package,
`app.json` plugins, icon / splash):

```bash
npx eas-cli@latest build --profile development --platform android
```

Push on Android needs FCM credentials (Firebase project for
`com.dari2005.fyft`, uploaded with `eas credentials`). Local reminders work
without it.

On Windows PowerShell use `npx.cmd` instead of `npx`.

### Browser preview

```bash
npx expo start --web --port 8081
```

Good for checking layout and data. The map is a gray placeholder; Google
sign-in, push and native pickers do not work in the browser.

## Checks

There is no test suite. Before calling a change done:

```bash
npx tsc --noEmit
npx expo lint
```

Then look at it in the browser preview and on the phone.

## Out of scope for now

Ticket sales and payments, a friends layer, daytime events.
