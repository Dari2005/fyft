import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from '@/lib/AuthContext';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  // The tab-bar icons silently render blank if the Ionicons font is not
  // loaded, so load it up front (it is also embedded natively via the
  // expo-font plugin in app.config.js) and wait for it before first paint.
  // On error we render anyway — missing icons beat a stuck blank screen.
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font });
  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
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
        <Stack.Screen name="create" options={{ title: 'New Party' }} />
        <Stack.Screen name="party/[id]" options={{ title: 'Party' }} />
      </Stack>
    </AuthProvider>
  );
}
