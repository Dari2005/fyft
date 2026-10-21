import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import TextField from '@/components/TextField';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

/** Sign-in / sign-up screen using Supabase email+password auth. */
export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const { error: authError } =
        mode === 'signin'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password, username.trim());

      if (authError) {
        setError(prettifyAuthError(authError.message));
        return;
      }

      if (mode === 'signup') {
        // If email confirmation is enabled in Supabase, there is no session yet.
        setNotice('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
      } else {
        router.replace('/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{mode === 'signin' ? 'Welcome back 🎉' : 'Create account'}</Text>

        {mode === 'signup' && (
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. dari_2026"
            autoCapitalize="none"
          />
        )}
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="ti@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          onSubmitEditing={submit}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <PrimaryButton
          title={mode === 'signin' ? 'Sign In' : 'Sign Up'}
          onPress={submit}
          loading={loading}
        />

        <View style={styles.switchRow}>
          <Text style={styles.muted}>
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={styles.switchLink}>
              {mode === 'signin' ? ' Sign Up' : ' Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function prettifyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('already registered') || lower.includes('already exists'))
    return 'This email is already registered — sign in instead.';
  if (lower.includes('email not confirmed')) return 'Confirm your email before signing in.';
  return message;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  heading: { color: Colors.text, fontSize: 24, fontWeight: '800', marginBottom: Spacing.lg },
  error: { color: Colors.danger, fontSize: 14, marginBottom: Spacing.sm },
  notice: { color: Colors.success, fontSize: 14, marginBottom: Spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  muted: { color: Colors.muted, fontSize: 14 },
  switchLink: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
