import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { useParties } from '@/hooks/useParties';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

/** Party list tab (left tab). Reached from the bottom tab bar. */
export default function PartyListScreen() {
  const { user } = useAuth();
  const { parties, loading, error, refresh } = useParties();

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        {user ? (
          <Link href="/create" asChild style={styles.grow}>
            <PrimaryButton title="＋ Нова журка" onPress={() => {}} />
          </Link>
        ) : (
          <Link href="/auth" asChild style={styles.grow}>
            <PrimaryButton title="Најави се за да објавиш журка" onPress={() => {}} />
          </Link>
        )}
      </View>

      <FlatList
        data={parties}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PartyCard party={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {error ? 'Не можев да ги вчитам журките' : 'Нема објавени журки уште'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Провери дали си го извршил supabase/schema.sql и поставил .env'
                  : 'Биди првиот што ќе објави!'}
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  grow: { flex: 1 },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', marginTop: Spacing.xl },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
});
