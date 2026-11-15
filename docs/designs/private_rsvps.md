# Private RSVPs with Numbers-Only Going Counts

*   **Author:** Darijan Risteski
*   **Status:** Approved (Dari, 2026-11-15: "do everything"). The formal `/egm:egm-review` was not run: only Dari can start EGM skills, and he chose to go straight to building.
*   **Implemented:** 2026-11-15 (migration run, legacy fallback removed).
*   **Date:** 2026-11-15

--------------------------------------------------------------------------------

## Overview

Fyft tells people how many others are going to an event, and promises that
nobody can see *who* is going. The app keeps that promise on screen, but the
database does not. This design makes each user's RSVPs readable only by that
user. Going counts move to a separate table that holds only numbers. The
event page still updates live, and the list and map stop downloading every
RSVP just to count them.

## The Problem

The `rsvps` table stores one row per person per event: `party_id`, `user_id`,
`status`. Its read policy is `"rsvps: public read" using (true)`
(`supabase/schema.sql`). The anon key ships inside the app and the repo is
public. So anyone can call the Supabase REST API, with no account, and get a
list of which user goes to which event. A check on 2026-11-15 with the anon
key returned HTTP 200 for `GET /rest/v1/rsvps`. The table was empty at that
time, so nothing has leaked yet. It will start leaking with the first real
users.

The policy is a leftover from the removed "friends going" feature. The app
still depends on it in two places:

*   **Counting.** `hooks/useRsvps.ts` counts the going rows for one event.
    `hooks/usePartyStats.ts` downloads every going row of every event and
    counts them in the app (roadmap item 4). This gets slower as RSVPs grow.
*   **Live updates.** The event page subscribes to Supabase Realtime changes on
    `rsvps` and re-counts on every change. Realtime only sends a viewer the
    rows that viewer may read. Once other people's rows are hidden, the page
    would stop seeing their RSVPs.

Tightening the read policy alone has two gaps:

*   **It breaks counting without any error.** Every count query would return
    0 or 1, because each user would only see their own row.
*   **It still leaks through Realtime.** Supabase does not apply RLS to DELETE
    events, so every cancellation would still send the canceller's `user_id`
    to anyone subscribed to `rsvps`.

**Proposed solution in one line:** a new numbers-only table `party_counts`,
kept up to date by a database trigger on `rsvps`, readable by everyone,
writable by no client, and published to Realtime; `rsvps` becomes
"read your own rows" and is removed from Realtime.

## Goals

1.  A signed-in user can read only their own `rsvps` rows. A signed-out
    (anon) caller can read none. Organizers get no exception: they see the
    number for their events, never the names.
2.  Going counts for the event page, the Events list, the map, the "Most
    going" sort and `PartyCard` all come from `party_counts`, which holds
    `party_id`, `going_count` and `updated_at` and nothing else.
3.  On the event page, another person's "I'm going" or cancel changes the
    count within about 2 seconds, for signed-in and signed-out viewers.
4.  `usePartyStats` downloads one small row per event instead of one row per
    RSVP (closes roadmap item 4).
5.  No Realtime message carries another user's `user_id`.
6.  My plans (`app/(tabs)/profile.tsx`), reminders (`lib/notifications.ts`)
    and the `notify_new_party` push trigger work unchanged.
7.  The new app version shows the right counts before the SQL is run and
    after it, with no error messages, and switches source by itself.
8.  Re-running `supabase/schema.sql` never brings back public read on
    `rsvps`.

## Non-Goals

*   Private or house parties (roadmap item 1). Out of scope for now (Dari).
*   Attendee lists, exports or check-in for organizers. Organizers see
    numbers only. This becomes a standing decision.
*   Hiding small numbers ("1 going") or the timing of a change. If you watch
    the count tick up while a friend taps "I'm going", you can guess it was
    them. Accepted (Dari), because the number is the point of the app.
*   Protecting counts against fake accounts.
*   Removing the unused `'interested'` status from the table's check
    constraint. The app stops counting it; the column stays.
*   Privacy of `follows`, `comments` and `profiles`, which are also public
    read. A possible follow-up.
*   Enforcing capacity in the database (roadmap item 3).
*   Hiding data from the database admin or the service role.

