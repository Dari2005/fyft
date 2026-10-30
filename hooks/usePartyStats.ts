import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartyStats } from '@/lib/types';

/**
 * Aggregated stats for ALL parties (average rating, rating count, going
 * count), keyed by party id. One pair of light queries; at Fyft's scale
 * this is simpler and fast enough compared to per-card queries, and it
 * powers both the card badges and the list sorting (top rated / most going).
 */
export function usePartyStats() {
  const [stats, setStats] = useState<Record<string, PartyStats>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [ratingsRes, rsvpsRes] = await Promise.all([
        supabase.from('party_ratings').select('party_id, rating'),
        supabase.from('rsvps').select('party_id').eq('status', 'going'),
      ]);
      if (ratingsRes.error) throw ratingsRes.error;
      if (rsvpsRes.error) throw rsvpsRes.error;

      const map: Record<string, PartyStats & { sum: number }> = {};
      const ensure = (id: string) =>
        (map[id] ??= { average: null, ratingCount: 0, goingCount: 0, sum: 0 });

      for (const row of ratingsRes.data ?? []) {
        const s = ensure(row.party_id);
        s.sum += row.rating;
        s.ratingCount += 1;
      }
      for (const row of rsvpsRes.data ?? []) {
        ensure(row.party_id).goingCount += 1;
      }
      for (const s of Object.values(map)) {
        s.average = s.ratingCount > 0 ? s.sum / s.ratingCount : null;
      }
      setStats(map);
    } catch {
      // Stats are decorative (badges/sorting) — fail silently, keep empty map.
      setStats({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
