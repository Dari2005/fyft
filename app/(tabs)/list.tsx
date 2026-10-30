import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/AuthContext';
import { useParties } from '@/hooks/useParties';
import { usePartyStats } from '@/hooks/usePartyStats';
import { haversineKm } from '@/lib/geo';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

type SortMode = 'soonest' | 'nearest' | 'rated' | 'going';
type TimeFilter = 'all' | 'today' | 'weekend';

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'soonest', label: '🕒 Soonest' },
  { key: 'nearest', label: '📍 Near me' },
  { key: 'rated', label: '★ Top rated' },
  { key: 'going', label: '🔥 Most going' },
];

const TIMES: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'weekend', label: 'This weekend' },
];

/** True when the date falls on the coming Saturday/Sunday (or this one). */
function isWeekend(d: Date): boolean {
  const day = d.getDay();
  if (day === 6 || day === 0) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  const only = new Date(d);
  only.setHours(0, 0, 0, 0);
  return only.getTime() === saturday.getTime() || only.getTime() === sunday.getTime();
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Party list tab (left tab): brand header, search, filters/sort, party list. */
export default function PartyListScreen() {
  const { user } = useAuth();
  const { parties, loading, error, refresh } = useParties();
  const { stats, refresh: refreshStats } = usePartyStats();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('soonest');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
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
          'Allow location access to sort parties by distance from you.'
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
    const q = query.trim().toLowerCase();
    const now = new Date();
    let list = parties.filter((p) => {
      if (
        q &&
        !(
          p.title.toLowerCase().includes(q) ||
          (p.address?.toLowerCase().includes(q) ?? false)
        )
      ) {
        return false;
      }
      if (timeFilter === 'today') return sameDay(new Date(p.starts_at), now);
      if (timeFilter === 'weekend') return isWeekend(new Date(p.starts_at));
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'nearest': {
          const da = distanceOf(a.latitude, a.longitude);
          const db = distanceOf(b.latitude, b.longitude);
          if (da == null && db == null) return a.starts_at.localeCompare(b.starts_at);
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        }
        case 'rated': {
          const sa = stats[a.id];
          const sb = stats[b.id];
          const avA = sa?.average ?? -1;
          const avB = sb?.average ?? -1;
          if (avB !== avA) return avB - avA;
          return (sb?.ratingCount ?? 0) - (sa?.ratingCount ?? 0);
        }
        case 'going': {
          return (stats[b.id]?.goingCount ?? 0) - (stats[a.id]?.goingCount ?? 0);
        }
        default:
          return a.starts_at.localeCompare(b.starts_at);
      }
    });
    return list;
  }, [parties, query, timeFilter, sort, stats, distanceOf]);

  const isFiltering = query.trim() !== '' || timeFilter !== 'all';

  const onRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshStats()]);
  }, [refresh, refreshStats]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.brand}>Fyft</Text>
        <Text style={styles.heading}>Parties in Skopje</Text>
      </View>

      <View style={styles.actions}>
        {user ? (
          <Link href="/create" asChild style={styles.grow}>
            <PrimaryButton title="＋ New Party" onPress={() => {}} />
          </Link>
        ) : (
          <Link href="/auth" asChild style={styles.grow}>
            <PrimaryButton title="Sign in to publish a party" onPress={() => {}} />
          </Link>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a party or address…"
          placeholderTextColor={Colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query !== '' && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            onPress={() => handleSort(s.key)}
            style={[styles.chip, sort === s.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, sort === s.key && styles.chipTextActive]}>
              {s.key === 'nearest' && locating ? '📍 Locating…' : s.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.chipDivider} />
        {TIMES.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTimeFilter(t.key)}
            style={[styles.chip, timeFilter === t.key && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, timeFilter === t.key && styles.chipTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PartyCard
            party={item}
            stats={stats[item.id]}
            distanceKm={
              sort === 'nearest' || coords
                ? distanceOf(item.latitude, item.longitude)
                : null
            }
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {error
                  ? "Couldn't load the parties"
                  : isFiltering
                    ? 'No parties match your filters'
                    : 'No parties published yet'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Check that you ran supabase/schema.sql and set up .env'
                  : isFiltering
                    ? 'Try different filters or a different search.'
                    : 'Be the first to publish one!'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  brand: { color: Colors.primaryBright, fontSize: 20, fontWeight: '800' },
  heading: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  grow: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearText: { color: Colors.muted, fontSize: 16, paddingHorizontal: 4 },
  chipScroll: { flexGrow: 0, marginTop: Spacing.sm },
  chipRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.primaryText },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 2,
  },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', marginTop: Spacing.xl },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
});
