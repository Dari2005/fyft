import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import { useParties } from '@/hooks/useParties';
import { usePartyStats } from '@/hooks/usePartyStats';
import { nightWindows } from '@/lib/tonight';
import PartyCard from '@/components/PartyCard';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

type Filter = 'all' | 'friends' | 'following';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'friends', label: '👥 Friends going' },
  { key: 'following', label: '⭐ From people I follow' },
];

interface Section {
  key: string;
  title: string;
  data: Party[];
}

/**
 * Tonight tab: only what's on today (until 05:00) and tomorrow — no search,
 * no scrolling through weeks of events. Live events are included until four
 * hours after they start.
 */
export default function TonightScreen() {
  const { user } = useAuth();
  const { parties, loading, error, refresh } = useParties();
  const { stats, refresh: refreshStats } = usePartyStats();
  const { friendsGoing, followingIds, refresh: refreshSocial } = useSocial();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => new Date());

  const reload = useCallback(async () => {
    setNow(new Date());
    await Promise.all([refresh(), refreshStats(), refreshSocial()]);
  }, [refresh, refreshStats, refreshSocial]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const windows = useMemo(() => nightWindows(now), [now]);

  const sections = useMemo<Section[]>(() => {
    const keep = (p: Party): boolean => {
      if (filter === 'friends') return (friendsGoing[p.id]?.length ?? 0) > 0;
      if (filter === 'following') return followingIds.has(p.organizer_id);
      return true;
    };
    const byStart = (a: Party, b: Party) => a.starts_at.localeCompare(b.starts_at);

    const tonight: Party[] = [];
    const tomorrow: Party[] = [];
    for (const p of parties) {
      const t = new Date(p.starts_at).getTime();
      if (t < windows.from.getTime() || !keep(p)) continue;
      if (t < windows.tonightEnd.getTime()) tonight.push(p);
      else if (t < windows.tomorrowEnd.getTime()) tomorrow.push(p);
    }
    return [
      { key: 'tonight', title: windows.tonightLabel, data: tonight.sort(byStart) },
      { key: 'tomorrow', title: 'Tomorrow', data: tomorrow.sort(byStart) },
    ].filter((s) => s.data.length > 0);
  }, [parties, windows, filter, friendsGoing, followingIds]);

  const needsLogin = !user && filter !== 'all';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.brand}>Fyft</Text>
        <Text style={styles.heading}>{windows.tonightLabel} in Skopje</Text>
        <Text style={styles.subheading}>
          {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>
            {section.title}
            <Text style={styles.sectionCount}>{`  ·  ${section.data.length}`}</Text>
          </Text>
        )}
        renderItem={({ item }) => (
          <PartyCard party={item} stats={stats[item.id]} friendsGoing={friendsGoing[item.id]} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌙</Text>
              <Text style={styles.emptyTitle}>
                {error
                  ? "Couldn't load the events"
                  : needsLogin
                    ? 'Sign in to see this'
                    : filter === 'friends'
                      ? 'None of your friends are going anywhere yet'
                      : filter === 'following'
                        ? 'Nobody you follow has anything on'
                        : 'Nothing planned yet'}
              </Text>
              <Text style={styles.emptyText}>
                {needsLogin
                  ? 'Follow people to see where they are going.'
                  : filter === 'friends'
                    ? 'Follow friends from your profile — their plans show up here.'
                    : filter === 'following'
                      ? 'Follow organizers and clubs to see their events here.'
                      : 'Be the first to publish something for tonight or tomorrow!'}
              </Text>
              {!user && (
                <Link href="/auth" style={styles.emptyLink}>
                  Sign in
                </Link>
              )}
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
  subheading: { color: Colors.muted, fontSize: 14, marginTop: 2 },
  chipScroll: { flexGrow: 0, marginTop: Spacing.sm },
  chipRow: { paddingHorizontal: Spacing.md, gap: Spacing.xs, alignItems: 'center' },
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
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionCount: { color: Colors.muted, fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  emptyEmoji: { fontSize: 44, marginBottom: Spacing.sm },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
  emptyLink: { color: Colors.primaryBright, fontSize: 15, fontWeight: '700', marginTop: Spacing.md },
});
