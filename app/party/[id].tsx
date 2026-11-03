import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line, Path } from 'react-native-svg';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useRsvps, type RsvpStatus } from '@/hooks/useRsvps';
import { useComments } from '@/hooks/useComments';
import { reportParty } from '@/lib/reports';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import { parsePartyMedia, type Party } from '@/lib/types';

const REPORT_REASONS = ['spam', 'fake event', 'inappropriate content', 'other'];

const GALLERY_WIDTH = Dimensions.get('window').width - Spacing.md * 2;

/** One video in the party gallery, with native playback controls. */
function GalleryVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={styles.galleryItem}
      nativeControls
      contentFit="cover"
    />
  );
}

/** Party detail screen: info, RSVP with live capacity, report button. */
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

  // Comments live in the party chat screen now — here we only need the count
  // for the "Join chat" button.
  const { comments } = useComments(id, user?.id ?? null);

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
          party_type: data.party_type ?? null,
          media: parsePartyMedia(data.media),
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
      Alert.alert('Sign In', 'You must be signed in to report an event.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    const result = await reportParty(id, user.id, reason);
    if (result === 'ok') {
      Alert.alert('Thank you!', 'We received your report and will review it.');
    } else if (result === 'already-reported') {
      Alert.alert('Already reported', 'You already reported this event.');
    } else {
      Alert.alert('Error', 'Report failed. Try again.');
    }
  };

  const handleReportPress = () => {
    Alert.alert('Report this event', 'Why are you reporting this event?', [
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
    Alert.alert('Delete this event?', 'This action cannot be undone.', [
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
        <Text style={styles.error}>{error ?? 'Event not found.'}</Text>
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
      {/* Header: name first, navigation as a small square top-right. */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, styles.titleFlex]}>{party.title}</Text>
        {party.latitude != null && party.longitude != null && (
          <TouchableOpacity
            onPress={openNavigation}
            style={styles.navSquare}
            accessibilityLabel="Navigate to the event"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path
                d="M22 2 15 22l-4-9-9-4z"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Line
                x1={22}
                y1={2}
                x2={11}
                y2={13}
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )}
      </View>
      {party.party_type && (
        <View style={styles.venueRow}>
          <View style={styles.typeTag}>
            <Text style={styles.typeTagText}>{party.party_type}</Text>
          </View>
        </View>
      )}
      <Text style={styles.meta}>
        {new Date(party.starts_at).toLocaleString('en-US', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      {party.address && (
        <View style={styles.addressRow}>
          <Text style={styles.meta}>📍</Text>
          <Text style={[styles.meta, styles.addressText]}>{party.address}</Text>
        </View>
      )}
      {party.description && <Text style={styles.description}>{party.description}</Text>}

      {party.media.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.gallery}
        >
          {party.media.map((m, i) =>
            m.type === 'image' ? (
              <Image
                key={`${m.url}-${i}`}
                source={{ uri: m.url }}
                style={styles.galleryItem}
                resizeMode="cover"
              />
            ) : (
              <GalleryVideo key={`${m.url}-${i}`} url={m.url} />
            )
          )}
        </ScrollView>
      )}

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
            title="Going"
            icon={myStatus === 'going' ? '✅' : undefined}
            variant={myStatus === 'going' ? 'primary' : 'outline'}
            onPress={() => handleRsvp('going')}
            loading={actionLoading || rsvpLoading}
          />
        </View>
        <View style={styles.rsvpButton}>
          <PrimaryButton
            title="Interested"
            icon={myStatus === 'interested' ? '⭐' : undefined}
            variant={myStatus === 'interested' ? 'primary' : 'outline'}
            onPress={() => handleRsvp('interested')}
            loading={actionLoading || rsvpLoading}
          />
        </View>
      </View>
      {rsvpError && <Text style={styles.error}>{rsvpError}</Text>}

      <View style={styles.chatButton}>
        <PrimaryButton
          icon="💬"
          title={
            comments.length > 0
              ? `Join event chat (${comments.length})`
              : 'Join event chat'
          }
          onPress={() =>
            router.push({ pathname: '/chat/[id]', params: { id: party.id } })
          }
        />
      </View>

      <TouchableOpacity onPress={handleReportPress} style={styles.reportButton}>
        <Text style={styles.reportText}>🚩</Text>
        <Text style={styles.reportText}>Report this event</Text>
      </TouchableOpacity>

      {user?.id === party.organizer_id && (
        <View style={styles.organizerRow}>
          <View style={styles.rsvpButton}>
            <PrimaryButton
              title="Edit event"
              icon="✏️"
              variant="outline"
              onPress={() =>
                router.push({ pathname: '/create', params: { edit: party.id } })
              }
            />
          </View>
          <View style={styles.rsvpButton}>
            <PrimaryButton
              title="Delete event"
              icon="🗑️"
              variant="outline"
              onPress={handleDeletePress}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.sm },
  typeTag: {
    backgroundColor: Colors.primary,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  typeTagText: {
    color: Colors.primaryText,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800', marginTop: Spacing.xs },
  meta: { color: Colors.muted, fontSize: 15, marginTop: Spacing.xs },
  description: { color: Colors.text, fontSize: 16, marginTop: Spacing.md, lineHeight: 24 },
  gallery: { marginTop: Spacing.md },
  galleryItem: {
    width: GALLERY_WIDTH,
    height: 240,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
  },
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
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  reportText: { color: Colors.muted, fontSize: 14 },
  deleteButton: { alignItems: 'center', marginTop: Spacing.xs, paddingVertical: Spacing.sm },
  deleteText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  chatButton: { marginTop: Spacing.md },
  organizerRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  titleFlex: { flex: 1 },
  navSquare: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  addressText: { flex: 1 },
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
  commentAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  commentAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.border },
  commentAvatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: { color: Colors.primaryText, fontSize: 12, fontWeight: '800' },
  commentTime: { color: Colors.muted, fontSize: 12 },
  commentBody: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  commentMedia: {
    width: '100%',
    height: 210,
    borderRadius: 12,
    backgroundColor: Colors.background,
    marginTop: Spacing.xs,
  },
  commentDelete: { color: Colors.danger, fontSize: 13, marginTop: Spacing.xs },
  ratingBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  ratingSummary: { color: Colors.muted, fontSize: 14 },
  ratingHint: { color: Colors.muted, fontSize: 13 },
  ratingRemove: { color: Colors.danger, fontSize: 13, marginTop: 2 },
  emptyComments: {
    color: Colors.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  composer: { marginTop: Spacing.sm },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.sm,
  },
  pendingThumb: { width: 44, height: 44, borderRadius: 8 },
  pendingText: { color: Colors.text, fontSize: 14, flexShrink: 1 },
  pendingRemove: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  attachButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  attachText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  sendButton: { flex: 1 },
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