## Open Questions

*   None. The brainstorm settled live updates (counts table), trigger
    arithmetic (+1 / −1 plus a manual reconcile), one migration file, no
    polling, and keeping old `party_counts` rows. See `concepts_brief.md`
    section 5.2a.

## Critical User Journeys (CUJs)

### CUJ 1: Someone tries to list who goes where

*   **Given**: The migration has run. A person has the anon key from the
    public repo, with or without an account.
*   **When**: They call `GET /rest/v1/rsvps?select=*`, or subscribe to
    Realtime changes on `rsvps`.
*   **Then**: Without an account they get `[]`. With an account they get only
    their own rows. Realtime sends them nothing about `rsvps`.
    `GET /rest/v1/party_counts` returns event ids and numbers only.

### CUJ 2: The count moves live on the event page

*   **Given**: A is looking at an event page (signed in or not). B opens the
    same event on another phone.
*   **When**: B taps "I'm going", then later cancels.
*   **Then**: A's count goes up by 1 and then down by 1, each within about
    2 seconds, without A touching the screen.

### CUJ 3: Lists and the map show counts without downloading RSVPs

*   **Given**: Many events with RSVPs.
*   **When**: A user opens Events (sorted by "Most going") or the Map.
*   **Then**: Cards show the same "N / capacity going" as the event page, and
    the app downloaded one `party_counts` row per event, not one row per RSVP.

### CUJ 4: My own RSVPs still work

*   **Given**: A user is going to two upcoming events.
*   **When**: They open Profile, and the app syncs reminders.
*   **Then**: My plans lists both events, and a reminder is scheduled for
    each one, 1 hour before the start. When an organizer the user follows
    publishes an event, the push still arrives.

### CUJ 5: The app is updated before the SQL is run

*   **Given**: The new app version is on the phone over Metro, and the
    database is still the old one (no `party_counts` table).
*   **When**: The user opens Events, Map, and an event page, and taps
    "I'm going".
*   **Then**: Counts are right and live, using the old queries. After Dari
    runs the SQL and the app is reopened, the counts stay right and now come
    from `party_counts`. No error is shown at any point.

## Technical Plan (Architecture)

### Data flow after the migration

```text
 phone (any user)                       Supabase Postgres
 ─────────────────                      ─────────────────────────────────────
 "I'm going" / cancel ──insert/delete──▶ rsvps  (RLS: read/insert/update/
   (own row only)                         │       delete OWN rows only;
                                          │       NOT in Realtime)
                                          │ AFTER INSERT / UPDATE / DELETE
                                          ▼ trigger sync_party_counts()
                                         party_counts  (party_id, going_count,
                                          │             updated_at)
                                          │ RLS: everyone may read, nobody
                                          │ may write from the API
                                          │
 Events / Map  ◀── select party_id, ──────┤
 (usePartyStats)    going_count           │
                                          │ in supabase_realtime publication
 Event page    ◀── INSERT/UPDATE events ──┘ filtered by party_id=eq.<id>
 (useRsvps)        carrying the new number

 My plans, reminders ──select own rows──▶ rsvps (unchanged queries)
 notify_new_party   (reads follows + push_tokens only, untouched)
```

### Database: one migration, `supabase/migration_private_rsvps.sql`

The file is re-run safe (`if not exists`, `drop … if exists`, guarded
publication changes), like the existing migrations. In order:

1.  **`party_counts` table.** `party_id uuid primary key references
    parties(id) on delete cascade`, `going_count int not null default 0
    check (going_count >= 0)`, `updated_at timestamptz not null default
    now()`. No `user_id`, no other columns. A missing row means 0.
2.  **Access on `party_counts`.** RLS on. One policy, `"party_counts: public
    read"`, for select using `(true)`. `revoke all` from `anon` and
    `authenticated`, then `grant select` to both. There is no insert, update
    or delete policy, so even if a grant comes back, RLS blocks client
    writes.
