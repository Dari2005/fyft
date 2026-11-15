import { supabase } from '@/lib/supabase';

/**
 * The one place that knows where "N going" comes from.
 *
 * Going counts live in `party_counts` (numbers only, kept up to date by a
 * trigger on `rsvps`; see supabase/migration_private_rsvps.sql and
 * docs/designs/private_rsvps.md). `rsvps` itself is private: each user reads
 * only their own rows, so counting it would give 0 or 1 — never count
 * `rsvps` for a number shown to the user. `rsvps` is not in Realtime either.
 *
 * Never embed `party_counts` in the `parties` select; read it on its own.
 */

/** Going count per party id, for every party that has one (missing = 0). */
export async function fetchAllGoingCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('party_counts').select('party_id, going_count');
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.party_id as string] = row.going_count as number;
  return counts;
}

/** Going count for one party. */
export async function fetchGoingCount(partyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('party_counts')
    .select('going_count')
    .eq('party_id', partyId)
    .maybeSingle();
  if (error) throw error;
  return (data?.going_count as number | undefined) ?? 0;
}

/**
 * Live going count for one party, from Realtime on `party_counts`. `onCount`
 * gets the new number straight from the message; `onStale` is called if a
 * message arrives without one (the caller re-fetches). Returns an
 * unsubscribe function.
 */
export function subscribeGoingCount(
  partyId: string,
  onCount: (count: number) => void,
  onStale: () => void
): () => void {
  // Unique suffix per subscription: reusing a subscribed channel name throws
  // when an effect re-runs (fragile fix, see PROJECT_STATE.md).
  const channel = supabase
    .channel(`going-${partyId}-${Math.random().toString(36).slice(2, 9)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'party_counts', filter: `party_id=eq.${partyId}` },
      (payload) => {
        const next = (payload.new as { going_count?: number } | null)?.going_count;
        if (typeof next === 'number') onCount(next);
        else onStale();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
