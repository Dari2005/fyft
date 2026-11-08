import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import { formatDistance } from '@/lib/geo';
import { isLiveNow } from '@/lib/tonight';
import { crowdColor, crowdFor } from '@/lib/crowd';
import Icon from '@/components/Icon';
import type { Party, PartyStats } from '@/lib/types';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "SAT 14 NOV · 23:00" (24-hour clock, as used in Skopje). */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
}

interface PartyCardProps {
  party: Party;
  stats?: PartyStats;
  /** Distance from the user in km, when location is known. */
  distanceKm?: number | null;
}

/**
 * Event card ("B", 2026-11-08): big photo on the left (a calendar icon when
 * it has no photo). Videos are NOT shown on the card — only on the event
 * detail (Dari, 2026-11-08). On the right the date + title + place and the CROWD METER ("48 / 80 · Busy") —
 * the main reason Fyft exists: don't go somewhere empty.
 */
export default function PartyCard({ party, stats, distanceKm }: PartyCardProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const live = isLiveNow(party.starts_at);
  const going = stats?.goingCount ?? 0;
  const crowd = crowdFor(going, party.capacity);
  const tint = crowdColor(crowd.level, Colors);
  const cover = party.media.find((m) => m.type === 'image');
  const place =
    [party.address, distanceKm != null ? formatDistance(distanceKm) : null]
      .filter(Boolean)
      .join(' · ') || party.party_type || '';

  return (
    <Link href={{ pathname: '/party/[id]', params: { id: party.id } }} asChild>
      {/* Plain style object on purpose: <Link asChild> drops function-style
          props (({ pressed }) => …), which left the card with no style. */}
      <Pressable style={styles.card} android_ripple={{ color: 'rgba(139,108,240,0.12)' }}>
        <View style={styles.media}>
          {cover ? (
            <Image source={{ uri: cover.url }} style={styles.mediaImage} resizeMode="cover" />
          ) : (
            <Icon name="calendar" size={28} color={Colors.primaryBright} />
          )}
          {live && (
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.when}>{formatWhen(party.starts_at)}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {party.title}
          </Text>
          {place !== '' && (
            <View style={styles.placeRow}>
              {party.address || distanceKm != null ? (
                <Icon name="pin" size={13} color={Colors.muted} />
              ) : null}
              <Text style={styles.place} numberOfLines={1}>
                {place}
              </Text>
            </View>
          )}

          {/* Crowd meter */}
          <View style={styles.meter}>
            <View style={styles.meterRow}>
              <Text style={styles.count}>
                {going}
                <Text style={styles.countOf}>
                  {party.capacity != null ? ` / ${party.capacity}` : ' going'}
                </Text>
              </Text>
              <Text style={[styles.level, { color: tint }]} numberOfLines={1}>
                {crowd.label}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${crowd.fill * 100}%`, backgroundColor: tint }]} />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const MEDIA_WIDTH = 116;

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.sm,
      overflow: 'hidden',
      minHeight: 132,
    },
    media: {
      width: MEDIA_WIDTH,
      backgroundColor: Colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    live: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: Colors.glass,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
    liveText: { color: Colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    info: { flex: 1, padding: Spacing.sm, gap: 4 },
    when: { color: Colors.primaryBright, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    title: { color: Colors.text, fontSize: 17, fontWeight: '700' },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    place: { flexShrink: 1, color: Colors.muted, fontSize: 12 },
    meter: {
      gap: 6,
      marginTop: 'auto',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: Colors.divider,
    },
    meterRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 6,
    },
    count: { color: Colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
    countOf: { color: Colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0 },
    level: { flexShrink: 1, fontSize: 12, fontWeight: '800' },
    track: { height: 5, borderRadius: 3, backgroundColor: Colors.surfaceHigh, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
  });
