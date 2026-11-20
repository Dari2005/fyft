import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import type { ProfileLite } from './types';

interface SocialContextValue {
  /** Organizers the signed-in user follows (no friends layer, Dari 2026-11-08). */
  following: ProfileLite[];
  followingIds: Set<string>;
  loading: boolean;
  isFollowing: (userId: string) => boolean;
  /** 'logged-out' when there is no user (caller sends them to sign in). */
  follow: (profile: ProfileLite) => Promise<'ok' | 'logged-out' | 'error'>;
  unfollow: (userId: string) => Promise<'ok' | 'error'>;
  refresh: () => Promise<void>;
  /** Venues the signed-in user follows (venue_followers, own rows only). */
  isFollowingVenue: (venueId: string) => boolean;
  followVenue: (venueId: string) => Promise<'ok' | 'logged-out' | 'error'>;
  unfollowVenue: (venueId: string) => Promise<'ok' | 'error'>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

/**
 * How many people follow a profile — a number only. `follows` is private
 * (each user reads only the follows they made), so never count it directly;
 * the security-definer RPC follower_count() returns just the number
 * (supabase/migration_private_follows.sql).
 */
export async function fetchFollowerCount(profileId: string): Promise<number> {
  const { data, error } = await supabase.rpc('follower_count', { profile_id: profileId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Holds which organizers the user follows. One shared copy, so every Follow
 * button and the "Following" filter flip at once. There is deliberately no
 * "friends going" layer any more: nobody can see where anyone else is going.
 */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [following, setFollowing] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [venueIds, setVenueIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!userId) {
      setFollowing([]);
      setVenueIds(new Set());
      return;
    }
    // Venue follows: optional until migration_venues.sql is run.
    supabase
      .from('venue_followers')
      .select('venue_id')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!error) setVenueIds(new Set((data ?? []).map((r) => r.venue_id as string)));
      });
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('followee_id, profiles!follows_followee_id_fkey(id, username, avatar_url)')
        .eq('follower_id', userId);
      if (error) throw error;

      const list: ProfileLite[] = (data ?? []).flatMap((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return p ? [{ id: p.id, username: p.username, avatar_url: p.avatar_url }] : [];
      });
      setFollowing(list);
    } catch {
      // Follows are a bonus layer — never block the screens if it fails.
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const follow = useCallback<SocialContextValue['follow']>(
    async (profile) => {
      if (!userId) return 'logged-out';
      if (profile.id === userId) return 'error';
      // Optimistic: the button flips immediately, rolled back on failure.
      setFollowing((prev) =>
        prev.some((p) => p.id === profile.id) ? prev : [...prev, profile]
      );
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: userId, followee_id: profile.id });
      if (error && error.code !== '23505') {
        setFollowing((prev) => prev.filter((p) => p.id !== profile.id));
        return 'error';
      }
      return 'ok';
    },
    [userId]
  );

  const unfollow = useCallback<SocialContextValue['unfollow']>(
    async (targetId) => {
      if (!userId) return 'error';
      const before = following;
      setFollowing((prev) => prev.filter((p) => p.id !== targetId));
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('followee_id', targetId);
      if (error) {
        setFollowing(before);
        refresh();
        return 'error';
      }
      return 'ok';
    },
    [userId, following, refresh]
  );

  const followVenue = useCallback<SocialContextValue['followVenue']>(
    async (venueId) => {
      if (!userId) return 'logged-out';
      setVenueIds((prev) => new Set(prev).add(venueId));
      const { error } = await supabase
        .from('venue_followers')
        .insert({ user_id: userId, venue_id: venueId });
      if (error && error.code !== '23505') {
        setVenueIds((prev) => {
          const next = new Set(prev);
          next.delete(venueId);
          return next;
        });
        return 'error';
      }
      return 'ok';
    },
    [userId]
  );

  const unfollowVenue = useCallback<SocialContextValue['unfollowVenue']>(
    async (venueId) => {
      if (!userId) return 'error';
      setVenueIds((prev) => {
        const next = new Set(prev);
        next.delete(venueId);
        return next;
      });
      const { error } = await supabase
        .from('venue_followers')
        .delete()
        .eq('user_id', userId)
        .eq('venue_id', venueId);
      if (error) {
        setVenueIds((prev) => new Set(prev).add(venueId));
        return 'error';
      }
      return 'ok';
    },
    [userId]
  );

  const followingIds = useMemo(() => new Set(following.map((p) => p.id)), [following]);

  const value = useMemo<SocialContextValue>(
    () => ({
      following,
      followingIds,
      loading,
      isFollowing: (id: string) => followingIds.has(id),
      follow,
      unfollow,
      refresh,
      isFollowingVenue: (id: string) => venueIds.has(id),
      followVenue,
      unfollowVenue,
    }),
    [following, followingIds, loading, follow, unfollow, refresh, venueIds, followVenue, unfollowVenue]
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>');
  return ctx;
}
