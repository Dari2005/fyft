import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UsePartyRatingResult {
  /** Average stars across all ratings, or null when unrated. */
  average: number | null;
  /** How many users rated this party. */
  count: number;
  /** The signed-in user's own rating (1-5), or null. */
  myRating: number | null;
  loading: boolean;
  actionLoading: boolean;
  /** Set/change my rating. 'logged-out' when signed out. */
  rate: (stars: number) => Promise<'logged-out' | 'ok' | 'error'>;
  /** Remove my rating. */
  removeRating: () => Promise<'ok' | 'error'>;
}

/**
 * Ratings for one party (detail screen): aggregate + the current user's
 * own rating, with upsert/delete actions against party_ratings.
 * One row per (party, user) — rating again simply changes the stars.
 */
export function usePartyRating(
  partyId: string,
  userId: string | null
): UsePartyRatingResult {
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRatings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('party_ratings')
        .select('user_id, rating')
        .eq('party_id', partyId);
      if (error) throw error;
      const rows = data ?? [];
      setCount(rows.length);
      setAverage(
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
          : null
      );
      setMyRating(
        userId ? (rows.find((r) => r.user_id === userId)?.rating ?? null) : null
      );
    } catch {
      // Rating UI is additive — on failure just show "no ratings".
      setAverage(null);
      setCount(0);
      setMyRating(null);
    } finally {
      setLoading(false);
    }
  }, [partyId, userId]);

  useEffect(() => {
    setLoading(true);
    fetchRatings();
  }, [fetchRatings]);

  const rate = useCallback(
    async (stars: number): Promise<'logged-out' | 'ok' | 'error'> => {
      if (!userId) return 'logged-out';
      if (stars < 1 || stars > 5) return 'error';
      setActionLoading(true);
      try {
        const { error } = await supabase
          .from('party_ratings')
          .upsert(
            { party_id: partyId, user_id: userId, rating: stars },
            { onConflict: 'party_id,user_id' }
          );
        if (error) throw error;
        await fetchRatings();
        return 'ok';
      } catch {
        return 'error';
      } finally {
        setActionLoading(false);
      }
    },
    [partyId, userId, fetchRatings]
  );

  const removeRating = useCallback(async (): Promise<'ok' | 'error'> => {
    if (!userId) return 'error';
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('party_ratings')
        .delete()
        .eq('party_id', partyId)
        .eq('user_id', userId);
      if (error) throw error;
      await fetchRatings();
      return 'ok';
    } catch {
      return 'error';
    } finally {
      setActionLoading(false);
    }
  }, [partyId, userId, fetchRatings]);

  return {
    average,
    count,
    myRating,
    loading,
    actionLoading,
    rate,
    removeRating,
  };
}
