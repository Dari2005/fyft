import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import MapView, { Marker, type Region } from 'react-native-maps';
import { DARK_MAP_STYLE } from '@/lib/mapStyle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { MAX_MEDIA_ITEMS, uploadPartyMedia } from '@/lib/media';
import TextField from '@/components/TextField';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import { parsePartyMedia, type PartyMedia } from '@/lib/types';

/** Default map region: Skopje center. */
const SKOPJE_REGION: Region = {
  latitude: 41.9981,
  longitude: 21.4254,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/**
 * Create-party form. Inserts into public.parties; requires a signed-in user.
 * With ?edit=<partyId> it becomes the edit form for that party (organizer
 * only): fields are prefilled and saving UPDATEs the row instead.
 */
export default function CreatePartyScreen() {
  const { user } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editId = typeof edit === 'string' && edit ? edit : null;
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [partyType, setPartyType] = useState('');
  const [startsAt, setStartsAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(21, 0, 0, 0);
    return d;
  });
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [capacity, setCapacity] = useState('');
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  /** Media already saved on the party (edit mode), kept unless removed. */
  const [existingMedia, setExistingMedia] = useState<PartyMedia[]>([]);
  const [loadingParty, setLoadingParty] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editId ? 'Edit Event' : 'New Event' });
  }, [editId, navigation]);

  /** Edit mode: load the party and prefill every field. */
  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data, error: qErr } = await supabase
        .from('parties')
        .select('*')
        .eq('id', editId)
        .single();
      if (qErr || !data) {
        setError('Could not load this event.');
        setLoadingParty(false);
        return;
      }
      if (data.organizer_id !== user.id) {
        setError('You can only edit your own events.');
        setLoadingParty(false);
        return;
      }
      setTitle(data.title);
      setDescription(data.description ?? '');
      setPartyType(data.party_type ?? '');
      setStartsAt(new Date(data.starts_at));
      setAddress(data.address ?? '');
      if (data.latitude != null && data.longitude != null) {
        setPin({ latitude: data.latitude, longitude: data.longitude });
      }
      setCapacity(data.capacity != null ? String(data.capacity) : '');
      setExistingMedia(parsePartyMedia(data.media));
      setLoadingParty(false);
    })();
  }, [editId, user]);

  /** Pick photos/videos from the library (max MAX_MEDIA_ITEMS per party). */
  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access so you can add pictures and videos to your event.'
      );
      return;
    }
    const remaining = MAX_MEDIA_ITEMS - existingMedia.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      setMediaAssets((prev) => [...prev, ...result.assets].slice(0, remaining));
    }
  };

  const removeMedia = (index: number) => {
    setMediaAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index));
  };

  /** Geocode the typed address (Photon, no key) and drop the pin on the result. */
  const searchAddress = async () => {
    const query = address.trim();
    if (query.length < 3) {
      Alert.alert('Enter an address', 'Type the street / address first.');
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
          'Not found',
"I couldn't find that address. Try a different name or drop the pin on the map manually."
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
      Alert.alert('Error', 'Search failed. Check your internet connection.');
    } finally {
      setSearching(false);
    }
  };

  /** Date/time picker flow: on Android, date dialog chains into time dialog. */
  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selected) {
        if (pickerMode === 'date') {
          const next = new Date(startsAt);
          next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          setStartsAt(next);
          setPickerMode('time');
        } else {
          const next = new Date(startsAt);
          next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          setStartsAt(next);
          setPickerMode(null);
        }
      } else {
        setPickerMode(null);
      }
    } else if (selected) {
      setStartsAt(selected);
    }
  };

  const submit = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    setError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    const date = startsAt;

    const cap = capacity.trim() === '' ? null : parseInt(capacity.trim(), 10);
    if (cap !== null && (isNaN(cap) || cap <= 0)) {
      setError('Capacity must be a positive number (or leave it empty).');
      return;
    }

    setSaving(true);
    try {
      // Edit mode: upload only the newly picked media, keep the rest, UPDATE.
      if (editId) {
        let uploaded: PartyMedia[] = [];
        if (mediaAssets.length > 0) {
          uploaded = await uploadPartyMedia(user.id, mediaAssets);
        }
        const { error: updErr } = await supabase
          .from('parties')
          .update({
            title: trimmedTitle,
            description: description.trim() === '' ? null : description.trim(),
            party_type: partyType.trim() === '' ? null : partyType.trim(),
            address: address.trim() === '' ? null : address.trim(),
            latitude: pin?.latitude ?? null,
            longitude: pin?.longitude ?? null,
            starts_at: date.toISOString(),
            capacity: cap,
            media: [...existingMedia, ...uploaded],
          })
          .eq('id', editId);
        if (updErr) throw updErr;
        router.replace({ pathname: '/party/[id]', params: { id: editId } });
        return;
      }

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
        setError("You've already published 3 events today — the limit is 3 per day. Try again tomorrow.");
        return;
      }

      // Upload photos/videos first (if any), then insert the party with them.
      let media: PartyMedia[] = [];
      if (mediaAssets.length > 0) {
        media = await uploadPartyMedia(user.id, mediaAssets);
      }

      const payload: Record<string, unknown> = {
        organizer_id: user.id,
        title: trimmedTitle,
        description: description.trim() === '' ? null : description.trim(),
        party_type: partyType.trim() === '' ? null : partyType.trim(),
        address: address.trim() === '' ? null : address.trim(),
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null,
        starts_at: date.toISOString(),
        capacity: cap,
        media,
      };

      let insertResult = await supabase
        .from('parties')
        .insert(payload)
        .select('id')
        .single();
      // If a column is missing (migration not run yet), drop it and retry so
      // publishing never breaks. Same for venue_type: the column is being
      // retired — if the DB still requires it, satisfy it with a default.
      if (insertResult.error) {
        let dropped = false;
        for (const col of ['media', 'party_type']) {
          if (insertResult.error.message.includes(col)) {
            delete payload[col];
            dropped = true;
          }
        }
        if (insertResult.error.message.includes('venue_type')) {
          payload.venue_type = 'house';
          dropped = true;
        }
        if (dropped) {
          insertResult = await supabase
            .from('parties')
            .insert(payload)
            .select('id')
            .single();
        }
      }
      const { data, error: insertError } = insertResult;

      if (insertError) throw insertError;
      router.replace({ pathname: '/party/[id]', params: { id: data.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish.');
    } finally {
      setSaving(false);
    }
  };

  if (editId && loadingParty) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!user && (
          <Text style={styles.notice}>You must be signed in to publish an event.</Text>
        )}

        <TextField label="Title *" value={title} onChangeText={setTitle} placeholder="e.g. Concert at Gradski Park" maxLength={120} />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Tell people what to expect…"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Photos & Videos</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mediaStrip}
        >
          {existingMedia.map((m, i) => (
            <View key={`saved-${m.url}-${i}`} style={styles.mediaThumbWrap}>
              <Image source={{ uri: m.url }} style={styles.mediaThumb} />
              {m.type === 'video' && <Text style={styles.videoBadge}>🎥</Text>}
              <TouchableOpacity
                style={styles.mediaRemove}
                onPress={() => removeExistingMedia(i)}
              >
                <Text style={styles.mediaRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {mediaAssets.map((asset, i) => (
            <View key={`${asset.uri}-${i}`} style={styles.mediaThumbWrap}>
              <Image source={{ uri: asset.uri }} style={styles.mediaThumb} />
              {asset.type === 'video' && <Text style={styles.videoBadge}>🎥</Text>}
              <TouchableOpacity
                style={styles.mediaRemove}
                onPress={() => removeMedia(i)}
              >
                <Text style={styles.mediaRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {existingMedia.length + mediaAssets.length < MAX_MEDIA_ITEMS && (
            <TouchableOpacity style={styles.mediaAdd} onPress={pickMedia}>
              <Text style={styles.mediaAddText}>＋</Text>
              <Text style={styles.mediaAddLabel}>Add</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <TextField
          label="Event type"
          value={partyType}
          onChangeText={setPartyType}
          placeholder="e.g. Birthday, Rave, BBQ, Techno night…"
          maxLength={30}
        />

        <Text style={styles.label}>Starts at *</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setPickerMode('date')}>
            <Text style={styles.dateButtonText}>
              📅{' '}
              {startsAt.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateButton} onPress={() => setPickerMode('time')}>
            <Text style={styles.dateButtonText}>
              🕐{' '}
              {startsAt.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>
        </View>
        {pickerMode && (
          <DateTimePicker
            value={startsAt}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={editId ? undefined : new Date()}
            onChange={onPickerChange}
          />
        )}
        {Platform.OS === 'ios' && pickerMode && (
          <TouchableOpacity onPress={() => setPickerMode(null)} style={styles.pickerDone}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        )}

        <TextField label="Address" value={address} onChangeText={setAddress} placeholder="e.g. Example St. 12, Skopje" />
        <TouchableOpacity onPress={searchAddress} style={styles.searchButton} disabled={searching}>
          {searching ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.searchButtonText}>🔍 Find the address on the map</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Location on map (optional)</Text>
        <MapView
          ref={mapRef}
          style={styles.miniMap}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={SKOPJE_REGION}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
        >
          {pin && <Marker coordinate={pin} pinColor={Colors.primary} />}
        </MapView>
        <Text style={styles.pinText}>
          {pin
            ? `📍 ${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`
            : 'Tap the map to drop a pin.'}
        </Text>
        {pin && (
          <TouchableOpacity onPress={() => setPin(null)} style={styles.clearPin}>
            <Text style={styles.clearPinText}>✕ Remove pin</Text>
          </TouchableOpacity>
        )}

        <TextField label="Capacity (optional)" value={capacity} onChangeText={setCapacity} placeholder="50" keyboardType="number-pad" />

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton
          title={editId ? 'Save Changes' : 'Publish Event'}
          onPress={submit}
          loading={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  content: { padding: Spacing.lg },
  notice: { color: Colors.primary, fontSize: 14, marginBottom: Spacing.md },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  mediaStrip: { marginBottom: Spacing.md },
  mediaThumbWrap: { marginRight: Spacing.sm, position: 'relative' },
  mediaThumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: Colors.surface },
  videoBadge: { position: 'absolute', left: 6, bottom: 6, fontSize: 14 },
  mediaRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRemoveText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  mediaAdd: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  mediaAddText: { color: Colors.primaryBright, fontSize: 24, fontWeight: '700' },
  mediaAddLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
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
  dateRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  dateButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
  },
  dateButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  pickerDone: { alignSelf: 'flex-end', marginBottom: Spacing.md, paddingVertical: 4 },
  pickerDoneText: { color: Colors.primaryBright, fontSize: 15, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 14, marginBottom: Spacing.sm },
});