3.  **Trigger function `sync_party_counts()`**, `security definer`,
    `set search_path = public`, so it can write `party_counts` although
    clients cannot. It runs `after insert or update of status, party_id or
    delete on rsvps for each row`:
    *   A row that becomes "going" (insert with `status = 'going'`, or an
        update into `'going'`) adds 1 to its party:
        `insert … values (party, 1) on conflict (party_id) do update set
        going_count = party_counts.going_count + 1, updated_at = now()`.
        The row lock taken by `on conflict do update` puts two RSVPs at the
        same moment one after the other, so no update is lost.
    *   A row that stops being "going" (delete of a going row, or an update
        out of `'going'`) subtracts 1 with a plain `update … set
        going_count = greatest(going_count - 1, 0)`. It never inserts. When
        an event is deleted, its RSVPs are deleted by cascade; the update
        then finds no row or a row about to be deleted, and does nothing
        harmful. It can never fail on a foreign key.
    *   An update that changes `party_id` (the app never does this) is
        handled as "minus 1 on the old party, plus 1 on the new one".
4.  **`reconcile_party_counts()`**, `security definer`. Sets every
    `party_counts` row to the real `count(*)` of going RSVPs and adds
    missing rows. It is the backfill for existing RSVPs, and the repair tool
    if the numbers ever drift. `execute` is revoked from `public`, `anon`
    and `authenticated`: only the SQL editor can run it. The migration
    calls it once.
5.  **`rsvps` read policy.** Drop `"rsvps: public read"`. Create
    `"rsvps: read own"` for select to `authenticated` using
    `(auth.uid() = user_id)`. The insert, update and delete own-row policies
    stay as they are. The app's upsert keeps working, because it only
    touches the user's own row.
6.  **Index** `rsvps_user_idx on rsvps (user_id)`. The new policy, My plans
    and reminders all filter on `user_id`; the primary key starts with
    `party_id` and does not help them.
7.  **Realtime publication.** In a `do $$ … $$` block that checks
    `pg_publication_tables` first: drop `rsvps` from `supabase_realtime`
    (it was added by hand in the Dashboard), add `party_counts`.
8.  **`notify pgrst, 'reload schema'`**, so the REST API sees the new table
    at once.

`supabase/schema.sql` gets the same end state in the same commit: the
table, policy, grants, both functions, the trigger, the index and the
`"rsvps: read own"` policy instead of public read. The publication steps
stay only in the migration, because `schema.sql` does not manage the
publication today.

### App: one place that knows where counts come from

New module **`lib/goingCounts.ts`**. Both hooks use it, so they always agree
on the source.

*   **`countsSource()`** asks once whether `party_counts` exists: a plain
    `select('party_id').limit(1)` (not a `head` request, because a `head`
    response has no body and so no error code).
    *   Success → `'table'`. Cached for the life of the app.
    *   Error code `PGRST205` (table not in the API schema) or `42P01`
        (table does not exist) → `'legacy'`. Not cached: it is asked again
        on the next call. So when Dari runs the SQL while the app is open,
        the next tab focus switches to the table.
    *   Any other error (no network, timeout) → the caller's fetch fails as
        it does today. It never falls back to `'legacy'`, because after the
        migration the legacy queries return wrong numbers without an error.
    *   In development (`__DEV__`) it logs the chosen source once.
*   **`fetchAllGoingCounts()`** → `Record<partyId, number>`.
    `'table'`: `select('party_id, going_count')` from `party_counts`.
    `'legacy'`: today's query on `rsvps`, counted in the app.
*   **`fetchGoingCount(partyId)`** → number. `'table'`: one row by
    `party_id`, `maybeSingle()`; no row → 0. `'legacy'`: today's
    `count: 'exact', head: true` query.
*   **`subscribeGoingCount(partyId, onCount)`** → an unsubscribe function.
    `'table'`: Realtime on `party_counts`, events INSERT and UPDATE, filter
    `party_id=eq.<id>`; it calls `onCount(new.going_count)` straight from
    the message, with no re-fetch. `'legacy'`: today's subscription on
    `rsvps`, which re-fetches. The channel name keeps its random suffix
    (fragile fix in `PROJECT_STATE.md`).

`party_counts` is always read with its own query. It is never embedded in
the `parties` select (`parties(*, party_counts(*))`): before the migration
that would fail the whole event list with `PGRST200`.

**Hooks and screens**

*   `hooks/usePartyStats.ts` calls `fetchAllGoingCounts()` and keeps its
    return shape (`Record<id, PartyStats>`), so `app/(tabs)/index.tsx`,
    `app/(tabs)/list.tsx` and `components/PartyCard.tsx` do not change.
