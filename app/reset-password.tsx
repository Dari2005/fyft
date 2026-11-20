import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useDialog } from '@/lib/DialogContext';
import TextField from '@/components/TextField';
import PrimaryButton from '@/components/PrimaryButton';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';

/** Reads `key=value` pairs after "#" (Supabase puts tokens there) or "?". */
function linkParams(url: string): URLSearchParams {
  const hash = url.split('#')[1];
  const query = url.split('?')[1]?.split('#')[0];
  return new URLSearchParams(hash ?? query ?? '');
}

/**
 * Opened by the "Forgot password" email (fyft://reset-password#access_token=…
 * &refresh_token=…&type=recovery). Turns the link into a session, then lets
 * the user choose a new password.
 */
export default function ResetPasswordScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { notify } = useDialog();
  const url = Linking.useURL();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = url ? linkParams(url) : new URLSearchParams();
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      let ok = false;
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        ok = !sessionError;
      } else if (!params.get('error')) {
        // Already turned into a session (e.g. the screen re-rendered).
        const { data } = await supabase.auth.getSession();
        ok = !!data.session;
      }
      if (!cancelled) setState(ok ? 'ready' : 'invalid');
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const save = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== repeat) {
      setError('The two passwords are not the same.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(
        /different from the old/i.test(updateError.message)
          ? 'Pick a password different from your old one.'
          : "Couldn't save the new password. Try again."
      );
      return;
    }
    router.replace('/');
    notify('Password changed', 'You are signed in with your new password.', 'check');
  };

  if (state === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (state === 'invalid') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>This link has expired</Text>
        <Text style={styles.body}>
          Reset links work once and only for a short time. Ask for a new one from the sign-in
          screen.
        </Text>
        <PrimaryButton title="Go to sign in" onPress={() => router.replace('/auth')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Choose a new password</Text>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label="Repeat it"
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={save}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton title="Save password" onPress={save} loading={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.lg, gap: Spacing.sm },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
      backgroundColor: Colors.background,
    },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
    body: { color: Colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    error: { color: Colors.danger, fontSize: 14 },
  });
