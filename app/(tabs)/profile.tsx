import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import { useParties } from '@/hooks/useParties';
import { supabase } from '@/lib/supabase';
import { uploadPartyMedia } from '@/lib/media';
import { LIVE_WINDOW_MS } from '@/lib/tonight';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import AppearancePicker from '@/components/AppearancePicker';
import Icon, { type IconName } from '@/components/Icon';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useTheme, useThemedStyles, type ThemePreference } from '@/lib/ThemeContext';

type ListTab = 'mine' | 'plans';

/** One tappable row in the Profile settings list. */
function SettingsRow({
  icon,
  label,
  href,
  detail,
}: {
  icon: IconName;
  label: string;
  href: '/people' | '/notifications';
  detail?: string;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Link href={href} asChild>
      <Pressable style={styles.row}>
        <Icon name={icon} size={18} color={Colors.muted} />
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
        <Icon name="arrowRight" size={16} color={Colors.muted} />
      </Pressable>
    </Link>
  );
}

const APPEARANCE: { key: ThemePreference; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/**
 * Profile tab (2026-11-08): the whole screen scrolls. Avatar + name, a
 * settings list (Organizers you follow, Notifications, Appearance), then
 * two tabs: "My events" (published by me) and "My plans" (events I'm going
 * to — visible only to me), and Sign out at the bottom.
 */
export default function ProfileScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();
  const { user, signOut } = useAuth();
  const { parties, refresh } = useParties();
  const { following } = useSocial();
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tab, setTab] = useState<ListTab>('mine');
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());
  // "Now" for hiding past plans; refreshed whenever the tab gains focus.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();
      setUsername(data?.username ?? null);
      setAvatarUrl(data?.avatar_url ?? null);
    })();
  }, [user]);

  /** Events I said "going" to (my own RSVPs only). */
  const loadPlans = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('rsvps')
      .select('party_id')
      .eq('user_id', user.id)
      .eq('status', 'going');
    setPlanIds(new Set((data ?? []).map((r) => r.party_id as string)));
  }, [user]);

  // Refresh when the tab gains focus (a new RSVP or event shows up here).
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      refresh();
      loadPlans();
    }, [refresh, loadPlans])
  );

  /** Pick a square profile picture, upload it, and save it on the profile. */
  const changeAvatar = async () => {
    if (!user || uploadingAvatar) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access so you can set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadPartyMedia(user.id, [result.assets[0]]);
      const url = uploaded[0]?.url;
      if (!url) throw new Error('Upload failed');
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
    } catch {
      Alert.alert('Error', 'Could not update your profile picture. Try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Icon name="users" size={44} color={Colors.muted} strokeWidth={1.6} />
        <Text style={styles.title}>You are not signed in</Text>
        <Text style={styles.subtitle}>Sign in to publish events and keep track of your plans.</Text>
        <Link href="/auth" asChild>
          <PrimaryButton title="Sign In" onPress={() => {}} />
        </Link>
        <AppearancePicker />
      </View>
    );
  }

  const since = now - LIVE_WINDOW_MS;
  const myEvents = parties.filter((p) => p.organizer_id === user.id);
  const myPlans = parties
    .filter((p) => planIds.has(p.id) && new Date(p.starts_at).getTime() >= since)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const list = tab === 'mine' ? myEvents : myPlans;
  const displayName = username ?? user.email?.split('@')[0] ?? 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm }]}
    >
      <Text style={styles.heading}>Profile</Text>

      {/* Avatar + name */}
      <View style={styles.head}>
        <Pressable onPress={changeAvatar} disabled={uploadingAvatar} accessibilityLabel="Change photo">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={Colors.primaryBright} />
            ) : (
              <Icon name="edit" size={12} color={Colors.text} />
            )}
          </View>
        </Pressable>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      {/* Settings list */}
      <View style={styles.card}>
        <SettingsRow
          icon="star"
          label="Organizers"
          href="/people"
          detail={`${following.length} following`}
        />
        <View style={styles.divider} />
        <SettingsRow icon="bell" label="Notifications" href="/notifications" />
        <View style={styles.divider} />
        <View style={styles.row}>
          <Icon name="sun" size={18} color={Colors.muted} />
          <Text style={styles.rowLabel}>Appearance</Text>
          <View style={styles.segment}>
            {APPEARANCE.map((o) => (
              <TouchableOpacity
                key={o.key}
                onPress={() => setPreference(o.key)}
                style={[styles.segmentItem, preference === o.key && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, preference === o.key && styles.segmentTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* My events | My plans */}
      <View style={styles.tabs}>
        {(
          [
            ['mine', `My events · ${myEvents.length}`],
            ['plans', `My plans · ${myPlans.length}`],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'plans' && <Text style={styles.privateNote}>Only you can see your plans.</Text>}

      {list.map((p) => (
        <PartyCard key={p.id} party={p} />
      ))}
      {list.length === 0 && (
        <Text style={styles.empty}>
          {tab === 'mine'
            ? "You haven't published any events yet."
            : 'Tap "Going" on an event and it shows up here.'}
        </Text>
      )}
      {tab === 'mine' && (
        <TouchableOpacity style={styles.newButton} onPress={() => router.push('/create')}>
          <Icon name="plus" size={16} color={Colors.primaryBright} strokeWidth={2.4} />
          <Text style={styles.newButtonText}>New event</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={signOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
    center: {
      flex: 1,
      backgroundColor: Colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: Colors.muted, fontSize: 14, textAlign: 'center', marginBottom: Spacing.md },
    heading: { color: Colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },

    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.xs },
    avatar: {
      width: 68,
      height: 68,
      borderRadius: 34,
      ...outline(Colors),
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: Colors.primaryText, fontSize: 28, fontWeight: '800' },
    avatarImage: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 1,
      borderColor: Colors.primary,
      backgroundColor: Colors.surface,
    },
    cameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headText: { flex: 1 },
    name: { color: Colors.text, fontSize: 19, fontWeight: '700' },
    email: { color: Colors.muted, fontSize: 13, marginTop: 2 },

    card: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 16,
    },
    divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 44 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 13,
    },
    rowLabel: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
    rowDetail: { color: Colors.muted, fontSize: 13 },
    segment: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 999,
      padding: 2,
    },
    segmentItem: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
    segmentActive: { ...outline(Colors) },
    segmentText: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
    segmentTextActive: { color: Colors.primaryText },

    tabs: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 999,
      padding: 3,
      marginTop: Spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabActive: { ...outline(Colors) },
    tabText: { color: Colors.muted, fontSize: 14, fontWeight: '700' },
    tabTextActive: { color: Colors.primaryText },
    privateNote: { color: Colors.muted, fontSize: 12, textAlign: 'center' },
    empty: { color: Colors.muted, fontSize: 14, textAlign: 'center', marginVertical: Spacing.md },
    newButton: {
      ...outline(Colors),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 14,
      paddingVertical: 12,
    },
    newButtonText: { color: Colors.primaryText, fontSize: 15, fontWeight: '700' },
    signOut: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
    signOutText: { color: Colors.danger, fontSize: 15, fontWeight: '600' },
  });
