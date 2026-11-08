import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import Avatar from '@/components/Avatar';
import FollowButton from '@/components/FollowButton';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import type { ProfileLite } from '@/lib/types';

/** Find people / organizers by username, and manage who you follow. */
export default function PeopleScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const { following } = useSocial();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);

  const q = query.trim().replace(/[%_,()]/g, '');

  // Debounced username search.
  useEffect(() => {
    if (q.length < 2) return; // results are ignored below 2 characters
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(30);
      setResults(((data ?? []) as ProfileLite[]).filter((p) => p.id !== user?.id));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, user?.id]);

  const showingSearch = q.length >= 2;
  const rows = showingSearch ? results : following;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username…"
          placeholderTextColor={Colors.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      <Text style={styles.sectionTitle}>
        {showingSearch ? 'Results' : `Following (${following.length})`}
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Link href={{ pathname: '/user/[id]', params: { id: item.id } }} asChild>
              <Pressable style={styles.person}>
                <Avatar profile={item} size={44} />
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username ?? 'user'}
                </Text>
              </Pressable>
            </Link>
            <FollowButton profile={item} compact />
          </View>
        )}
        ListEmptyComponent={
          searching ? null : (
            <Text style={styles.empty}>
              {showingSearch
                ? 'Nobody found with that username.'
                : 'You are not following anyone yet. Search for friends, clubs and organizers above — their plans will show up in the app.'}
            </Text>
          )
        }
      />
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  username: { color: Colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  empty: { color: Colors.muted, fontSize: 14, textAlign: 'center', marginTop: Spacing.lg },
});