*   `hooks/useRsvps.ts` gets the count from `fetchGoingCount`, live updates
    from `subscribeGoingCount`, and keeps the own-status query as it is.
    `interestedCount` is removed (no screen uses it). After the user's own
    tap it re-fetches the count, so the number is right even if the
    Realtime message is late.
*   `app/party/[id].tsx` adds `useFocusEffect(refresh)`, so returning to the
    event page (for example from sign-in) re-reads the count.

### Rollout order

1.  App changes ship over Metro first. With the old database they take the
    `'legacy'` path: same numbers and live updates as today.
2.  Dari runs `migration_private_rsvps.sql` in the SQL editor.
3.  API checks (CUJ 1) with the anon key and with a signed-in token; then
    the two-device check (CUJ 2) on the phone.
4.  Cleanup in the same task: remove the `'legacy'` path and the detection
    from `lib/goingCounts.ts`, and update `PROJECT_STATE.md`.

An old app bundle that runs after step 2 shows 0 or 1 going everywhere.
That is accepted, because every client today is a development build on
Metro.

### Security notes

*   The two `security definer` functions set `search_path = public`, so a
    caller cannot redirect them to a table of their own.
*   `party_counts` has no `user_id`, so neither the REST API nor Realtime can
    reveal a person through it.
*   Realtime on `party_counts` works for signed-out viewers too, because
    `anon` has `select` and the read policy is `using (true)`.

## Alternatives Considered

### Alternative A: Only change the `rsvps` read policy

*   **Pros**: One SQL statement.
*   **Cons**: Every count becomes 0 or 1 with no error. Live updates stop.
    Cancellations still leak `user_id` through Realtime, because Supabase
    does not apply RLS to DELETE events.
*   **Reason for Rejection**: Rejected by author: it breaks the main number
    of the app, and it still does not close the leak.

### Alternative B: A `going_count` column on `parties`

*   **Pros**: Counts arrive with the event list that is already loaded. No
    new table.
*   **Cons**: The policy `"parties: organizer update"` does not limit
    columns, so an organizer could set `going_count = 500` through the API.
    Blocking that needs column grants or a guard trigger, and both are easy
    to undo by accident. Every RSVP would also send the whole event row to
    everyone listening to `parties`.
*   **Reason for Rejection**: Rejected by author: the count can be faked by
    the person who benefits most from faking it.

### Alternative C: A view or RPC that counts, plus polling

*   **Pros**: No stored counter, so it can never drift. Less SQL (no trigger).
*   **Cons**: Realtime cannot listen to a view or an RPC, so the count would
    only update every 15–30 seconds or on screen focus. A view that counts
    other people's rows must run as its owner, which the Supabase linter
    flags; a view that runs as the caller would only count the caller's own
    row.
*   **Reason for Rejection**: Rejected by author: Dari asked for counts that
    update instantly.

### Alternative D: Broadcast from the trigger (`realtime.send`)

*   **Pros**: Live, and no table needs to be in the publication.
*   **Cons**: Needs topic naming and policies on `realtime.messages`. A
    public topic lets anyone send a fake count to everyone. A missed message
    is lost, so a readable source is still needed for the first load.
*   **Reason for Rejection**: Rejected by author: more moving parts than
    `party_counts`, and it still needs `party_counts` (or a view) underneath.

### Alternative E: Recount the whole party in the trigger

*   **Pros**: Repairs any drift on the next RSVP.
*   **Cons**: Correct only if the `party_counts` row is locked before
    counting. Without the lock, two people tapping at the same moment both
    write the same N+1.
*   **Reason for Rejection**: Rejected by author: +1 / −1 under the
    `on conflict` row lock has no locking subtlety. Drift is handled by
    `reconcile_party_counts()`.

### Alternative F: Two migration files (add first, restrict later)

*   **Pros**: Each file can be rolled back on its own.
*   **Cons**: The app already works on both sides of one file. With two
    files, running the first and forgetting the second leaves the leak open
    while it looks fixed.
*   **Reason for Rejection**: Rejected by author: one file, so the fix is
    either fully in or not at all.

