import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const cover = party.media.find((m) => m.type === 'image');
  return (
    <Link href={{ pathname: '/party/[id]', params: { id: party.id } }} asChild>
      <Pressable style={styles.card}>
        {party.party_type && (
          <View style={styles.typeTag}>
            <Text style={styles.typeTagText}>{party.party_type}</Text>
          </View>
        )}
        <View style={styles.row}>
          {cover ? (
            <View style={styles.thumbWrap}>
              <Image source={{ uri: cover.url }} style={styles.thumbImg} />
              {party.media.length > 1 && (
                <View style={styles.mediaCount}>
                  <Text style={styles.mediaCountText}>{party.media.length}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.thumb}>
              <Text style={styles.venue}>🎉</Text>
            </View>
          )}
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
    position: 'relative',
  },
  typeTag: {
    position: 'absolute',
    top: -9,
    right: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  typeTagText: {
    color: Colors.primaryText,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  thumbWrap: { position: 'relative', marginRight: Spacing.md },
  thumbImg: { width: 58, height: 58, borderRadius: 14, backgroundColor: Colors.border },
  mediaCount: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  mediaCountText: { color: Colors.primaryText, fontSize: 11, fontWeight: '800' },
  venue: { fontSize: 28 },
  info: { flex: 1 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  meta: { color: Colors.muted, fontSize: 14, marginTop: 3 },
  organizer: { color: Colors.muted, fontSize: 13, marginTop: 2 },
});
