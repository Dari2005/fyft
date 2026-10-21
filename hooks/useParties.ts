import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { parsePartyMedia, type Party } from '@/lib/types';

interface UsePartiesResult {
  parties: Party[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Fetches the list of parties, newest first, with the organizer's username. */
export function useParties(): UsePartiesResult {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('parties')
        .select('*, profiles!parties_organizer_id_fkey(username)')
        .order('starts_at', { ascending: true });

      if (queryError) throw queryError;

      const mapped: Party[] = (data ?? []).map((row) => ({
        id: row.id,
        organizer_id: row.organizer_id,
        title: row.title,
        description: row.description,
        venue_type: row.venue_type,
        party_type: row.party_type ?? null,
        media: parsePartyMedia(row.media),
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        starts_at: row.starts_at,
        capacity: row.capacity,
        created_at: row.created_at,
        organizer_username: row.profiles?.username ?? undefined,
      }));
      setParties(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load parties.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  return { parties, loading, error, refresh: fetchParties };
}
