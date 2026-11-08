import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import { onRsvpChanged } from '@/lib/notifications';
import { isLiveNow } from '@/lib/tonight';
import { useRsvps, type RsvpStatus } from '@/hooks/useRsvps';
import { useComments } from '@/hooks/useComments';
import { reportParty } from '@/lib/reports';
import Avatar from '@/components/Avatar';
import FollowButton from '@/components/FollowButton';
import Icon, { type IconName } from '@/components/Icon';
import { Accent, Colors, Spacing } from '@/constants/theme';
import { parsePartyMedia, type Party } from '@/lib/types';

const REPORT_REASONS = ['spam', 'fake event', 'inappropriate content', 'other'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 300;
const DOCK_HEIGHT = 68;

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "SAT 14 NOV · 23:00" — same format as the event card. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
}

/** "Ana is going" / "Ana and Marko are going" / "Ana, Marko and 3 more you follow are going" */
function friendsSentence(friends: { username: string | null }[]): string {
  const names = friends.map((f) => f.username ?? 'user');
  if (names.length === 1) return `${names[0]} is going`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are going`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more you follow are going`;
}

/** One video in the hero gallery, with native playback controls. */
function GalleryVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.heroItem} nativeControls contentFit="cover" />;
}

/** Round glass button floating over the hero (back / share). */
function FloatButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.floatButton} accessibilityLabel={label} hitSlop={6}>
      <Icon name={icon} size={18} color={Colors.text} />
    </TouchableOpacity>
  );
}

/**
 * Event detail ("Dark Glass", 2026-11-08): photo/video hero that fades into
 * the background, date line + title + type, one glass info block (place +
 * Directions, going/capacity, friends), host, description, and a dock with
 * Going / Interested / Chat that stays on screen while scrolling.
 */
