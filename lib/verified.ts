import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Verified organizers (profiles.is_verified, set only from the SQL editor,
 * see supabase/migration_trust.sql). The list is small, so it is loaded once
 * per app session and shared by every card and page.
 *
 * Read in its own query on purpose: if the column does not exist yet (the
 * migration was not run), this returns an empty set and nothing else breaks.
 */
let cache: Set<string> | null = null;
let pending: Promise<Set<string>> | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

async function loadVerifiedIds(): Promise<Set<string>> {
  if (cache) return cache;
  if (!pending) {
    pending = (async () => {
      const { data, error } = await supabase.from('profiles').select('id').eq('is_verified', true);
      // On an error keep an empty set but allow a retry on the next mount.
      const ids = new Set<string>(error ? [] : (data ?? []).map((r) => r.id as string));
      if (!error) cache = ids;
      pending = null;
      listeners.forEach((l) => l(ids));
      return ids;
    })();
  }
  return pending;
}

/** True when this organizer is verified (false while loading or on error). */
export function useIsVerified(profileId: string | null | undefined): boolean {
  const [ids, setIds] = useState<Set<string>>(() => cache ?? new Set());
  useEffect(() => {
    listeners.add(setIds);
    loadVerifiedIds().then(setIds);
    return () => {
      listeners.delete(setIds);
    };
  }, []);
  return !!profileId && ids.has(profileId);
}
