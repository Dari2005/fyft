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
import Icon from '@/components/Icon';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import type { ProfileLite } from '@/lib/types';

/**
 * Organizers: search people who have published events, and manage which
 * organizers you follow (their new events -> "Following" filter + push).
 * Only accounts with at least one event show up — there are no friends.
 */
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
        // Inner join: only profiles that organize at least one event.
        .select('id, username, avatar_url, parties!parties_organizer_id_fkey!inner(id)')
        .ilike('username', `%${q}%`)
        .limit(30);
      setResults(
        (data ?? [])
          .map((p) => ({ id: p.id, username: p.username, avatar_url: p.avatar_url }) as ProfileLite)
          .filter((p) => p.id !== user?.id)
      );
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, user?.id]);

  const showingSearch = q.length >= 2;
  const rows = showingSearch ? results : following;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Icon name="search" size={17} color={Colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search organizers…"
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
                ? 'No organizer found with that name.'
                : 'You are not following any organizers yet. Follow clubs and organizers to see their new events under the Following filter.'}
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
    borderRadius: 14,
    margin: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
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
