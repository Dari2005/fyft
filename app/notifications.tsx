import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import {
  ensurePermission,
  getRemindersEnabled,
  registerForPush,
  setRemindersEnabled,
  syncReminders,
} from '@/lib/notifications';
import PrimaryButton from '@/components/PrimaryButton';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import type { NotificationPrefs } from '@/lib/types';

const RADIUS_OPTIONS = [2, 5, 10, 20];

const DEFAULT_PREFS: NotificationPrefs = {
  following_enabled: true,
  nearby_enabled: false,
  nearby_lat: null,
  nearby_lng: null,
  nearby_radius_km: 5,
};

/** Notification settings: reminders, followed organizers, events near me. */
export default function NotificationsScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [reminders, setReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return; // the signed-out view is rendered before `loading` matters
    (async () => {
      const [{ data }, remindersOn] = await Promise.all([
        supabase.from('notification_prefs').select('*').eq('user_id', user.id).maybeSingle(),
        getRemindersEnabled(),
      ]);
      if (data) {
        setPrefs({
          following_enabled: data.following_enabled,
          nearby_enabled: data.nearby_enabled,
          nearby_lat: data.nearby_lat,
          nearby_lng: data.nearby_lng,
          nearby_radius_km: data.nearby_radius_km,
        });
      }
      setReminders(remindersOn);
      setLoading(false);
    })();
  }, [user]);

  /** Saves the whole prefs row; returns false (and alerts) on failure. */
  const savePrefs = useCallback(
    async (next: NotificationPrefs): Promise<boolean> => {
      if (!user) return false;
      const { error } = await supabase.from('notification_prefs').upsert(
        { user_id: user.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (error) {
        Alert.alert('Error', 'Could not save your settings. Try again.');
        return false;
      }
      setPrefs(next);
      return true;
    },
    [user]
  );

  const explainPermissionDenied = () =>
    Alert.alert(
      'Notifications are off',
      'Allow notifications for Fyft in your phone settings to turn this on.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]
    );

  /** Registers this device for pushes; explains the failure when it can't. */
  const enablePush = async (): Promise<boolean> => {
    if (!user) return false;
    const granted = await ensurePermission();
    if (!granted) {
      explainPermissionDenied();
      return false;
    }
    const token = await registerForPush(user.id);
    if (!token) {
      Alert.alert(
        'Push is not available here',
        'Push notifications need a real device and a development/production build (not Expo Go on Android).'
      );
      return false;
    }
    return true;
  };

  const toggleReminders = async (value: boolean) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (value && !(await ensurePermission())) {
        explainPermissionDenied();
        return;
      }
      await setRemindersEnabled(value);
      setReminders(value);
      await syncReminders(user.id);
    } finally {
      setBusy(false);
    }
  };

  const toggleFollowing = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (value && !(await enablePush())) return;
      await savePrefs({ ...prefs, following_enabled: value });
    } finally {
      setBusy(false);
    }
  };

  const toggleNearby = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!value) {
        await savePrefs({ ...prefs, nearby_enabled: false });
        return;
      }
      if (!(await enablePush())) return;
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Location needed',
          'Fyft needs your location once to know which events are near you.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await savePrefs({
        ...prefs,
        nearby_enabled: true,
        nearby_lat: pos.coords.latitude,
        nearby_lng: pos.coords.longitude,
      });
    } catch {
      Alert.alert('Location unavailable', 'Could not read your location. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const setRadius = async (km: number) => {
    if (busy || km === prefs.nearby_radius_km) return;
    setBusy(true);
    try {
      await savePrefs({ ...prefs, nearby_radius_km: km });
    } finally {
      setBusy(false);
    }
  };

  /** Re-read the user's position as the "home" used for nearby alerts. */
  const updateLocation = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (
        await savePrefs({
          ...prefs,
          nearby_lat: pos.coords.latitude,
          nearby_lng: pos.coords.longitude,
        })
      ) {
        Alert.alert('Done', 'Your location for nearby alerts was updated.');
      }
    } catch {
      Alert.alert('Location unavailable', 'Could not read your location.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>🔔</Text>
        <Text style={styles.title}>Sign in to manage notifications</Text>
        <Link href="/auth" asChild>
          <PrimaryButton title="Sign In" onPress={() => {}} />
        </Link>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SettingRow
        title="Reminders"
        description="A reminder 1 hour before every event you marked Going or Interested."
        value={reminders}
        onChange={toggleReminders}
        disabled={busy}
      />
      <SettingRow
        title="People I follow"
        description="Get a notification when someone you follow publishes a new event."
        value={prefs.following_enabled}
        onChange={toggleFollowing}
        disabled={busy}
      />
      <SettingRow
        title="New events near me"
        description="Get a notification when a new event is published near your location."
        value={prefs.nearby_enabled}
        onChange={toggleNearby}
        disabled={busy}
      />

      {prefs.nearby_enabled && (
        <View style={styles.radiusBox}>
          <Text style={styles.radiusTitle}>Distance</Text>
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map((km) => (
              <TouchableOpacity
                key={km}
                onPress={() => setRadius(km)}
                style={[styles.chip, prefs.nearby_radius_km === km && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    prefs.nearby_radius_km === km && styles.chipTextActive,
                  ]}
                >
                  {km} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={updateLocation} disabled={busy}>
            <Text style={styles.link}>📍 Update my location</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Your location is only used to match new events and is never shown to other people.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function SettingRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  bigEmoji: { fontSize: 52 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: Spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  rowDescription: { color: Colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  radiusBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  radiusTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  radiusRow: { flexDirection: 'row', gap: Spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.primary },
  chipText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.primaryText },
  link: { color: Colors.primaryBright, fontSize: 14, fontWeight: '700' },
  hint: { color: Colors.muted, fontSize: 12, lineHeight: 17 },
});