### Alternative G: Poll every 30–60 s as a safety net

*   **Pros**: Recovers from a dropped Realtime connection without user
    action.
*   **Cons**: Constant requests from every open event page, for a case that
    a screen re-focus already fixes.
*   **Reason for Rejection**: Rejected by author: re-fetch on focus and after
    your own tap is enough at this scale.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Security & Privacy**: The main purpose of this change. See Goals 1, 5
    and 8, and the Security notes in the Technical Plan.
*   **Performance**: The trigger adds one indexed upsert or update per RSVP
    change. The list and map download one row per event with RSVPs instead
    of one row per RSVP.
*   **Rollout & Rollback**: The app ships first and works with both database
    states. Rollback of the SQL = recreate `"rsvps: public read"`, add `rsvps`
    back to `supabase_realtime`, drop `party_counts` and the two functions.
    That reopens the leak, so it is for emergencies only. Rollback of the app
    = revert the commit (only safe before the SQL is run).

--------------------------------------------------------------------------------

### Additional Resources

*   `concepts_brief.md`: the EGM brainstorm, with seven reviewer lenses
    (working file, deleted after drafting; not in the repo).
*   Supabase docs, Postgres Changes (checked 2026-11-15): "RLS policies are
    not applied to DELETE statements"; DELETE events can be filtered only
    with replica identity full.
*   `PROJECT_STATE.md`: "Privacy gap (DB)" note, roadmap item 4, decision 8
    (no friends layer).

### Future Improvements

*   **Other public tables**: `follows`, `comments` and `profiles` are public
    read too. `comments` shows who engaged with which event, and the chat is
    gone, so its read policy could be closed.
*   **Scheduled reconcile**: run `reconcile_party_counts()` nightly with
    `pg_cron` if drift is ever seen.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

The work has two commits. Commit 1 is the app, which works with both
database states, plus the SQL file. Commit 2 is the cleanup after Dari has
run the SQL and the checks pass. Everything is **JS-only plus one SQL
migration**. No native build is needed.

### Target Files to Create/Modify

#### 1. `supabase/migration_private_rsvps.sql` (Create) — commit 1

*   **Type / Scope**: Supabase SQL migration, run by hand in the SQL editor.
*   **Proposed Changes**: Header comment: what it does, that it is re-run
    safe, and that the app must be updated first. Then steps 1–8 from the
    Technical Plan, in that order:
    *   `create table if not exists public.party_counts (…)`;
        `alter table … enable row level security`.
    *   `revoke all on public.party_counts from anon, authenticated`;
        `grant select on public.party_counts to anon, authenticated`;
        `drop policy if exists` + `create policy "party_counts: public read"
        … for select using (true)`.
    *   `create or replace function public.sync_party_counts() returns
        trigger language plpgsql security definer set search_path = public`,
        with this logic:
        ```text
        was_going := TG_OP in (UPDATE, DELETE) and old.status = 'going'
        is_going  := TG_OP in (INSERT, UPDATE) and new.status = 'going'
        if was_going and (not is_going or old.party_id <> new.party_id):
            update party_counts set going_count = greatest(going_count-1, 0),
                   updated_at = now() where party_id = old.party_id
        if is_going and (not was_going or old.party_id <> new.party_id):
            insert into party_counts (party_id, going_count) values (new.party_id, 1)
            on conflict (party_id) do update
              set going_count = party_counts.going_count + 1, updated_at = now()
        return null   -- AFTER trigger
        ```
    *   `drop trigger if exists rsvps_sync_party_counts on public.rsvps`;
        `create trigger … after insert or delete or update of status,
        party_id on public.rsvps for each row execute function
        public.sync_party_counts()`.
    *   `create or replace function public.reconcile_party_counts() returns
        void … security definer set search_path = public`: upsert
        `count(*) filter (where status = 'going')` per `party_id` from
        `rsvps` for every event (a row with 0 for events without going RSVPs), updating only rows whose number differs.
        `revoke execute on function public.reconcile_party_counts() from
        public, anon, authenticated`; same for `sync_party_counts()`.
    *   `select public.reconcile_party_counts();` (the backfill).
    *   `drop policy if exists "rsvps: public read" on public.rsvps`;
        `drop policy if exists "rsvps: read own"` + `create policy "rsvps:
        read own" on public.rsvps for select to authenticated using
        (auth.uid() = user_id)`.
    *   `create index if not exists rsvps_user_idx on public.rsvps
        (user_id)`.
    *   `do $$ begin if exists (select 1 from pg_publication_tables where
        pubname = 'supabase_realtime' and schemaname = 'public' and
        tablename = 'rsvps') then alter publication supabase_realtime drop
        table public.rsvps; end if; if not exists (… 'party_counts') then
        alter publication supabase_realtime add table public.party_counts;
        end if; end $$;`
    *   `notify pgrst, 'reload schema';`
    *   A comment at the end with the checks to run afterwards (see the
        Verification Plan).

