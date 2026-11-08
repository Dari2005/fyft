import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import { useParties } from '@/hooks/useParties';
import { usePartyStats } from '@/hooks/usePartyStats';
import { haversineKm } from '@/lib/geo';
import {
  DEFAULT_FILTERS,
  isFiltering as hasFilters,
  makeEventMatcher,
  type EventFilters,
} from '@/lib/eventFilters';
import PartyCard from '@/components/PartyCard';
import EventFilterBar, { FilterChip } from '@/components/EventFilterBar';
import { Colors, Spacing } from '@/constants/theme';

type SortMode = 'soonest' | 'nearest' | 'going';

const SORTS: { key: SortMode; icon: string; label: string }[] = [
  { key: 'soonest', icon: '🕒', label: 'Soonest' },
  { key: 'nearest', icon: '📍', label: 'Near me' },
  { key: 'going', icon: '🔥', label: 'Most going' },
];

/** Events tab: brand header, search, sort + filters (incl. Tonight), event list. */
export default function PartyListScreen() {
  const { user } = useAuth();
  const { parties, loading, error, refresh } = useParties();
  const { stats, refresh: refreshStats } = usePartyStats();
  const { friendsGoing, followingIds, refresh: refreshSocial } = useSocial();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortMode>('soonest');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);

  /** Ask for location permission and read the current position (once). */
  const ensureLocation = useCallback(async (): Promise<boolean> => {
    if (coords) return true;
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Location needed',
          'Allow location access to sort events by distance from you.'
        );
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      return true;
    } catch {
      Alert.alert('Location unavailable', 'Could not read your location.');
      return false;
    } finally {
      setLocating(false);
    }
  }, [coords]);

  const handleSort = async (mode: SortMode) => {
    if (mode === 'nearest') {
      const ok = await ensureLocation();
      if (!ok) return;
    }
    setSort(mode);
  };

  const distanceOf = useCallback(
    (lat: number | null, lon: number | null): number | null => {
      if (!coords || lat == null || lon == null) return null;
      return haversineKm(coords.lat, coords.lon, lat, lon);
    },
    [coords]
  );

  const filtered = useMemo(() => {
    const matches = makeEventMatcher(filters, {
      now: new Date(),
      friendsGoing,
      followingIds,
    });
    return parties.filter(matches).sort((a, b) => {
      switch (sort) {
        case 'nearest': {
          const da = distanceOf(a.latitude, a.longitude);
          const db = distanceOf(b.latitude, b.longitude);
          if (da == null && db == null) return a.starts_at.localeCompare(b.starts_at);
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        }
        case 'going':
          return (stats[b.id]?.goingCount ?? 0) - (stats[a.id]?.goingCount ?? 0);
        default:
          return a.starts_at.localeCompare(b.starts_at);
      }
    });
  }, [parties, filters, friendsGoing, followingIds, sort, stats, distanceOf]);

  const isFiltering = hasFilters(filters);
  const needsLogin = !user && filters.people !== 'all';

  const onRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshStats(), refreshSocial()]);
  }, [refresh, refreshStats, refreshSocial]);

  // Silently refetch whenever the Events tab gains focus, so a newly
  // published event appears without restarting the app.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshStats();
      refreshSocial();
    }, [refresh, refreshStats, refreshSocial])
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.brand}>Fyft</Text>
        <Text style={styles.heading}>Events in Skopje</Text>
      </View>

      <EventFilterBar
        filters={filters}
        onChange={setFilters}
        style={styles.filterBar}
        leadingChips={SORTS.map((s) => (
          <FilterChip
            key={s.key}
            icon={s.icon}
            label={s.key === 'nearest' && locating ? 'Locating…' : s.label}
            active={sort === s.key}
            onPress={() => handleSort(s.key)}
          />
        ))}
      />

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PartyCard
            party={item}
            stats={stats[item.id]}
            friendsGoing={friendsGoing[item.id]}
            distanceKm={
              sort === 'nearest' || coords
                ? distanceOf(item.latitude, item.longitude)
                : null
            }
          />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {error
                  ? "Couldn't load the events"
                  : needsLogin
                    ? 'Sign in to see this'
                    : isFiltering
                      ? 'No events match your filters'
                      : 'No events published yet'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Check that you ran supabase/schema.sql and set up .env'
                  : needsLogin
                    ? 'Follow friends and organizers to see where they are going.'
                    : isFiltering
                      ? 'Try different filters or a different search.'
                      : 'Be the first to publish one!'}
              </Text>
            </View>
          )
        }
      />

      <Link href={user ? '/create' : '/auth'} asChild>
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
          <Text style={styles.fabText}>
            {user ? '＋ New Event' : '＋ Sign in to publish'}
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  brand: { color: Colors.primaryBright, fontSize: 20, fontWeight: '800' },
  heading: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 2 },
  filterBar: { marginTop: Spacing.md },
  list: { padding: Spacing.md, paddingBottom: 96 },
  fab: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 26,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: Colors.primaryText, fontSize: 15, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: Spacing.xl },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
});
