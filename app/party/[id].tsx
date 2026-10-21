import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useRsvps, type RsvpStatus } from '@/hooks/useRsvps';
import { useComments } from '@/hooks/useComments';
import { reportParty } from '@/lib/reports';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

const REPORT_REASONS = ['spam', 'fake party', 'inappropriate content', 'other'];

const formatCommentTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Party detail screen: info, RSVP with live capacity, and report button. */
export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    goingCount,
    interestedCount,
    myStatus,
    loading: rsvpLoading,
    actionLoading,
    error: rsvpError,
    toggleRsvp,
  } = useRsvps(id, user?.id ?? null);

  const {
    comments,
    loading: commentsLoading,
    actionLoading: commentActionLoading,
    error: commentsError,
    addComment,
    deleteComment,
  } = useComments(id, user?.id ?? null);

  const [draft, setDraft] = useState('');
  const composerRef = useRef<TextInput>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('parties')
          .select('*, profiles!parties_organizer_id_fkey(username)')
          .eq('id', id)
          .single();
        if (qErr) throw qErr;
        setParty({
          id: data.id,
          organizer_id: data.organizer_id,
          title: data.title,
          description: data.description,
          venue_type: data.venue_type,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          starts_at: data.starts_at,
          capacity: data.capacity,
          created_at: data.created_at,
          organizer_username: data.profiles?.username ?? undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleRsvp = async (status: RsvpStatus) => {
    const result = await toggleRsvp(status);
    if (result === 'logged-out') {
      Alert.alert('Sign In', 'You must be signed in to RSVP.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
    }
  };

  const submitReport = async (reason: string) => {
    if (!user) {
      Alert.alert('Sign In', 'You must be signed in to report a party.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    const result = await reportParty(id, user.id, reason);
    if (result === 'ok') {
      Alert.alert('Thank you!', 'We received your report and will review it.');
    } else if (result === 'already-reported') {
      Alert.alert('Already reported', 'You already reported this party.');
    } else {
      Alert.alert('Error', 'Report failed. Try again.');
    }
  };

  const handleReportPress = () => {
    Alert.alert('Report this party', 'Why are you reporting this party?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason[0].toUpperCase() + reason.slice(1),
        onPress: () => submitReport(reason),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openNavigation = () => {
    if (party?.latitude == null || party?.longitude == null) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${party.latitude},${party.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open navigation.')
    );
  };

  const handleDeletePress = () => {
    Alert.alert('Delete this party?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: delErr } = await supabase.from('parties').delete().eq('id', id);
          if (delErr) {
            Alert.alert('Error', 'Delete failed. Try again.');
          } else {
            router.replace('/');
          }
        },
      },
    ]);
  };

  const promptLogin = (message: string) => {
    Alert.alert('Sign In', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign In', onPress: () => router.push('/auth') },
    ]);
  };

  const handleSendComment = async () => {
    if (!user) {
      promptLogin('You must be signed in to comment.');
      return;
    }
    const result = await addComment(draft);
    if (result === 'ok') {
      setDraft('');
    } else if (result === 'error' && !commentsError) {
      Alert.alert('Error', 'Comment not sent. Try again.');
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete this comment?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteComment(commentId);
          if (result === 'error') {
            Alert.alert('Error', 'Delete failed. Try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !party) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Party not found.'}</Text>
      </View>
    );
  }

  const isFull = party.capacity != null && goingCount >= party.capacity;
  const capacityPct =
    party.capacity != null && party.capacity > 0
      ? Math.min(100, (goingCount / party.capacity) * 100)
      : 0;
  const capacityLabel =
    party.capacity != null ? `${goingCount} / ${party.capacity} going` : `${goingCount} going`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.venue}>{party.venue_type === 'house' ? '🏠 House party' : '🎶 Club party'}</Text>
      <Text style={styles.title}>{party.title}</Text>
      <Text style={styles.meta}>
        {new Date(party.starts_at).toLocaleString('en-US', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      {party.address && <Text style={styles.meta}>📍 {party.address}</Text>}
      {party.latitude != null && party.longitude != null && (
        <TouchableOpacity onPress={openNavigation} style={styles.navButton}>
          <Text style={styles.navText}>🧭 Navigate to the party</Text>
        </TouchableOpacity>
      )}
      {party.organizer_username && (
        <Text style={styles.meta}>Organizer: @{party.organizer_username}</Text>
      )}
      {party.description && <Text style={styles.description}>{party.description}</Text>}

      <View style={styles.capacityBox}>
        <View style={styles.capacityRow}>
          <Text style={styles.capacityText}>✅ {capacityLabel}</Text>
          {isFull && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>FULL</Text>
            </View>
          )}
        </View>
        {party.capacity != null && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${capacityPct}%` },
                isFull && styles.progressFillFull,
              ]}
            />
          </View>
        )}
        {interestedCount > 0 && (
          <Text style={styles.interested}>⭐ {interestedCount} interested</Text>
        )}
      </View>

      <View style={styles.rsvpRow}>
        <View style={styles.rsvpButton}>
          <PrimaryButton
            title={myStatus === 'going' ? '✅ Going' : 'Going'}
            variant={myStatus === 'going' ? 'primary' : 'outline'}
            onPress={() => handleRsvp('going')}
            loading={actionLoading || rsvpLoading}
          />
        </View>
        <View style={styles.rsvpButton}>
          <PrimaryButton
            title={myStatus === 'interested' ? '⭐ Interested' : 'Interested'}
            variant={myStatus === 'interested' ? 'primary' : 'outline'}
            onPress={() => handleRsvp('interested')}
            loading={actionLoading || rsvpLoading}
          />
        </View>
      </View>
      {rsvpError && <Text style={styles.error}>{rsvpError}</Text>}

      <TouchableOpacity onPress={handleReportPress} style={styles.reportButton}>
        <Text style={styles.reportText}>🚩 Report this party</Text>
      </TouchableOpacity>

      {user?.id === party.organizer_id && (
        <TouchableOpacity onPress={handleDeletePress} style={styles.deleteButton}>
          <Text style={styles.deleteText}>🗑️ Delete this party</Text>
        </TouchableOpacity>
      )}

      <View style={styles.commentsSection}>
        <Text style={styles.sectionTitle}>💬 Comments ({comments.length})</Text>

        {commentsLoading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : comments.length === 0 ? (
          <Text style={styles.emptyComments}>No comments yet. Be the first! 💬</Text>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>
                  @{comment.author_username ?? 'user'}
                </Text>
                <Text style={styles.commentTime}>{formatCommentTime(comment.created_at)}</Text>
              </View>
              <Text style={styles.commentBody}>{comment.body}</Text>
              {user?.id === comment.user_id && (
                <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                  <Text style={styles.commentDelete}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
        {commentsError && <Text style={styles.error}>{commentsError}</Text>}

        <View style={styles.composer}>
          <TextInput
            ref={composerRef}
            style={styles.composerInput}
            placeholder="Write a comment..."
            placeholderTextColor={Colors.muted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            onFocus={() => {
              if (!user) {
                composerRef.current?.blur();
                promptLogin('You must be signed in to comment.');
              }
            }}
          />
          <PrimaryButton
            title="Send"
            onPress={handleSendComment}
            loading={commentActionLoading}
            disabled={draft.trim().length === 0}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  venue: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800', marginTop: Spacing.xs },
  meta: { color: Colors.muted, fontSize: 15, marginTop: Spacing.xs },
  description: { color: Colors.text, fontSize: 16, marginTop: Spacing.md, lineHeight: 24 },
  capacityBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capacityText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  fullBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  fullBadgeText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  progressFillFull: { backgroundColor: Colors.danger },
  interested: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs },
  rsvpRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  rsvpButton: { flex: 1 },
  error: { color: Colors.danger, fontSize: 14, marginTop: Spacing.sm },
  reportButton: { alignItems: 'center', marginTop: Spacing.lg, paddingVertical: Spacing.sm },
  reportText: { color: Colors.muted, fontSize: 14 },
  deleteButton: { alignItems: 'center', marginTop: Spacing.xs, paddingVertical: Spacing.sm },
  deleteText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  navButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  navText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  commentsSection: { marginTop: Spacing.lg },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  commentCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  commentTime: { color: Colors.muted, fontSize: 12 },
  commentBody: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  commentDelete: { color: Colors.danger, fontSize: 13, marginTop: Spacing.xs },
  emptyComments: {
    color: Colors.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  composer: { marginTop: Spacing.sm },
  composerInput: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
});