#### 2. `supabase/schema.sql` (Modify) — commit 1

*   **Type / Scope**: Base schema, re-run safe.
*   **Proposed Changes**: Add the `party_counts` table after `rsvps`, with
    RLS, grants and the public-read policy. Add both functions and the
    trigger. Add `rsvps_user_idx`. Replace the `"rsvps: public read"` block
    with `drop policy if exists "rsvps: public read"` + `"rsvps: read own"`,
    and change the section comment to "rsvps: private; users read and
    manage only their own rows. Counts are in party_counts." No publication
    statements (they are in the migration only). Why: re-running
    `schema.sql` must not reopen the leak (Goal 8).

#### 3. `lib/goingCounts.ts` (Create) — commit 1; trimmed in commit 2

*   **Type / Scope**: TypeScript module, the single source for going counts.
*   **Proposed Changes**:
    ```text
    type CountsSource = 'table' | 'legacy'
    countsSource(): Promise<CountsSource>      // detection rules in Technical Plan
    fetchAllGoingCounts(): Promise<Record<string, number>>
    fetchGoingCount(partyId: string): Promise<number>
    subscribeGoingCount(partyId: string, onCount: (n: number) => void): () => void
    ```
    *   A module-level `let cached: 'table' | null`. Only `'table'` is
        cached.
    *   `isMissingTable(error)` → `error.code === 'PGRST205' ||
        error.code === '42P01'`. Every other error is thrown to the caller.
    *   `subscribeGoingCount` awaits `countsSource()` inside, so it returns
        its unsubscribe function at once and tears down whichever channel
        it opened. If the component unmounts before the source is known, no
        channel is opened.
    *   Channel name: `going-${partyId}-${random}` (keeps the unique-suffix
        fix).
    *   A file comment that marks the `'legacy'` branches "remove after
        migration_private_rsvps.sql has run".
    *   **Commit 2**: delete `countsSource`, `isMissingTable` and every
        `'legacy'` branch, so only the `party_counts` paths remain.

#### 4. `hooks/usePartyStats.ts` (Modify) — commit 1

*   **Type / Scope**: React hook.
*   **Proposed Changes**: Replace the `rsvps` query and the counting loop with
    `fetchAllGoingCounts()`, mapped to `{ goingCount }`. Same return value,
    so screens do not change. Keep the silent catch (the cards are
    decorative), but on an error keep the last good map instead of setting
    `{}`, so a network blip does not reset every card to 0. Update the
    doc comment.

#### 5. `hooks/useRsvps.ts` (Modify) — commit 1

*   **Type / Scope**: React hook for the event page.
*   **Proposed Changes**:
    *   Remove `interestedCount`, its state, its query and its field in
        `UseRsvpsResult`.
    *   The count comes from `fetchGoingCount(partyId)`; the own-status
        query stays as it is.
    *   The effect calls `subscribeGoingCount(partyId, setGoingCount)`
        instead of opening a channel on `rsvps`, and its cleanup calls the
        returned unsubscribe function.
    *   `toggleRsvp` keeps its re-fetch after the write.
    *   Update the doc comment: counts come from `party_counts`, and
        `rsvps` is no longer in Realtime.
    *   `RsvpStatus` keeps `'interested'`, because the column allows it.

#### 6. `app/party/[id].tsx` (Modify) — commit 1

*   **Type / Scope**: Event page screen.
*   **Proposed Changes**: Take `refresh` from `useRsvps` and call it in a
    `useFocusEffect`, so returning to the page re-reads the count and my
    status (for example after signing in from the "I'm going" button).
    Nothing else changes.

