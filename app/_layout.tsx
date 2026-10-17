import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/AuthContext';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
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
        <Stack.Screen name="index" options={{ title: 'Журки во Скопје' }} />
        <Stack.Screen name="map" options={{ title: 'Мапа' }} />
        <Stack.Screen name="auth" options={{ title: 'Најава', presentation: 'modal' }} />
        <Stack.Screen name="create" options={{ title: 'Нова журка' }} />
        <Stack.Screen name="party/[id]" options={{ title: 'Журка' }} />
      </Stack>
    </AuthProvider>
  );
}
