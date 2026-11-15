import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * The one place that knows where "N going" comes from.
 *
 * Going counts live in `party_counts` (numbers only, kept up to date by a
 * trigger on `rsvps`; see supabase/migration_private_rsvps.sql and
 * docs/designs/private_rsvps.md). `rsvps` itself is private: each user reads
 * only their own rows, so counting it would give 0 or 1 — never count
 * `rsvps` for a number shown to the user.
 *
 * TEMPORARY: until that migration has run, `party_counts` does not exist and
 * the 'legacy' branches below count `rsvps` the old way. Remove every
 * 'legacy' branch (and countsSource/isMissingTable) once the migration is in.
 */

type CountsSource = 'table' | 'legacy';

// Only 'table' is cached: while the table is missing we ask again on the next
// call, so running the SQL with the app open switches over on the next focus.
let cachedTable = false;
let loggedSource: CountsSource | null = null;

function isMissingTable(error: PostgrestError): boolean {
  // PGRST205: not in the API schema cache; 42P01: relation does not exist.
  return error.code === 'PGRST205' || error.code === '42P01';
}

function logSource(source: CountsSource) {
  if (__DEV__ && loggedSource !== source) {
    loggedSource = source;
    console.log(`going counts: ${source}`);
  }
}

/**
 * 'table' when party_counts exists, 'legacy' when it does not. Any other
 * error (no network…) is thrown: falling back would show wrong numbers once
 * the migration has run.
 */
async function countsSource(): Promise<CountsSource> {
  if (cachedTable) return 'table';
  // Not a head request: a head response has no body, so no error code.
  const { error } = await supabase.from('party_counts').select('party_id').limit(1);
  if (!error) {
    cachedTable = true;
    logSource('table');
    return 'table';
  }
  if (isMissingTable(error)) {
    logSource('legacy');
    return 'legacy';
  }
  throw error;
}

/** Going count per party id, for every party that has one (missing = 0). */
export async function fetchAllGoingCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if ((await countsSource()) === 'table') {
    const { data, error } = await supabase.from('party_counts').select('party_id, going_count');
    if (error) throw error;
    for (const row of data ?? []) counts[row.party_id as string] = row.going_count as number;
    return counts;
  }

  // legacy: download every going row and count them here.
  const { data, error } = await supabase.from('rsvps').select('party_id').eq('status', 'going');
  if (error) throw error;
  for (const row of data ?? []) {
    const id = row.party_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Going count for one party. */
export async function fetchGoingCount(partyId: string): Promise<number> {
  if ((await countsSource()) === 'table') {
    const { data, error } = await supabase
      .from('party_counts')
      .select('going_count')
      .eq('party_id', partyId)
      .maybeSingle();
    if (error) throw error;
    return (data?.going_count as number | undefined) ?? 0;
  }

  // legacy
  const { count, error } = await supabase
    .from('rsvps')
    .select('party_id', { count: 'exact', head: true })
    .eq('party_id', partyId)
    .eq('status', 'going');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Live going count for one party. `onCount` gets the new number when it is
 * in the message; `onStale` is called when the caller has to re-fetch
 * (legacy path). Returns an unsubscribe function right away.
 */
export function subscribeGoingCount(
  partyId: string,
  onCount: (count: number) => void,
  onStale: () => void
): () => void {
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  countsSource()
    .then((source) => {
      if (closed) return;
      // Unique suffix per subscription: reusing a subscribed channel name
      // throws when an effect re-runs (fragile fix, see PROJECT_STATE.md).
      const name = `going-${partyId}-${Math.random().toString(36).slice(2, 9)}`;
      const channel =
        source === 'table'
          ? supabase.channel(name).on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'party_counts', filter: `party_id=eq.${partyId}` },
              (payload) => {
                const next = (payload.new as { going_count?: number } | null)?.going_count;
                if (typeof next === 'number') onCount(next);
                else onStale();
              }
            )
          : // legacy
            supabase.channel(name).on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'rsvps', filter: `party_id=eq.${partyId}` },
              () => onStale()
            );
      channel.subscribe();
      unsubscribe = () => {
        supabase.removeChannel(channel);
      };
    })
    .catch(() => {
      // No live updates this time (e.g. offline); counts still refresh on
      // focus and after the user's own tap.
    });

  return () => {
    closed = true;
    unsubscribe?.();
  };
}
