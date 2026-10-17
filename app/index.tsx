import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { useParties } from '@/hooks/useParties';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

/** Home screen: list of published parties. */
export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { parties, loading, error, refresh } = useParties();

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <View style={styles.mapButton}>
          <Link href="/map" asChild>
            <PrimaryButton title="🗺️" onPress={() => {}} />
          </Link>
        </View>
        {user ? (
          <>
            <View style={styles.grow}>
              <Link href="/create" asChild>
                <PrimaryButton title="＋ Нова журка" onPress={() => {}} />
              </Link>
            </View>
            <View style={styles.signOut}>
              <PrimaryButton title="Одјави се" variant="outline" onPress={signOut} />
            </View>
          </>
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
  mapButton: { width: 56 },
  signOut: { width: 110 },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', marginTop: Spacing.xl },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
});
