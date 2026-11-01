import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartyStats } from '@/lib/types';

/**
 * Aggregated stats for ALL parties (RSVP "going" count), keyed by party
 * id. One light query; powers the card badges and the "Most going" sort.
 */
export function usePartyStats() {
  const [stats, setStats] = useState<Record<string, PartyStats>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rsvps')
        .select('party_id')
        .eq('status', 'going');
      if (error) throw error;

      const map: Record<string, PartyStats> = {};
      for (const row of data ?? []) {
        (map[row.party_id] ??= { goingCount: 0 }).goingCount += 1;
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
