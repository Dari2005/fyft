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
      setError('Внеси валидна е-пошта.');
      return;
    }
    if (password.length < 6) {
      setError('Лозинката мора да има најмалку 6 карактери.');
      return;
    }
    if (mode === 'signup' && username.trim().length < 3) {
      setError('Корисничкото име мора да има најмалку 3 карактери.');
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
        setNotice('Профилот е креиран! Провери ја е-поштата за потврда, па најави се.');
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
        <Text style={styles.heading}>{mode === 'signin' ? 'Добредојде назад 🎉' : 'Креирај профил'}</Text>

        {mode === 'signup' && (
          <TextField
            label="Корисничко име"
            value={username}
            onChangeText={setUsername}
            placeholder="на пр. dari_2026"
            autoCapitalize="none"
          />
        )}
        <TextField
          label="Е-пошта"
          value={email}
          onChangeText={setEmail}
          placeholder="ti@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Лозинка"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          onSubmitEditing={submit}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <PrimaryButton
          title={mode === 'signin' ? 'Најави се' : 'Регистрирај се'}
          onPress={submit}
          loading={loading}
        />

        <View style={styles.switchRow}>
          <Text style={styles.muted}>
            {mode === 'signin' ? 'Немаш профил?' : 'Веќе имаш профил?'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={styles.switchLink}>
              {mode === 'signin' ? ' Регистрирај се' : ' Најави се'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function prettifyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Погрешна е-пошта или лозинка.';
  if (lower.includes('already registered') || lower.includes('already exists'))
    return 'Оваа е-пошта е веќе регистрирана — најави се.';
  if (lower.includes('email not confirmed')) return 'Потврди ја е-поштата пред најава.';
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
