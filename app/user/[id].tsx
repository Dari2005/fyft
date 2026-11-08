import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import { parsePartyMedia, type Party, type ProfileLite } from '@/lib/types';
import { LIVE_WINDOW_MS } from '@/lib/tonight';
import Avatar from '@/components/Avatar';
import FollowButton from '@/components/FollowButton';
import PartyCard from '@/components/PartyCard';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';

function mapParty(row: Record<string, any>): Party {
  return {
    id: row.id,
    organizer_id: row.organizer_id,
    title: row.title,
    description: row.description,
    party_type: row.party_type ?? null,
    media: parsePartyMedia(row.media),
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    starts_at: row.starts_at,
    capacity: row.capacity,
    created_at: row.created_at,
    organizer_username: row.profiles?.username ?? undefined,
  };
}

/**
 * Another user's public profile: follow button, follower counts, the events
 * they organize and the events they are going to.
 */
export default function UserProfileScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { friendsGoing } = useSocial();
  const navigation = useNavigation();

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [organizing, setOrganizing] = useState<Party[]>([]);
  const [going, setGoing] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
        const [prof, fers, fing, org, rsvps] = await Promise.all([
          supabase.from('profiles').select('id, username, avatar_url').eq('id', id).single(),
          supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', id),
          supabase.from('follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', id),
          supabase
            .from('parties')
            .select('*, profiles!parties_organizer_id_fkey(username)')
            .eq('organizer_id', id)
            .gte('starts_at', since)
            .order('starts_at', { ascending: true }),
          supabase
            .from('rsvps')
            .select('party_id, parties!inner(*, profiles!parties_organizer_id_fkey(username))')
            .eq('user_id', id)
            .eq('status', 'going')
            .gte('parties.starts_at', since),
        ]);
        if (prof.error) throw prof.error;
        setProfile(prof.data as ProfileLite);
        setFollowers(fers.count ?? 0);
        setFollowingCount(fing.count ?? 0);
        setOrganizing((org.data ?? []).map(mapParty));
        const goingParties = (rsvps.data ?? [])
          .map((r: any) => (Array.isArray(r.parties) ? r.parties[0] : r.parties))
          .filter(Boolean)
          .map(mapParty)
          .sort((a: Party, b: Party) => a.starts_at.localeCompare(b.starts_at));
        setGoing(goingParties);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load this profile.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (profile?.username) navigation.setOptions({ title: `@${profile.username}` });
  }, [profile, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Profile not found.'}</Text>
      </View>
    );
  }

  const isMe = user?.id === profile.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar profile={profile} size={84} />
        <Text style={styles.name}>@{profile.username ?? 'user'}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>
            <Text style={styles.statNum}>{followers}</Text> followers
          </Text>
          <Text style={styles.stat}>
            <Text style={styles.statNum}>{followingCount}</Text> following
          </Text>
        </View>
        {!isMe && <FollowButton profile={profile} />}
      </View>

      <Text style={styles.sectionTitle}>Organizing ({organizing.length})</Text>
      {organizing.length === 0 ? (
        <Text style={styles.empty}>No upcoming events.</Text>
      ) : (
        organizing.map((p) => <PartyCard key={p.id} party={p} friendsGoing={friendsGoing[p.id]} />)
      )}

      <Text style={styles.sectionTitle}>Going to ({going.length})</Text>
      {going.length === 0 ? (
        <Text style={styles.empty}>Not going to anything yet.</Text>
      ) : (
        going.map((p) => <PartyCard key={p.id} party={p} friendsGoing={friendsGoing[p.id]} />)
      )}
    </ScrollView>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  error: { color: Colors.danger, fontSize: 14 },
  header: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.xs },
  name: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.sm },
  stat: { color: Colors.muted, fontSize: 14 },
  statNum: { color: Colors.text, fontWeight: '800' },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  empty: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.sm },
});
