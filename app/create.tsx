import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, type Region } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import TextField from '@/components/TextField';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import type { VenueType } from '@/lib/types';

/** Default map region: Skopje center. */
const SKOPJE_REGION: Region = {
  latitude: 41.9981,
  longitude: 21.4254,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/** Create-party form. Inserts into public.parties; requires a signed-in user. */
export default function CreatePartyScreen() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueType, setVenueType] = useState<VenueType>('house');
  const [startsAt, setStartsAt] = useState(''); // "2026-10-25 21:00"
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Geocode the typed address (Photon, no key) and drop the pin on the result. */
  const searchAddress = async () => {
    const query = address.trim();
    if (query.length < 3) {
      Alert.alert('Внеси адреса', 'Напиши ја улицата / адресата прво.');
      return;
    }
    setSearching(true);
    try {
      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
        `&limit=1&lat=41.9981&lon=21.4254`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('geocode failed');
      const json = await res.json();
      const coords = json?.features?.[0]?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        Alert.alert(
          'Не е пронајдено',
          'Не ја најдов адресата. Пробај со друго име или стави пин рачно на мапата.'
        );
        return;
      }
      const [lng, lat] = coords;
      setPin({ latitude: lat, longitude: lng });
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    } catch {
      Alert.alert('Грешка', 'Пребарувањето не успеа. Провери ја интернет-врската.');
    } finally {
      setSearching(false);
    }
  };

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
          latitude: pin?.latitude ?? null,
          longitude: pin?.longitude ?? null,
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
        <TouchableOpacity onPress={searchAddress} style={styles.searchButton} disabled={searching}>
          {searching ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.searchButtonText}>🔍 Најди ја адресата на мапа</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Локација на мапа (опционално)</Text>
        <MapView
          ref={mapRef}
          style={styles.miniMap}
          initialRegion={SKOPJE_REGION}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
        >
          {pin && <Marker coordinate={pin} pinColor={Colors.primary} />}
        </MapView>
        <Text style={styles.pinText}>
          {pin
            ? `📍 ${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`
            : 'Допрете ја мапата за да поставите пин.'}
        </Text>
        {pin && (
          <TouchableOpacity onPress={() => setPin(null)} style={styles.clearPin}>
            <Text style={styles.clearPinText}>✕ Отстрани пин</Text>
          </TouchableOpacity>
        )}

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
  miniMap: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  pinText: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.xs },
  clearPin: { alignSelf: 'flex-start', marginBottom: Spacing.md, paddingVertical: 4 },
  clearPinText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  searchButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  searchButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 14, marginBottom: Spacing.sm },
});
