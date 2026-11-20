import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Venues: clubs, bars, kafanas, concert places (supabase/migration_venues.sql).
 * A venue is not an account. They are created in the Supabase dashboard only,
 * so the list is small and loaded once per app session, shared by every card,
 * the event page, the venue page and the New event picker.
 *
 * If the table does not exist yet (migration not run), the list is empty and
 * every screen behaves as before.
 */
export interface Venue {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  image_url: string | null;
}

let cache: Venue[] | null = null;
let pending: Promise<Venue[]> | null = null;
const listeners = new Set<(v: Venue[]) => void>();

async function loadVenues(force = false): Promise<Venue[]> {
  if (cache && !force) return cache;
  if (!pending) {
    pending = (async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, address, latitude, longitude, description, image_url')
        .order('name');
      const list = error ? (cache ?? []) : ((data ?? []) as Venue[]);
      if (!error) cache = list;
      pending = null;
      listeners.forEach((l) => l(list));
      return list;
    })();
  }
  return pending;
}

/** All venues, sorted by name, plus a lookup by id. */
export function useVenues(): {
  venues: Venue[];
  byId: Map<string, Venue>;
  refresh: () => Promise<void>;
} {
  const [venues, setVenues] = useState<Venue[]>(() => cache ?? []);
  useEffect(() => {
    listeners.add(setVenues);
    loadVenues().then(setVenues);
    return () => {
      listeners.delete(setVenues);
    };
  }, []);
  const byId = new Map(venues.map((v) => [v.id, v]));
  return {
    venues,
    byId,
    refresh: async () => {
      await loadVenues(true);
    },
  };
}

/** The venue of an event, or null (no venue, or not loaded yet). */
export function useVenue(venueId: string | null | undefined): Venue | null {
  const { byId } = useVenues();
  return venueId ? (byId.get(venueId) ?? null) : null;
}

/** How many people follow a venue — a number only (followers are private). */
export async function fetchVenueFollowerCount(venueId: string): Promise<number> {
  const { data, error } = await supabase.rpc('venue_follower_count', { target_venue: venueId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