export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [party, setParty] = useState<Party | null>(null);
  const [organizerAvatar, setOrganizerAvatar] = useState<string | null>(null);
  const { friendsGoing } = useSocial();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  const {
    goingCount,
    interestedCount,
    myStatus,
    loading: rsvpLoading,
    actionLoading,
    error: rsvpError,
    toggleRsvp,
  } = useRsvps(id, user?.id ?? null);

  // Messages live in the chat screen; here we only need the count.
  const { comments } = useComments(id, user?.id ?? null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('parties')
          .select('*, profiles!parties_organizer_id_fkey(username, avatar_url)')
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
        setOrganizerAvatar(data.profiles?.avatar_url ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleRsvp = async (status: RsvpStatus) => {
    const adding = myStatus !== status;
    const result = await toggleRsvp(status);
    if (result === 'ok' && user) {
      // Ask for notification permission on the first RSVP, and (re)schedule
      // the "starts in 1 hour" reminder — or cancel it when the RSVP is removed.
      onRsvpChanged(user.id, adding);
    }
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
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open navigation.'));
  };

  const handleShare = () => {
    if (!party) return;
    const lines = [party.title, formatWhen(party.starts_at), party.address, 'via Fyft'];
    Share.share({ message: lines.filter(Boolean).join('\n') }).catch(() => {});
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
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
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error ?? 'Event not found.'}</Text>
        <TouchableOpacity onPress={goBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasMedia = party.media.length > 0;
  const hasLocation = party.latitude != null && party.longitude != null;
  const live = isLiveNow(party.starts_at);
  const isFull = party.capacity != null && goingCount >= party.capacity;
  const capacityPct =
    party.capacity != null && party.capacity > 0
      ? Math.min(100, (goingCount / party.capacity) * 100)
      : 0;
  const goingLabel = [
    party.capacity != null ? `${goingCount} / ${party.capacity} going` : `${goingCount} going`,
    interestedCount > 0 ? `${interestedCount} interested` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const friends = friendsGoing[party.id] ?? [];
  const isOrganizer = user?.id === party.organizer_id;
  const busy = actionLoading || rsvpLoading;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: DOCK_HEIGHT + insets.bottom + Spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {hasMedia ? (
          <View style={styles.hero}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setSlide(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
              }
            >
              {party.media.map((m, i) =>
                m.type === 'image' ? (
                  <Image
                    key={`${m.url}-${i}`}
                    source={{ uri: m.url }}
                    style={styles.heroItem}
                    resizeMode="cover"
                  />
                ) : (
                  <GalleryVideo key={`${m.url}-${i}`} url={m.url} />
                )
              )}
            </ScrollView>
            {/* Fade the photo into the background. */}
            <Svg style={styles.heroFade} width={SCREEN_WIDTH} height={110} pointerEvents="none">
              <Defs>
                <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Colors.background} stopOpacity="0" />
                  <Stop offset="1" stopColor={Colors.background} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={SCREEN_WIDTH} height={110} fill="url(#fade)" />
            </Svg>
            {party.media.length > 1 && (
              <View style={styles.dots} pointerEvents="none">
                {party.media.map((m, i) => (
                  <View key={`${m.url}-dot-${i}`} style={[styles.dot, i === slide && styles.dotActive]} />
                ))}
              </View>
            )}
            <View style={[styles.floatRow, { top: insets.top + Spacing.xs }]}>
              <FloatButton icon="arrowLeft" onPress={goBack} label="Back" />
              <FloatButton icon="share" onPress={handleShare} label="Share" />
            </View>
          </View>
        ) : (
          <View style={[styles.floatRowStatic, { paddingTop: insets.top + Spacing.xs }]}>
            <FloatButton icon="arrowLeft" onPress={goBack} label="Back" />
            <FloatButton icon="share" onPress={handleShare} label="Share" />
          </View>
        )}

        <View style={[styles.body, hasMedia && styles.bodyOverHero]}>
          <View style={styles.whenRow}>
            <Text style={styles.when}>{formatWhen(party.starts_at)}</Text>
            {live && (
              <View style={styles.live}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{party.title}</Text>
          {party.party_type ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{party.party_type}</Text>
            </View>
          ) : null}

          {/* Info block: place, going/capacity, friends. */}
          <View style={styles.infoBox}>
            {(party.address || hasLocation) && (
              <View style={styles.infoRow}>
                <Icon name="pin" size={17} color={Colors.muted} />
                <Text style={styles.infoText} numberOfLines={2}>
                  {party.address ?? 'Location on the map'}
                </Text>
                {hasLocation && (
                  <TouchableOpacity onPress={openNavigation} style={styles.miniButton}>
                    <Icon name="navigate" size={13} color={Colors.primaryBright} />
                    <Text style={styles.miniButtonText}>Directions</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={[styles.infoRow, styles.infoRowDivider, styles.infoRowColumn]}>
              <View style={styles.infoInline}>
                <Icon name="users" size={17} color={Colors.muted} />
                <Text style={styles.infoText}>{goingLabel}</Text>
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
            </View>
            {friends.length > 0 && (
              <View style={[styles.infoRow, styles.infoRowDivider]}>
                <View style={styles.friendsAvatars}>
                  {friends.slice(0, 5).map((f, i) => (
                    <Link key={f.id} href={{ pathname: '/user/[id]', params: { id: f.id } }} asChild>
                      <TouchableOpacity style={[styles.friendAvatar, i > 0 && styles.friendAvatarOverlap]}>
                        <Avatar profile={f} size={26} />
                      </TouchableOpacity>
                    </Link>
                  ))}
                </View>
                <Text style={styles.infoText} numberOfLines={2}>
                  {friendsSentence(friends)}
                </Text>
              </View>
            )}
          </View>

          {party.organizer_username && (
            <>
              <Text style={styles.sectionTitle}>Hosted by</Text>
              <View style={styles.hostBox}>
                <Link href={{ pathname: '/user/[id]', params: { id: party.organizer_id } }} asChild>
                  <TouchableOpacity style={styles.hostInfo} activeOpacity={0.7}>
                    <Avatar
                      profile={{ username: party.organizer_username, avatar_url: organizerAvatar }}
                      size={34}
                    />
                    <Text style={styles.hostName} numberOfLines={1}>
                      @{party.organizer_username}
                    </Text>
                  </TouchableOpacity>
                </Link>
                {!isOrganizer && (
                  <FollowButton
                    compact
                    profile={{
                      id: party.organizer_id,
                      username: party.organizer_username,
                      avatar_url: organizerAvatar,
                    }}
                  />
                )}
              </View>
            </>
          )}

          {party.description ? (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{party.description}</Text>
            </>
          ) : null}

          {rsvpError && <Text style={styles.error}>{rsvpError}</Text>}

          {isOrganizer && (
            <View style={styles.ownerRow}>
              <TouchableOpacity
                style={styles.ownerButton}
                onPress={() => router.push({ pathname: '/create', params: { edit: party.id } })}
              >
                <Icon name="edit" size={16} color={Colors.text} />
                <Text style={styles.ownerText}>Edit event</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerButton} onPress={handleDeletePress}>
                <Icon name="trash" size={16} color={Colors.danger} />
                <Text style={[styles.ownerText, { color: Colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={handleReportPress} style={styles.reportButton}>
            <Icon name="flag" size={14} color={Colors.muted} />
            <Text style={styles.reportText}>Report this event</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dock: always on screen. Active RSVP = bright purple border + check. */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + Spacing.sm }]}>
        {(['going', 'interested'] as const).map((status) => {
          const active = myStatus === status;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.dockButton, active && styles.dockButtonActive]}
              onPress={() => handleRsvp(status)}
              disabled={busy}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator size="small" color={Colors.primaryBright} />
              ) : (
                <>
                  {active && <Icon name="check" size={16} color={Colors.primaryBright} strokeWidth={2.4} />}
                  <Text style={[styles.dockText, active && styles.dockTextActive]}>
                    {status === 'going' ? 'Going' : 'Interested'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.dockChat}
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: party.id } })}
          accessibilityLabel="Open event chat"
        >
          <Icon name="chat" size={19} color={Colors.text} />
          {comments.length > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>
                {comments.length > 99 ? '99+' : comments.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  backLink: { marginTop: Spacing.md, ...Accent.outline, borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  backLinkText: { color: Colors.text, fontWeight: '700' },

  hero: { height: HERO_HEIGHT, backgroundColor: Colors.surface },
  heroItem: { width: SCREEN_WIDTH, height: HERO_HEIGHT, backgroundColor: Colors.surface },
  heroFade: { position: 'absolute', left: 0, bottom: 0 },
  dots: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 16, backgroundColor: Colors.primaryBright },
  floatRow: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatRowStatic: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  floatButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  bodyOverHero: { marginTop: -Spacing.md },
  whenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  when: { color: Colors.primaryBright, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { color: Colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { color: Colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginTop: -2 },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },

  infoBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    marginTop: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
  },
  infoRowDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  infoRowColumn: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  infoInline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { flex: 1, color: '#d0d0d8', fontSize: 14 },
  miniButton: {
    ...Accent.outline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  miniButtonText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  fullBadge: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  fullBadgeText: { color: Colors.danger, fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.surfaceHigh, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  progressFillFull: { backgroundColor: Colors.danger },
  friendsAvatars: { flexDirection: 'row' },
  friendAvatar: { borderWidth: 1.5, borderColor: Colors.surface, borderRadius: 15 },
  friendAvatarOverlap: { marginLeft: -8 },

  sectionTitle: { color: Colors.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.sm },
  hostBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.sm,
  },
  hostInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  hostName: { color: Colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  description: { color: '#c4c4cc', fontSize: 15, lineHeight: 23 },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },

  ownerRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  ownerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
  },
  ownerText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  reportText: { color: Colors.muted, fontSize: 13 },

  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.glass,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dockButton: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  dockButtonActive: { ...Accent.outline },
  dockText: { color: '#d0d0d8', fontSize: 15, fontWeight: '700' },
  dockTextActive: { color: Colors.primaryText },
  dockChat: {
    width: 52,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    ...Accent.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: { color: Colors.primaryText, fontSize: 11, fontWeight: '800' },
});
