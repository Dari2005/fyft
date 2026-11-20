import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useIsFocused, useLocalSearchParams, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useDialog } from '@/lib/DialogContext';
import { openPrivacyPolicy } from '@/lib/legal';
import Logo from '@/components/Logo';
import TextField from '@/components/TextField';
import PrimaryButton from '@/components/PrimaryButton';
import { Spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/ThemeContext';

/** Set after the first successful sign-in on this device: from then on the
 * screen opens on "Sign in" instead of "Create account". */
const HAS_ACCOUNT_KEY = 'fyft.hasAccount';

/** Leave the screen: back to where the person was (an event, the map…). */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Create account / sign in (Dari, 2026-11-15): "Continue with Google" first,
 * email + password below. Shown automatically on the very first open
 * (`?welcome=1`, see FirstOpenGate in app/_layout.tsx) with a "Look around
 * first" way out. No emoji, no example placeholders.
 */
export default function AuthScreen() {
  const styles = useThemedStyles(makeStyles);
  const { user, signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();
  const [resetting, setResetting] = useState(false);

  /** Emails a reset link to the address typed above (does not say whether
   * the address has an account, so nobody can probe emails with it). */
  const forgotPassword = async () => {
    setError(null);
    setNotice(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Type your email above first, then tap "Forgot password?".');
      return;
    }
    setResetting(true);
    const { error: resetError } = await sendPasswordReset(trimmed);
    setResetting(false);
    if (resetError && /rate|seconds/i.test(resetError.message)) {
      setError('Too many tries. Wait a minute and try again.');
      return;
    }
    setNotice(`If ${trimmed} has a Fyft account, we sent it a link to set a new password.`);
  };
  const { notify } = useDialog();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const isWelcome = welcome === '1';

  // New here → "Create account"; signed in on this phone before → "Sign in".
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isWelcome) return;
    AsyncStorage.getItem(HAS_ACCOUNT_KEY)
      .then((v) => {
        if (v === '1') setMode('signin');
      })
      .catch(() => {});
  }, [isWelcome]);

  useEffect(() => {
    navigation.setOptions({ title: mode === 'signup' ? 'Create account' : 'Sign in' });
  }, [mode, navigation]);

  // Signed in (by either way) → remember it and leave. Waiting for focus
  // keeps this from racing the Google callback screen that sits on top.
  useEffect(() => {
    if (!user || !isFocused) return;
    AsyncStorage.setItem(HAS_ACCOUNT_KEY, '1').catch(() => {});
    close();
  }, [user, isFocused]);

  const submit = async () => {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      // Tell people their chosen name is taken, instead of the database
      // quietly renaming them to "name2" (it does that only as a fallback).
      if (mode === 'signup' && (await usernameTaken(username.trim()))) {
        setError('That username is taken. Try another one.');
        return;
      }

      const { error: authError } =
        mode === 'signin'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password, username.trim());

      if (authError) {
        setError(prettifyAuthError(authError.message));
        return;
      }
      if (mode === 'signup') {
        // With email confirmation on in Supabase there is no session yet;
        // without it the effect above closes the screen right away.
        setNotice('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
      }
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result === 'unavailable') {
        notify('Google sign-in is in the phone app', 'It does not work in the browser preview.');
      } else if (result === 'error') {
        setError("Couldn't sign in with Google. Try again, or use your email.");
      }
      // 'ok' → the effect above closes the screen; 'cancelled' → stay here.
    } finally {
      setGoogleLoading(false);
    }
  };

  const signup = mode === 'signup';
  const busy = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Logo height={30} />
        <Text style={styles.heading}>{signup ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.lead}>
          {signup
            ? 'See how many people are going before you head out.'
            : 'Sign in to pick up where you left off.'}
        </Text>

        <TouchableOpacity
          style={[styles.google, busy && styles.disabled]}
          onPress={google}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {googleLoading ? (
            <ActivityIndicator color={styles.googleText.color} />
          ) : (
            <>
              <GoogleMark />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or with email</Text>
          <View style={styles.orLine} />
        </View>

        {signup && (
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={submit}
        />

        {!signup && (
          <TouchableOpacity
            style={styles.forgot}
            onPress={forgotPassword}
            hitSlop={10}
            accessibilityRole="button"
            disabled={resetting}
          >
            <Text style={styles.forgotText}>{resetting ? 'Sending…' : 'Forgot password?'}</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <PrimaryButton
          title={signup ? 'Create account' : 'Sign in'}
          onPress={submit}
          loading={loading}
          disabled={googleLoading}
        />

        {signup && (
          <Text style={styles.legal}>
            By creating an account you agree to the{' '}
            <Text style={styles.legalLink} onPress={openPrivacyPolicy} accessibilityRole="link">
              Privacy policy
            </Text>
            .
          </Text>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.muted}>
            {signup ? 'Already have an account?' : "Don't have an account?"}
          </Text>
          <TouchableOpacity
            hitSlop={12}
            accessibilityRole="button"
            onPress={() => {
              setMode(signup ? 'signin' : 'signup');
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={styles.switchLink}>{signup ? ' Sign in' : ' Create one'}</Text>
          </TouchableOpacity>
        </View>

        {isWelcome && (
          <TouchableOpacity
            style={styles.skip}
            onPress={close}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Look around first</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Google's "G", in its own four colors as its sign-in button rules ask. */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** Case-insensitive check against existing profiles (they are public). On a
 * network error it says "free" and lets the sign-up trigger sort it out. */
async function usernameTaken(name: string): Promise<boolean> {
  // ILIKE without wildcards = case-insensitive equality; escape _ and %.
  const pattern = name.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', pattern)
    .limit(1);
  return !error && (data?.length ?? 0) > 0;
}

function prettifyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('already registered') || lower.includes('already exists'))
    return 'This email already has an account. Sign in instead.';
  if (lower.includes('email not confirmed')) return 'Confirm your email before signing in.';
  return message;
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.lg, paddingTop: Spacing.xl },
    heading: {
      color: Colors.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginTop: Spacing.lg,
    },
    lead: {
      color: Colors.muted,
      fontSize: 15,
      lineHeight: 21,
      marginTop: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    // Neutral on purpose: Google's rules ask for a plain button, and magenta
    // stays for the one main action below.
    google: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    googleText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginVertical: Spacing.lg,
    },
    orLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
    orText: { color: Colors.muted, fontSize: 13 },
    error: { color: Colors.danger, fontSize: 14, marginBottom: Spacing.sm },
    notice: { color: Colors.success, fontSize: 14, marginBottom: Spacing.sm },
    forgot: { alignSelf: 'flex-end', marginTop: -Spacing.xs, marginBottom: Spacing.sm },
    forgotText: { color: Colors.primaryBright, fontSize: 14, fontWeight: '600' },
    legal: {
      color: Colors.muted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: Spacing.sm,
      lineHeight: 17,
    },
    legalLink: { color: Colors.textSoft, textDecorationLine: 'underline' },
    switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
    muted: { color: Colors.muted, fontSize: 14 },
    switchLink: { color: Colors.primaryBright, fontSize: 14, fontWeight: '700' },
    skip: { alignSelf: 'center', marginTop: Spacing.xl, paddingVertical: Spacing.xs },
    skipText: { color: Colors.textSoft, fontSize: 15, fontWeight: '600' },
  });
