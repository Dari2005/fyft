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
}

const SocialContext = createContext<SocialContextValue | null>(null);

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

  const refresh = useCallback(async () => {
    if (!userId) {
      setFollowing([]);
      return;
    }
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
    }),
    [following, followingIds, loading, follow, unfollow, refresh]
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>');
  return ctx;
}
