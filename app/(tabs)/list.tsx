import { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/AuthContext';
import { useParties } from '@/hooks/useParties';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

/** Party list tab (left tab): brand header, search bar + party list. */
export default function PartyListScreen() {
  const { user } = useAuth();
  const { parties, loading, error, refresh } = useParties();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q) ?? false)
    );
  }, [parties, query]);

  const isFiltering = query.trim() !== '';

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

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PartyCard party={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {error
                  ? "Couldn't load the parties"
                  : isFiltering
                    ? 'No parties match your search'
                    : 'No parties published yet'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Check that you ran supabase/schema.sql and set up .env'
                  : isFiltering
                    ? 'Try a different search.'
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
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', marginTop: Spacing.xl },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
});
