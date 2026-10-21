import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
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
          <View style={styles.thumb}>
            <Text style={styles.venue}>{party.venue_type === 'house' ? '🏠' : '🎶'}</Text>
          </View>
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
              {party.capacity != null ? ` · up to ${party.capacity} guests` : ''}
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
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(147, 51, 234, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  venue: { fontSize: 28 },
  info: { flex: 1 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  meta: { color: Colors.muted, fontSize: 14, marginTop: 3 },
  organizer: { color: Colors.muted, fontSize: 13, marginTop: 2 },
});
