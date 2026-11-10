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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import MapView, { Marker, type Region } from 'react-native-maps';
import { mapStyleFor } from '@/lib/mapStyle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { MAX_MEDIA_ITEMS, uploadPartyMedia } from '@/lib/media';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
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
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
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

    // Capacity is required (Dari, 2026-11-08): it drives the crowd meter
    // ("Quiet so far" → "Busy" → "Full"). It does not block RSVPs.
    const cap = parseInt(capacity.trim(), 10);
    if (isNaN(cap) || cap <= 0) {
      setError('Enter how many people can come (a number above 0).');
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

  /** All media in display order: saved (edit mode) first, then newly picked. */
  const allMedia: { key: string; uri: string; isVideo: boolean; remove: () => void }[] = [
    ...existingMedia.map((m, i) => ({
      key: `saved-${m.url}-${i}`,
      uri: m.url,
      isVideo: m.type === 'video',
      remove: () => removeExistingMedia(i),
    })),
    ...mediaAssets.map((a, i) => ({
      key: `new-${a.uri}-${i}`,
      uri: a.uri,
      isVideo: a.type === 'video',
      remove: () => removeMedia(i),
    })),
  ];
  const cover = allMedia[0];
  const canAddMedia = allMedia.length < MAX_MEDIA_ITEMS;

  /** Capacity stepper: +/- in steps of 5, the field stays typeable. */
  const stepCapacity = (delta: number) => {
    const current = parseInt(capacity, 10);
    const base = isNaN(current) ? 0 : current;
    setCapacity(String(Math.max(1, base + delta)));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!user && (
          <Text style={styles.notice}>You must be signed in to publish an event.</Text>
        )}

        {/* Cover: the first photo is what people see on the event card. */}
        {cover ? (
          <View style={styles.cover}>
            <Image source={{ uri: cover.uri }} style={styles.coverImage} />
            {cover.isVideo && (
              <View style={styles.videoBadge}>
                <Icon name="video" size={14} color="#ffffff" />
              </View>
            )}
            <View style={styles.coverTag}>
              <Text style={styles.coverTagText}>Cover</Text>
            </View>
            <TouchableOpacity style={styles.mediaRemove} onPress={cover.remove} hitSlop={8}>
              <Icon name="close" size={12} color="#ffffff" strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.coverEmpty} onPress={pickMedia} activeOpacity={0.8}>
            <Icon name="image" size={28} color={Colors.primaryBright} />
            <Text style={styles.coverEmptyTitle}>Add cover photo</Text>
            <Text style={styles.coverEmptyHint}>Up to {MAX_MEDIA_ITEMS} photos or videos</Text>
          </TouchableOpacity>
        )}
        {cover && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaStrip}>
            {allMedia.slice(1).map((m) => (
              <View key={m.key} style={styles.thumbWrap}>
                <Image source={{ uri: m.uri }} style={styles.thumb} />
                {m.isVideo && (
                  <View style={styles.videoBadge}>
                    <Icon name="video" size={12} color="#ffffff" />
                  </View>
                )}
                <TouchableOpacity style={styles.mediaRemove} onPress={m.remove} hitSlop={8}>
                  <Icon name="close" size={12} color="#ffffff" strokeWidth={2.6} />
                </TouchableOpacity>
              </View>
            ))}
            {canAddMedia && (
              <TouchableOpacity style={styles.thumbAdd} onPress={pickMedia}>
                <Icon name="plus" size={22} color={Colors.primaryBright} />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Basics */}
        <View style={styles.section}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Event name"
            placeholderTextColor={Colors.muted}
            maxLength={120}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.plainInput}
            value={partyType}
            onChangeText={setPartyType}
            placeholder="Event type (optional)"
            placeholderTextColor={Colors.muted}
            maxLength={30}
          />
        </View>

        {/* When */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>When</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={[styles.field, styles.dateField]} onPress={() => setPickerMode('date')}>
              <Icon name="calendar" size={16} color={Colors.primaryBright} />
              <Text style={styles.fieldText}>
                {startsAt.toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.field} onPress={() => setPickerMode('time')}>
              <Icon name="clock" size={16} color={Colors.primaryBright} />
              <Text style={styles.fieldText}>
                {startsAt.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
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
        </View>

        {/* Where */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Where</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.fieldInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Search address"
              placeholderTextColor={Colors.muted}
              returnKeyType="search"
              onSubmitEditing={searchAddress}
            />
            <TouchableOpacity onPress={searchAddress} disabled={searching} hitSlop={8}>
              {searching ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Icon name="search" size={18} color={Colors.primaryBright} />
              )}
            </TouchableOpacity>
          </View>
          <MapView
            // Remount on theme change so the new map style always applies.
            key={Colors.scheme}
            ref={mapRef}
            style={styles.miniMap}
            customMapStyle={mapStyleFor(Colors.scheme)}
            initialRegion={SKOPJE_REGION}
            onPress={(e) => setPin(e.nativeEvent.coordinate)}
          >
            {pin && <Marker coordinate={pin} pinColor={Colors.primary} />}
          </MapView>
          <View style={styles.pinRow}>
            <Icon name="pin" size={14} color={pin ? Colors.primaryBright : Colors.muted} />
            <Text style={styles.pinText}>
              {pin ? 'Pin on the map' : 'Search the address or tap the map to drop a pin.'}
            </Text>
            {pin && (
              <TouchableOpacity onPress={() => setPin(null)} hitSlop={8}>
                <Text style={styles.clearPinText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Capacity: required, drives the crowd meter. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How many people can come?</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepButton} onPress={() => stepCapacity(-5)} accessibilityLabel="Fewer people">
              <Icon name="minus" size={18} color={Colors.primaryBright} strokeWidth={2.4} />
            </TouchableOpacity>
            <TextInput
              style={styles.stepValue}
              value={capacity}
              onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
              placeholder="—"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity style={styles.stepButton} onPress={() => stepCapacity(5)} accessibilityLabel="More people">
              <Icon name="plus" size={18} color={Colors.primaryBright} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Shows how full the event is (Quiet so far → Busy → Full). It does not block sign-ups.
          </Text>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <TextInput
            style={[styles.plainInput, styles.description]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people what to expect…"
            placeholderTextColor={Colors.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton
          title={editId ? 'Save changes' : 'Publish event'}
          onPress={submit}
          loading={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  notice: { color: Colors.primaryBright, fontSize: 14 },

  cover: { position: 'relative' },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
  },
  coverTag: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: Colors.glass,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  coverTagText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  coverEmpty: {
    aspectRatio: 16 / 9,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverEmptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  coverEmptyHint: { color: Colors.muted, fontSize: 12 },
  mediaStrip: { flexGrow: 0, paddingTop: 6 },
  thumbWrap: { marginRight: Spacing.sm, position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: Colors.surfaceHigh },
  thumbAdd: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  videoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    padding: 3,
  },
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

  section: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.md,
  },
  sectionLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  titleInput: { color: Colors.text, fontSize: 20, fontWeight: '700', paddingVertical: 4 },
  plainInput: { color: Colors.text, fontSize: 15, paddingVertical: 4 },
  description: { minHeight: 90 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    minHeight: 46,
  },
  fieldText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  fieldInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10 },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateField: { flex: 1 },
  pickerDone: { alignSelf: 'flex-end', paddingVertical: 4 },
  pickerDoneText: { color: Colors.primaryBright, fontSize: 15, fontWeight: '700' },

  miniMap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  pinText: { flex: 1, color: Colors.muted, fontSize: 13 },
  clearPinText: { color: Colors.danger, fontSize: 13, fontWeight: '700' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepButton: {
    ...outline(Colors),
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 12,
    height: 46,
    paddingVertical: 0,
  },
  hint: { color: Colors.muted, fontSize: 12, marginTop: Spacing.sm },
  error: { color: Colors.danger, fontSize: 14 },
});
