import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { unregisterPush } from './notifications';
import { MEDIA_BUCKET } from './media';

export type AuthResult = { error: AuthError | null };
/** 'unavailable' = the browser preview, where the app link cannot come back. */
export type GoogleResult = 'ok' | 'cancelled' | 'error' | 'unavailable';

/** Route the Google sign-in returns to: app/auth-callback.tsx. */
export const GOOGLE_CALLBACK_PATH = 'auth-callback';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, username: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<GoogleResult>;
  signOut: () => Promise<void>;
  /** Emails a reset link that opens app/reset-password. */
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  /** Deletes the account and everything it owns (migration_delete_account.sql). */
  deleteAccount: () => Promise<'ok' | 'error'>;
}

/** Route the password-reset email link opens: app/reset-password.tsx. */
export const RESET_PASSWORD_PATH = 'reset-password';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() || undefined } },
      });
      return { error };
    },
    []
  );

  /**
   * "Continue with Google": Supabase OAuth in the system browser tab, coming
   * back through the app's own link (fyft://auth-callback). Needs, once, in
   * the Supabase dashboard: Google enabled under Auth → Providers, and
   * `fyft://**` under Auth → URL Configuration → Redirect URLs.
   */
  const signInWithGoogle = useCallback(async (): Promise<GoogleResult> => {
    if (Platform.OS === 'web') return 'unavailable';
    try {
      const redirectTo = Linking.createURL(GOOGLE_CALLBACK_PATH);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) return 'error';

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== 'success') return 'cancelled';

      // Tokens come back after "#" (or after "?" on some setups).
      const tail = res.url.split('#')[1] ?? res.url.split('?')[1] ?? '';
      const params = new URLSearchParams(tail);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return 'error';

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      return sessionError ? 'error' : 'ok';
    } catch {
      return 'error';
    }
  }, []);

  const signOut = useCallback(async () => {
    // Must run while still signed in (RLS only lets you delete your own token).
    await unregisterPush();
    await supabase.auth.signOut();
  }, []);

  /**
   * "Forgot password": Supabase emails a link that comes back to
   * fyft://reset-password with a recovery session (allowed by `fyft://**`
   * in Auth → URL Configuration → Redirect URLs).
   */
  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL(RESET_PASSWORD_PATH),
    });
    return { error };
  }, []);

  const deleteAccount = useCallback(async (): Promise<'ok' | 'error'> => {
    const uid = session?.user.id;
    if (!uid) return 'error';
    try {
      // 1) Photos/videos in the user's Storage folder (best effort: a file
      //    left behind must not block deleting the account).
      const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(uid, { limit: 1000 });
      if (files && files.length > 0) {
        await supabase.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${uid}/${f.name}`));
      }
      // 2) The account and everything it owns (cascade in the database).
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return 'error';
      // 3) Forget the session on this device (the server session is gone).
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      return 'ok';
    } catch {
      return 'error';
    }
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      deleteAccount,
    }),
    [session, loading, signIn, signUp, signInWithGoogle, signOut, sendPasswordReset, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
