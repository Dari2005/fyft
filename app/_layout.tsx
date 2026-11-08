import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SocialProvider } from '@/lib/SocialContext';
import {
  configureNotifications,
  refreshPushIfGranted,
  syncReminders,
} from '@/lib/notifications';
import { ThemeProvider, useColors } from '@/lib/ThemeContext';

configureNotifications();

/**
 * Keeps notifications in step with the app:
 *  - rebuilds the local "starts in 1 hour" reminders on sign-in and whenever
 *    the app returns to the foreground (so a changed start time is picked up),
 *  - refreshes the push token when permission was already granted,
 *  - opens the right event when a notification is tapped.
 */
function NotificationsBridge() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    syncReminders(userId);
    refreshPushIfGranted(userId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders(userId);
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const requestId = response.notification.request.identifier;
      if (handled.current.has(requestId)) return;
      handled.current.add(requestId);
      const partyId = response.notification.request.content.data?.partyId;
      if (typeof partyId === 'string') {
        router.push({ pathname: '/party/[id]', params: { id: partyId } });
      }
    };
    // App was launched by tapping a notification…
    open(Notifications.getLastNotificationResponse());
    // …or the tap happens while it is running / in the background.
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return null;
}

/** Stack + status bar styled from the active theme (needs ThemeProvider above). */
function ThemedStack() {
  const Colors = useColors();
  return (
    <>
      <StatusBar style={Colors.scheme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In', presentation: 'modal' }} />
        <Stack.Screen name="create" options={{ title: 'New Event' }} />
        <Stack.Screen name="party/[id]" options={{ title: 'Event', headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Event Chat' }} />
        <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="people" options={{ title: 'Organizers' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocialProvider>
          <NotificationsBridge />
          <ThemedStack />
        </SocialProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
