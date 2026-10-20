import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';
import { genreLabel } from '@/lib/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('mk-MK', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PartyCard({ party }: { party: Party }) {
  return (
    <Link href={{ pathname: '/party/[id]', params: { id: party.id } }} asChild>
      <Pressable style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.venue}>{party.venue_type === 'house' ? '🏠' : '🎶'}</Text>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {party.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatDate(party.starts_at)}
              {party.address ? ` · ${party.address}` : ''}
            </Text>
            <Text style={styles.organizer} numberOfLines={1}>
              {party.organizer_username ? `@${party.organizer_username}` : ''}
              {genreLabel(party.genre) ? ` · ${genreLabel(party.genre)}` : ''}
              {party.capacity != null ? ` · до ${party.capacity} гости` : ''}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  venue: { fontSize: 30, marginRight: Spacing.md },
  info: { flex: 1 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 14, marginTop: 2 },
  organizer: { color: Colors.muted, fontSize: 13, marginTop: 2 },
});
