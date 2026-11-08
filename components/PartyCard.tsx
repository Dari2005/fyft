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
 * Event card ("3A", 2026-11-08): purple date line + LIVE, title with two
 * lines of description and a small cover photo, place, and the CROWD METER
 * ("48 / 80 going · Busy") — the main reason Fyft exists: don't go somewhere
 * empty. No organizer and no names on the card.
 */
export default function PartyCard({ party, stats, distanceKm }: PartyCardProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const live = isLiveNow(party.starts_at);
  const going = stats?.goingCount ?? 0;
  const crowd = crowdFor(going, party.capacity);
  const tint = crowdColor(crowd.level, Colors);
  const cover = party.media.find((m) => m.type === 'image');
  const place = [party.address, distanceKm != null ? formatDistance(distanceKm) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={{ pathname: '/party/[id]', params: { id: party.id } }} asChild>
      {/* Plain style object on purpose: <Link asChild> drops function-style
          props (({ pressed }) => …), which left the card with no style. */}
      <Pressable style={styles.card} android_ripple={{ color: 'rgba(139,108,240,0.12)' }}>
        <View style={styles.topRow}>
          <Text style={styles.when}>{formatWhen(party.starts_at)}</Text>
          {live && (
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.bodyText}>
            <Text style={styles.title} numberOfLines={2}>
              {party.title}
            </Text>
            {party.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {party.description}
              </Text>
            ) : null}
          </View>
          {cover && <Image source={{ uri: cover.url }} style={styles.cover} />}
        </View>

        {(place !== '' || party.party_type) && (
          <View style={styles.placeRow}>
            {place !== '' && (
              <>
                <Icon name="pin" size={14} color={Colors.muted} />
                <Text style={styles.place} numberOfLines={1}>
                  {place}
                </Text>
              </>
            )}
            {party.party_type ? (
              <View style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {party.party_type}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Crowd meter */}
        <View style={styles.meter}>
          <View style={styles.meterRow}>
            <Text style={styles.count}>
              {going}
              <Text style={styles.countOf}>
                {party.capacity != null ? ` / ${party.capacity} going` : ' going'}
              </Text>
            </Text>
            <Text style={[styles.level, { color: tint }]}>{crowd.label}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${crowd.fill * 100}%`, backgroundColor: tint }]} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: 7,
      overflow: 'hidden',
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    when: { color: Colors.primaryBright, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
    liveText: { color: Colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    body: { flexDirection: 'row', gap: Spacing.sm },
    bodyText: { flex: 1, gap: 3 },
    title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
    description: { color: Colors.textSoft, fontSize: 13, lineHeight: 18 },
    cover: { width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.surfaceHigh },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    place: { flexShrink: 1, color: Colors.muted, fontSize: 13 },
    tag: {
      marginLeft: 'auto',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 2,
      maxWidth: 140,
    },
    tagText: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
    meter: {
      gap: 7,
      marginTop: 3,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: Colors.divider,
    },
    meterRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    count: { color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    countOf: { color: Colors.muted, fontSize: 13, fontWeight: '600', letterSpacing: 0 },
    level: { fontSize: 13, fontWeight: '800' },
    track: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceHigh, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
  });
