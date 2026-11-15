import { useCallback, useEffect, useState } from 'react';
import { fetchAllGoingCounts } from '@/lib/goingCounts';
import type { PartyStats } from '@/lib/types';

/**
 * Going count for ALL parties, keyed by party id. One small row per event
 * from `party_counts` (lib/goingCounts.ts); powers the card badges and the
 * "Most going" sort.
 */
export function usePartyStats() {
  const [stats, setStats] = useState<Record<string, PartyStats>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const counts = await fetchAllGoingCounts();
      const map: Record<string, PartyStats> = {};
      for (const [id, goingCount] of Object.entries(counts)) map[id] = { goingCount };
      setStats(map);
    } catch {
      // Stats are decorative (badges/sorting) — fail silently and keep the
      // last good numbers, so a network blip doesn't reset every card to 0.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
