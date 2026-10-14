import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import TextField from '@/components/TextField';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import type { VenueType } from '@/lib/types';

/** Create-party form. Inserts into public.parties; requires a signed-in user. */
export default function CreatePartyScreen() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueType, setVenueType] = useState<VenueType>('house');
  const [startsAt, setStartsAt] = useState(''); // "2026-10-25 21:00"
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parseDate = (value: string): Date | null => {
    // Accept "YYYY-MM-DD HH:mm" (local time) — MVP simplicity over a date picker.
    const normalized = value.trim().replace(' ', 'T');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  };

  const submit = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    setError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setError('Насловот мора да има најмалку 3 карактери.');
      return;
    }
    const date = parseDate(startsAt);
    if (!date) {
      setError('Внеси датум во формат ГГГГ-ММ-ДД ЧЧ:ММ (на пр. 2026-10-25 21:00).');
      return;
    }

    const lat = latitude.trim() === '' ? null : Number(latitude.trim());
    const lng = longitude.trim() === '' ? null : Number(longitude.trim());
    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      setError('Географската ширина/должина мора да се броеви (или остави ги празни).');
      return;
    }
    const cap = capacity.trim() === '' ? null : parseInt(capacity.trim(), 10);
    if (cap !== null && (isNaN(cap) || cap <= 0)) {
      setError('Капацитетот мора да е позитивен број (или остави го празен).');
      return;
    }

    setSaving(true);
    try {
      // TODO(anti-spam): the hard enforcement of the 3-parties-per-day limit lives
      // in the `party_creation_limit` trigger in supabase/schema.sql. This app-side
      // count is only a UX nicety so the user gets feedback before hitting the DB.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('parties')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', user.id)
        .gte('created_at', todayStart.toISOString());
      if ((count ?? 0) >= 3) {
        setError('Денес веќе објави 3 журки — лимитот е 3 дневно. Пробај утре.');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('parties')
        .insert({
          organizer_id: user.id,
          title: trimmedTitle,
          description: description.trim() === '' ? null : description.trim(),
          venue_type: venueType,
          address: address.trim() === '' ? null : address.trim(),
          latitude: lat,
          longitude: lng,
          starts_at: date.toISOString(),
          capacity: cap,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      router.replace({ pathname: '/party/[id]', params: { id: data.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Грешка при објавување.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!user && (
          <Text style={styles.notice}>Мораш да си наjавен за да објавиш журка.</Text>
        )}

        <TextField label="Наслов *" value={title} onChangeText={setTitle} placeholder="на пр. Куќна журка кај Кисела Вода" maxLength={120} />
        <TextField
          label="Опис"
          value={description}
          onChangeText={setDescription}
          placeholder="Донеси си пијачка, почнуваме во 21:00…"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Тип на место *</Text>
        <View style={styles.venueRow}>
          {(
            [
              { value: 'house', label: '🏠 Куќна' },
              { value: 'club', label: '🎶 Клуб' },
            ] as { value: VenueType; label: string }[]
          ).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.venueOption, venueType === opt.value && styles.venueSelected]}
              onPress={() => setVenueType(opt.value)}
            >
              <Text
                style={[styles.venueText, venueType === opt.value && styles.venueTextSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextField
          label="Почеток (ГГГГ-ММ-ДД ЧЧ:ММ) *"
          value={startsAt}
          onChangeText={setStartsAt}
          placeholder="2026-10-25 21:00"
          autoCorrect={false}
        />
        <TextField label="Адреса" value={address} onChangeText={setAddress} placeholder="ул. Пример 12, Скопје" />

        <View style={styles.coordsRow}>
          <View style={styles.coordsHalf}>
            <TextField label="Ширина (lat)" value={latitude} onChangeText={setLatitude} placeholder="42.0029" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.coordsHalf}>
            <TextField label="Должина (lng)" value={longitude} onChangeText={setLongitude} placeholder="21.4254" keyboardType="numbers-and-punctuation" />
          </View>
        </View>

        <TextField label="Капацитет (опционално)" value={capacity} onChangeText={setCapacity} placeholder="50" keyboardType="number-pad" />

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton title="Објави журка" onPress={submit} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  notice: { color: Colors.primary, fontSize: 14, marginBottom: Spacing.md },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  venueRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  venueOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  venueSelected: { borderColor: Colors.primary, borderWidth: 2 },
  venueText: { color: Colors.muted, fontSize: 15, fontWeight: '600' },
  venueTextSelected: { color: Colors.text },
  coordsRow: { flexDirection: 'row', gap: Spacing.sm },
  coordsHalf: { flex: 1 },
  error: { color: Colors.danger, fontSize: 14, marginBottom: Spacing.sm },
});
