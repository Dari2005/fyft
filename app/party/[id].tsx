import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

/**
 * Party detail screen (placeholder for Phase 1 milestone 3).
 * Currently shows the party info; RSVP + comments UI arrives next.
 */
export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [party, setParty] = useState<Party | null>(null);
  const [goingCount, setGoingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('parties')
          .select('*, profiles!parties_organizer_id_fkey(username)')
          .eq('id', id)
          .single();
        if (qErr) throw qErr;
        setParty({
          id: data.id,
          organizer_id: data.organizer_id,
          title: data.title,
          description: data.description,
          venue_type: data.venue_type,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          starts_at: data.starts_at,
          capacity: data.capacity,
          created_at: data.created_at,
          organizer_username: data.profiles?.username ?? undefined,
        });

        const { count } = await supabase
          .from('rsvps')
          .select('party_id', { count: 'exact', head: true })
          .eq('party_id', id)
          .eq('status', 'going');
        setGoingCount(count ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Грешка при вчитување.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !party) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Журката не е пронајдена.'}</Text>
      </View>
    );
  }

  const capacityLabel =
    party.capacity != null ? `${goingCount} / ${party.capacity} доаѓаат` : `${goingCount} доаѓаат`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.venue}>{party.venue_type === 'house' ? '🏠 Куќна журка' : '🎶 Клубска журка'}</Text>
      <Text style={styles.title}>{party.title}</Text>
      <Text style={styles.meta}>
        {new Date(party.starts_at).toLocaleString('mk-MK', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      {party.address && <Text style={styles.meta}>📍 {party.address}</Text>}
      {party.organizer_username && (
        <Text style={styles.meta}>Организатор: @{party.organizer_username}</Text>
      )}
      {party.description && <Text style={styles.description}>{party.description}</Text>}

      <View style={styles.capacityBox}>
        <Text style={styles.capacityText}>✅ {capacityLabel}</Text>
        {party.capacity != null && goingCount >= party.capacity && (
          <Text style={styles.full}>Полно е!</Text>
        )}
      </View>

      <View style={styles.todo}>
        <Text style={styles.todoText}>
          🚧 RSVP („Доаѓам" копче) и коментари доаѓаат во следниот milestone (M3).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  venue: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800', marginTop: Spacing.xs },
  meta: { color: Colors.muted, fontSize: 15, marginTop: Spacing.xs },
  description: { color: Colors.text, fontSize: 16, marginTop: Spacing.md, lineHeight: 24 },
  capacityBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  capacityText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  full: { color: Colors.danger, fontSize: 16, fontWeight: '800', marginTop: Spacing.xs },
  error: { color: Colors.danger, fontSize: 15 },
  todo: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 12,
  },
  todoText: { color: Colors.muted, fontSize: 14 },
});
