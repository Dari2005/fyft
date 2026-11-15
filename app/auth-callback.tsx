import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/lib/ThemeContext';

/**
 * Landing route for the Google sign-in link (fyft://auth-callback). The
 * sign-in itself is finished by `signInWithGoogle` in lib/AuthContext; this
 * screen exists only so the incoming link does not open "page not found" —
 * it steps straight back to the sign-in screen, which closes once signed in.
 */
export default function AuthCallbackScreen() {
  const Colors = useColors();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return (
    <View style={[styles.center, { backgroundColor: Colors.background }]}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
