import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchGoingCount, subscribeGoingCount } from '@/lib/goingCounts';

/** 'interested' is still allowed by the table but no screen uses it. */
export type RsvpStatus = 'going' | 'interested';

interface UseRsvpsResult {
  goingCount: number;
  myStatus: RsvpStatus | null;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  /**
   * Toggle an RSVP status. Tapping the active status removes the RSVP;
   * switching status updates the row.
   * Returns 'logged-out' when there is no signed-in user (caller redirects
   * to the auth screen), 'ok' on success, 'error' on failure.
   */
  toggleRsvp: (status: RsvpStatus) => Promise<'logged-out' | 'ok' | 'error'>;
  refresh: () => Promise<void>;
}

/**
 * RSVPs for one party: the live going count and the current user's own
 * status.
 *
 * The count comes from `party_counts` (lib/goingCounts.ts), which is in the
 * Realtime publication, so it updates live when anyone RSVPs. `rsvps` is
 * private (own rows only) and NOT in Realtime — never count it here.
 */
export function useRsvps(partyId: string, userId: string | null): UseRsvpsResult {
  const [goingCount, setGoingCount] = useState(0);
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRsvps = useCallback(async () => {
    try {
      const [count, mine] = await Promise.all([
        fetchGoingCount(partyId),
        userId
          ? supabase
              .from('rsvps')
              .select('status')
              .eq('party_id', partyId)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (mine.error) throw mine.error;

      setGoingCount(count);
      setMyStatus((mine.data?.status as RsvpStatus | undefined) ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load RSVPs.');
    } finally {
      setLoading(false);
    }
  }, [partyId, userId]);

  // Initial load + live count.
  useEffect(() => {
    setLoading(true);
    fetchRsvps();
    return subscribeGoingCount(partyId, setGoingCount, () => {
      fetchRsvps();
    });
  }, [partyId, fetchRsvps]);

  const toggleRsvp = useCallback(
    async (status: RsvpStatus): Promise<'logged-out' | 'ok' | 'error'> => {
      if (!userId) return 'logged-out';
      setActionLoading(true);
      setError(null);
      try {
        if (myStatus === status) {
          // Tapping the active status again removes the RSVP.
          const { error: delError } = await supabase
            .from('rsvps')
            .delete()
            .eq('party_id', partyId)
            .eq('user_id', userId);
          if (delError) throw delError;
          setMyStatus(null);
        } else {
          // New RSVP or switching status.
          const { error: upsertError } = await supabase.from('rsvps').upsert(
            { party_id: partyId, user_id: userId, status },
            { onConflict: 'party_id,user_id' }
          );
          if (upsertError) throw upsertError;
          setMyStatus(status);
        }
        // Re-read the count so it is right even if the live message is late.
        await fetchRsvps();
        return 'ok';
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save RSVP.');
        return 'error';
      } finally {
        setActionLoading(false);
      }
    },
    [partyId, userId, myStatus, fetchRsvps]
  );

  return {
    goingCount,
    myStatus,
    loading,
    actionLoading,
    error,
    toggleRsvp,
    refresh: fetchRsvps,
  };
}
