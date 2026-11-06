import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Two kinds of notifications live here:
 *
 *  1. LOCAL reminders ("Techno night starts in 1 hour") — scheduled on the
 *     device for every event the user marked Going / Interested. They need no
 *     server and work offline. `syncReminders` rebuilds them from the
 *     database, so they stay correct if an organizer moves the start time.
 *
 *  2. REMOTE pushes ("@club posted a new event", "New event near you") —
 *     sent by the `notify_new_party` database trigger to the Expo push token
 *     saved by `registerForPush`. Needs a development build + push
 *     credentials (see README → Notifications).
 */

const REMINDER_PREFIX = 'reminder-';
const REMINDER_LEAD_MS = 60 * 60 * 1000; // 1 hour before start
const MAX_SCHEDULED = 50; // iOS keeps at most 64 pending local notifications
const TOKEN_KEY = 'fyft.pushToken';
const REMINDERS_KEY = 'fyft.remindersEnabled';
const ANDROID_CHANNEL = 'default';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Show notifications even while the app is open. Call once at startup. */
export function configureNotifications() {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Events',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#9333ea',
  });
}

/** Ask for notification permission (no-op when already decided). */
export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Get this device's Expo push token and save it for the signed-in user.
 * Returns the token, or null when permission was denied / the device or build
 * cannot receive pushes (simulator, Expo Go on Android, missing projectId).
 */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!supported) return null;
  try {
    if (!(await ensurePermission())) return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn(
        '[notifications] No EAS projectId — run `eas init` so push tokens can be issued.'
      );
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    // Upsert on the token itself: if another account used this device before,
    // the row simply moves to the current user.
    const { error } = await supabase.from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );
    if (error) throw error;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn('[notifications] push registration failed', e);
    return null;
  }
}

/** Stop pushes to this device (sign-out): delete its token and any reminders. */
export async function unregisterPush(): Promise<void> {
  if (!supported) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      await supabase.from('push_tokens').delete().eq('token', token);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Best effort — a stale token only means a push to a signed-out device.
  }
  await cancelAllReminders();
}

// ---------------------------------------------------------------------------
// Local reminders
// ---------------------------------------------------------------------------

export async function getRemindersEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(REMINDERS_KEY)) !== 'off';
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, enabled ? 'on' : 'off');
}

async function cancelAllReminders() {
  if (!supported) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

interface RsvpWithParty {
  party_id: string;
  parties: { title: string; starts_at: string } | { title: string; starts_at: string }[] | null;
}

/**
 * Rebuild the local reminders from the user's RSVPs: one notification an hour
 * before each upcoming event they marked Going or Interested. Safe to call as
 * often as you like (app start, after an RSVP, after sign-in) — it cancels the
 * old reminders first, so nothing is ever duplicated or left stale.
 */
export async function syncReminders(userId: string | null): Promise<void> {
  if (!supported) return;
  try {
    await cancelAllReminders();
    if (!userId || !(await getRemindersEnabled())) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return; // never prompt from a background sync

    const { data, error } = await supabase
      .from('rsvps')
      .select('party_id, parties!inner(title, starts_at)')
      .eq('user_id', userId)
      .gte('parties.starts_at', new Date().toISOString());
    if (error) throw error;

    const now = Date.now();
    const upcoming = ((data ?? []) as unknown as RsvpWithParty[])
      .map((row) => {
        const party = Array.isArray(row.parties) ? row.parties[0] : row.parties;
        return party ? { id: row.party_id, title: party.title, start: new Date(party.starts_at) } : null;
      })
      .filter((p): p is { id: string; title: string; start: Date } => p !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, MAX_SCHEDULED);

    await ensureAndroidChannel();
    for (const p of upcoming) {
      // Normally 1h before; if the event is closer than that, remind in a minute.
      const at = Math.max(p.start.getTime() - REMINDER_LEAD_MS, now + 60 * 1000);
      if (at >= p.start.getTime()) continue; // already started
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_PREFIX}${p.id}`,
        content: {
          title: `${p.title} starts soon`,
          body: `Starts at ${p.start.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })} — see you there!`,
          data: { partyId: p.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(at),
          channelId: ANDROID_CHANNEL,
        },
      });
    }
  } catch (e) {
    console.warn('[notifications] reminder sync failed', e);
  }
}

/**
 * Called after the user adds/removes an RSVP. On the first "Going/Interested"
 * this is the natural moment to ask for notification permission (they just
 * said they care about an event); then the reminders are rebuilt.
 */
export async function onRsvpChanged(userId: string, added: boolean): Promise<void> {
  if (!supported) return;
  if (added && (await getRemindersEnabled())) {
    if (await ensurePermission()) await registerForPush(userId);
  }
  await syncReminders(userId);
}

/**
 * On app start / sign-in: if the OS permission is already granted, make sure
 * this device's push token is saved for the current user (tokens can rotate
 * and a shared device may have switched accounts). Never prompts.
 */
export async function refreshPushIfGranted(userId: string): Promise<void> {
  if (!supported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) await registerForPush(userId);
}