#### 7. `docs/designs/private_rsvps.md` (Create) — before commit 1

*   **Type / Scope**: The approved design document (this file, finalized).
*   **Proposed Changes**: Saved by `/egm:egm-draft` Step 6. `/egm:egm-review`
    then reviews it there, and the decisions are recorded in it.

#### 8. `CLAUDE.md` (Modify) — commit 1

*   **Type / Scope**: Agent instructions.
*   **Proposed Changes**: In the Events-data bullet, replace "Going counts
    come from `hooks/usePartyStats`; the event page uses `hooks/useRsvps`
    (Supabase Realtime)" with: counts come only from `party_counts`
    through `lib/goingCounts.ts`. Realtime is on `party_counts`, not
    `rsvps`. `rsvps` is private (own rows). Why: so the next session does
    not re-add a query on other people's RSVPs.

#### 9. `PROJECT_STATE.md` (Modify) — commit 1, then commit 2

*   **Type / Scope**: Project status.
*   **Proposed Changes**:
    *   **Commit 1**: add standing decision 16: "RSVP rows are private:
        own rows only, organizers included. Counts come only from
        `party_counts`. Never re-add public read on `rsvps` or put `rsvps`
        back in Realtime." Add a fragile-fix line: the event page listens
        to `party_counts`. In "Not verified", say the migration is written
        but not yet run.
    *   **Commit 2** (after the SQL is run and checked): in Setup status,
        record the migration as run (with the date) and that `rsvps` left
        the publication. Remove the "Privacy gap (DB)" note and roadmap
        item 4. In "Not verified", list what was not yet seen on the phone.

#### 10. `concepts_brief.md`, `design_draft.md` (Delete, never committed)

*   **Type / Scope**: EGM working files in the repo root.
*   **Proposed Changes**: Deleted once `docs/designs/private_rsvps.md` is
    saved. The design keeps everything that matters from them.

Files checked and **not** changed: `app/(tabs)/profile.tsx` and
`lib/notifications.ts` (they read only the user's own rows);
`supabase/migration_social_notifications.sql` (`notify_new_party` does not
read `rsvps`); `components/PartyCard.tsx`, `app/(tabs)/index.tsx`,
`app/(tabs)/list.tsx` and `lib/types.ts` (the `PartyStats` shape stays).

### Verification Plan

*   **Typecheck / lint**: `npx tsc --noEmit` and `npx expo lint` pass after
    each commit.
*   **Before the SQL** (browser preview, `fyft-web`): Events, Map and an
    event page show the same counts as before. The dev log says
    `going counts: legacy`.
*   **After Dari runs the SQL**, API checks with the anon key from `.env`
    (the key is never printed):
    *   `GET /rest/v1/rsvps?select=*` returns `[]`, and with
        `Prefer: count=exact` the header reads `Content-Range: */0`.
    *   `GET /rest/v1/party_counts?select=*` returns 200 with only
        `party_id`, `going_count`, `updated_at`.
    *   `POST /rest/v1/party_counts` and `PATCH` return an error (no write).
    *   `POST /rest/v1/rpc/reconcile_party_counts` returns an error (no
        execute).
*   **SQL editor checks** (Dari):
    *   `select * from pg_publication_tables where pubname =
        'supabase_realtime';` lists `party_counts` and not `rsvps`.
    *   `select p.party_id, p.going_count, count(r.*) filter (where
        r.status = 'going') from party_counts p left join rsvps r using
        (party_id) group by 1, 2 having p.going_count <> count(r.*) filter
        (where r.status = 'going');` returns no rows.
*   **Browser preview after the SQL**: the dev log says `going counts:
    table`; counts match the SQL; signing in and tapping "I'm going" moves
    the count by 1 and back.
*   **Phone (Dari, two accounts or phone + browser)**: CUJ 2 (live +1 / −1),
    CUJ 4 (My plans, reminder), deleting an event that has RSVPs still
    works, and a follower still gets the push for a new event.
*   **Commit 2**: the same tsc, lint and browser checks with the `'legacy'`
    path removed.

--------------------------------------------------------------------------------

*Drafted with EGM*
