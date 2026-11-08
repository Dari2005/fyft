import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import { formatDistance } from '@/lib/geo';
import { isLiveNow } from '@/lib/tonight';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import type { Party, PartyStats, ProfileLite } from '@/lib/types';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "SAT 14 NOV · 23:00" (24-hour clock, as used in Skopje). */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
}

/** "Ana, Marko +22" — friends first, then everyone else going. */
function goingLabel(friends: ProfileLite[], goingCount: number): string {
  const names = friends.slice(0, 2).map((f) => f.username ?? 'user');
  const rest = Math.max(goingCount, friends.length) - names.length;
  return `${names.join(', ')}${rest > 0 ? ` +${rest}` : ''}`;
}

interface PartyCardProps {
  party: Party;
  stats?: PartyStats;
  /** Distance from the user in km, when location is known. */
  distanceKm?: number | null;
  /** People the viewer follows who are going — shown as avatars. */
  friendsGoing?: ProfileLite[];
}

/**
 * Event card ("design A", 2026-11-08): purple date line on top with a LIVE
 * badge, title, place, then a footer with friends' avatars / going count
 * and the free-text event type.
 */
export default function PartyCard({ party, stats, distanceKm, friendsGoing }: PartyCardProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const live = isLiveNow(party.starts_at);
  const friends = friendsGoing ?? [];
  const goingCount = stats?.goingCount ?? 0;
  const place = [party.address, distanceKm != null ? formatDistance(distanceKm) : null]
    .filter(Boolean)
    .join(' · ');
  const showFooter = friends.length > 0 || goingCount > 0 || !!party.party_type;

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

        <Text style={styles.title} numberOfLines={2}>
          {party.title}
        </Text>

        {place !== '' && (
          <View style={styles.placeRow}>
            <Icon name="pin" size={14} color={Colors.muted} />
            <Text style={styles.place} numberOfLines={1}>
              {place}
            </Text>
          </View>
        )}

        {showFooter && (
          <View style={styles.footer}>
            <View style={styles.going}>
              {friends.length > 0 ? (
                <>
                  <View style={styles.avatars}>
                    {friends.slice(0, 3).map((f, i) => (
                      <View key={f.id} style={[styles.avatarRing, i > 0 && styles.avatarOverlap]}>
                        <Avatar profile={f} size={20} />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.goingText} numberOfLines={1}>
                    {goingLabel(friends, goingCount)}
                  </Text>
                </>
              ) : goingCount > 0 ? (
                <Text style={styles.goingText}>{`${goingCount} going`}</Text>
              ) : null}
            </View>
            {party.party_type ? (
              <View style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {party.party_type}
                </Text>
              </View>
            ) : null}
          </View>
        )}
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
    gap: 6,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  when: { color: Colors.primaryBright, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { color: Colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  place: { flex: 1, color: Colors.muted, fontSize: 13 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  going: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatars: { flexDirection: 'row' },
  avatarRing: { borderWidth: 1.5, borderColor: Colors.surface, borderRadius: 12 },
  avatarOverlap: { marginLeft: -7 },
  goingText: { flexShrink: 1, color: Colors.textSoft, fontSize: 13, fontWeight: '600' },
  tag: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    maxWidth: 130,
  },
  tagText: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
});
