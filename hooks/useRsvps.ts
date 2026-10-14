import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type RsvpStatus = 'going' | 'interested';

interface UseRsvpsResult {
  goingCount: number;
  interestedCount: number;
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
 * Manages RSVPs for one party: live going/interested counts, the current
 * user's RSVP status, and a realtime subscription on the rsvps table so the
 * counts update instantly when anyone RSVPs.
 *
 * NOTE: for realtime to work, the `rsvps` table must be added to the
 * `supabase_realtime` publication (Dashboard → Database → Replication).
 * If it isn't, counts still update after the user's own actions via refetch.
 */
export function useRsvps(partyId: string, userId: string | null): UseRsvpsResult {
  const [goingCount, setGoingCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRsvps = useCallback(async () => {
    try {
      const [going, interested, mine] = await Promise.all([
        supabase
          .from('rsvps')
          .select('party_id', { count: 'exact', head: true })
          .eq('party_id', partyId)
          .eq('status', 'going'),
        supabase
          .from('rsvps')
          .select('party_id', { count: 'exact', head: true })
          .eq('party_id', partyId)
          .eq('status', 'interested'),
        userId
          ? supabase
              .from('rsvps')
              .select('status')
              .eq('party_id', partyId)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (going.error) throw going.error;
      if (interested.error) throw interested.error;
      if (mine.error) throw mine.error;

      setGoingCount(going.count ?? 0);
      setInterestedCount(interested.count ?? 0);
      setMyStatus((mine.data?.status as RsvpStatus | undefined) ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Грешка при вчитување на RSVP.');
    } finally {
      setLoading(false);
    }
  }, [partyId, userId]);

  // Initial load + realtime subscription for live capacity updates.
  useEffect(() => {
    setLoading(true);
    fetchRsvps();

    const channel = supabase
      .channel(`rsvps-party-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps', filter: `party_id=eq.${partyId}` },
        () => {
          fetchRsvps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        await fetchRsvps();
        return 'ok';
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Грешка при зачувување на RSVP.');
        return 'error';
      } finally {
        setActionLoading(false);
      }
    },
    [partyId, userId, myStatus, fetchRsvps]
  );

  return {
    goingCount,
    interestedCount,
    myStatus,
    loading,
    actionLoading,
    error,
    toggleRsvp,
    refresh: fetchRsvps,
  };
}
