import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDialog } from '@/lib/DialogContext';
import { fetchVenueFollowerCount, useVenues } from '@/lib/venues';
import { parsePartyMedia, type Party } from '@/lib/types';
import { isOver, LIVE_WINDOW_MS } from '@/lib/tonight';
import { usePartyStats } from '@/hooks/usePartyStats';
import FollowButton from '@/components/FollowButton';
import Icon from '@/components/Icon';
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
    host_name: row.host_name ?? null,
    venue_id: row.venue_id ?? null,
  };
}

/**
 * Venue page (migration_venues.sql): a simple information screen, not a
 * social profile. Name, photo, address + Directions, description, follower
 * NUMBER (followers are private), Follow, and upcoming events at the venue.
 */
export default function VenueScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { notify } = useDialog();
  const { byId, refresh: refreshVenues } = useVenues();
  const venue = byId.get(id) ?? null;
  const { stats } = usePartyStats();

  const [followers, setFollowers] = useState<number | null>(null);
  const [events, setEvents] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
        const [count, res] = await Promise.all([
          fetchVenueFollowerCount(id).catch(() => null),
          supabase
            .from('parties')
            .select('*')
            .eq('venue_id', id)
            .gte('starts_at', since)
            .order('starts_at', { ascending: true }),
        ]);
        if (res.error) throw res.error;
        setFollowers(count);
        setEvents((res.data ?? []).map(mapParty).filter((p) => !isOver(p.starts_at)));
        setError(null);
      } catch (e) {
        setError((e as { message?: string })?.message ?? 'Could not load this venue.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // A venue opened from a link may be newer than the cached list.
    if (!byId.has(id)) refreshVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (venue) navigation.setOptions({ title: venue.name });
  }, [venue, navigation]);

  const openDirections = () => {
    if (venue?.latitude == null || venue?.longitude == null) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
    Linking.openURL(url).catch(() =>
      notify("Couldn't open directions", 'No maps app answered. Try again.')
    );
  };

  if (loading && !venue) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Venue not found.'}</Text>
      </View>
    );
  }

  const hasLocation = venue.latitude != null && venue.longitude != null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {venue.image_url ? (
        <Image
          source={{ uri: venue.image_url }}
          style={styles.cover}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${venue.name}, photo`}
        />
      ) : null}

      <View style={styles.header}>
        <Text style={styles.name}>{venue.name}</Text>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{followers ?? '–'}</Text>{' '}
          {followers === 1 ? 'follower' : 'followers'}
        </Text>
        <FollowButton
          venue={{ id: venue.id, name: venue.name }}
          onChange={(on) => setFollowers((n) => (n == null ? n : Math.max(0, n + (on ? 1 : -1))))}
        />
      </View>

      {(venue.address || hasLocation) && (
        <View style={styles.infoBox}>
          <Icon name="pin" size={17} color={Colors.muted} />
          <Text style={styles.infoText} numberOfLines={2}>
            {venue.address ?? 'Location on the map'}
          </Text>
          {hasLocation && (
            <TouchableOpacity
              onPress={openDirections}
              style={styles.miniButton}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${venue.name}`}
            >
              <Icon name="navigate" size={13} color={Colors.primaryBright} />
              <Text style={styles.miniButtonText}>Directions</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {venue.description ? <Text style={styles.description}>{venue.description}</Text> : null}

      <Text style={styles.sectionTitle}>Upcoming events ({events.length})</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>
          Nothing listed yet. Follow {venue.name} to get a notification when there is.
        </Text>
      ) : (
        events.map((p) => <PartyCard key={p.id} party={p} stats={stats[p.id]} />)
      )}
    </ScrollView>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.md, paddingBottom: Spacing.xl },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.background,
      padding: Spacing.lg,
    },
    error: { color: Colors.danger, fontSize: 14 },
    cover: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 16,
      backgroundColor: Colors.surfaceHigh,
      marginBottom: Spacing.md,
    },
    header: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
    name: { color: Colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
    stat: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.xs },
    statNum: { color: Colors.text, fontWeight: '800' },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 16,
      padding: Spacing.md,
      marginTop: Spacing.sm,
    },
    infoText: { flex: 1, color: Colors.textSoft, fontSize: 15 },
    miniButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: Colors.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    miniButtonText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
    description: {
      color: Colors.textSoft,
      fontSize: 15,
      lineHeight: 22,
      marginTop: Spacing.md,
    },
    sectionTitle: {
      color: Colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    empty: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  });
