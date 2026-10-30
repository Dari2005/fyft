import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartyComment, PartyMedia } from '@/lib/types';

const MAX_BODY_LENGTH = 1000;

interface UseCommentsResult {
  comments: PartyComment[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  /**
   * Add a comment: text, one photo/video, or both. Returns 'logged-out'
   * when there is no signed-in user (caller redirects to the auth
   * screen), 'ok' on success, 'error' on validation or insert failure.
   */
  addComment: (
    body: string,
    media?: PartyMedia | null
  ) => Promise<'logged-out' | 'ok' | 'error'>;
  deleteComment: (id: string) => Promise<'ok' | 'error'>;
  refresh: () => Promise<void>;
}

/**
 * Manages comments for one party: newest-first list with author usernames,
 * and a realtime subscription on the comments table so new comments appear
 * instantly when anyone posts.
 *
 * NOTE: for realtime to work, the `comments` table must be added to the
 * `supabase_realtime` publication (Dashboard → Database → Replication).
 * If it isn't, comments still appear after the user's own actions via refetch.
 */
export function useComments(partyId: string, userId: string | null): UseCommentsResult {
  const [comments, setComments] = useState<PartyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from('comments')
        .select('*, profiles!comments_user_id_fkey(username, avatar_url)')
        .eq('party_id', partyId)
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;
      setComments(
        (data ?? []).map((row) => ({
          id: row.id,
          party_id: row.party_id,
          user_id: row.user_id,
          body: row.body,
          media_url: row.media_url ?? null,
          media_type: row.media_type ?? null,
          created_at: row.created_at,
          author_username: row.profiles?.username ?? undefined,
          author_avatar_url: row.profiles?.avatar_url ?? null,
        }))
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  // Initial load + realtime subscription for live comment updates.
  useEffect(() => {
    setLoading(true);
    fetchComments();

    const channel = supabase
      .channel(`comments-party-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `party_id=eq.${partyId}` },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partyId, fetchComments]);

  const addComment = useCallback(
    async (
      body: string,
      media?: PartyMedia | null
    ): Promise<'logged-out' | 'ok' | 'error'> => {
      if (!userId) return 'logged-out';
      const trimmed = body.trim();
      if (trimmed.length > MAX_BODY_LENGTH) return 'error';
      if (trimmed.length === 0 && !media) return 'error';
      setActionLoading(true);
      setError(null);
      try {
        const { error: insErr } = await supabase.from('comments').insert({
          party_id: partyId,
          user_id: userId,
          body: trimmed,
          media_url: media?.url ?? null,
          media_type: media?.type ?? null,
        });
        if (insErr) throw insErr;
        await fetchComments();
        return 'ok';
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send comment.');
        return 'error';
      } finally {
        setActionLoading(false);
      }
    },
    [partyId, userId, fetchComments]
  );

  const deleteComment = useCallback(
    async (id: string): Promise<'ok' | 'error'> => {
      setActionLoading(true);
      setError(null);
      try {
        const { error: delErr } = await supabase.from('comments').delete().eq('id', id);
        if (delErr) throw delErr;
        await fetchComments();
        return 'ok';
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete comment.');
        return 'error';
      } finally {
        setActionLoading(false);
      }
    },
    [fetchComments]
  );

  return {
    comments,
    loading,
    actionLoading,
    error,
    addComment,
    deleteComment,
    refresh: fetchComments,
  };
}
