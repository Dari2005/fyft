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
  /** People (friends and organizers) the signed-in user follows. */
  following: ProfileLite[];
  followingIds: Set<string>;
  /** party id -> followed people who RSVP'd "going" (the "friends going" row). */
  friendsGoing: Record<string, ProfileLite[]>;
  loading: boolean;
  isFollowing: (userId: string) => boolean;
  /** 'logged-out' when there is no user (caller sends them to sign in). */
  follow: (profile: ProfileLite) => Promise<'ok' | 'logged-out' | 'error'>;
  unfollow: (userId: string) => Promise<'ok' | 'error'>;
  refresh: () => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

/**
 * Holds who the user follows and which of those people are going to which
 * events. One shared copy, so the Tonight tab, the event list, the event page
 * and profile screens all agree and a follow button flips everywhere at once.
 */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [following, setFollowing] = useState<ProfileLite[]>([]);
  const [friendsGoing, setFriendsGoing] = useState<Record<string, ProfileLite[]>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFollowing([]);
      setFriendsGoing({});
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

      if (list.length === 0) {
        setFriendsGoing({});
        return;
      }
      const { data: rsvps, error: rErr } = await supabase
        .from('rsvps')
        .select('party_id, user_id')
        .eq('status', 'going')
        .in(
          'user_id',
          list.map((p) => p.id)
        );
      if (rErr) throw rErr;

      const byId = new Map(list.map((p) => [p.id, p]));
      const map: Record<string, ProfileLite[]> = {};
      for (const r of rsvps ?? []) {
        const person = byId.get(r.user_id);
        if (person) (map[r.party_id] ??= []).push(person);
      }
      setFriendsGoing(map);
    } catch {
      // Social info is a bonus layer — never block the screens if it fails.
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
      refresh(); // pull in their upcoming "going" RSVPs
      return 'ok';
    },
    [userId, refresh]
  );

  const unfollow = useCallback<SocialContextValue['unfollow']>(
    async (targetId) => {
      if (!userId) return 'error';
      const before = following;
      setFollowing((prev) => prev.filter((p) => p.id !== targetId));
      setFriendsGoing((prev) => {
        const next: Record<string, ProfileLite[]> = {};
        for (const [partyId, people] of Object.entries(prev)) {
          const kept = people.filter((p) => p.id !== targetId);
          if (kept.length) next[partyId] = kept;
        }
        return next;
      });
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
      friendsGoing,
      loading,
      isFollowing: (id: string) => followingIds.has(id),
      follow,
      unfollow,
      refresh,
    }),
    [following, followingIds, friendsGoing, loading, follow, unfollow, refresh]
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>');
  return ctx;
}
