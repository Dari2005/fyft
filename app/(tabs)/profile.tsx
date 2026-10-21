import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { useParties } from '@/hooks/useParties';
import { supabase } from '@/lib/supabase';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

/** Profile tab (right tab): user info, my published parties, sign out. */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { parties } = useParties();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      setUsername(data?.username ?? null);
    })();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>👤</Text>
        <Text style={styles.title}>You are not signed in</Text>
        <Text style={styles.subtitle}>
          Sign in to publish parties and see your profile.
        </Text>
        <Link href="/auth" asChild>
          <PrimaryButton title="Sign In" onPress={() => {}} />
        </Link>
      </View>
    );
  }

  const myParties = parties.filter((p) => p.organizer_id === user.id);
  const displayName = username ?? user.email?.split('@')[0] ?? 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.signOut}>
          <PrimaryButton title="Sign Out" variant="outline" onPress={signOut} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Parties ({myParties.length})</Text>
      <FlatList
        data={myParties}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PartyCard party={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            You haven't published any parties yet. Tap ＋ on the map for your first one!
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  bigEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: {
    color: Colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { color: Colors.primaryText, fontSize: 36, fontWeight: '800' },
  name: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  email: { color: Colors.muted, fontSize: 14 },
  signOut: { width: 140, marginTop: Spacing.md },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xl },
  empty: {
    color: Colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
