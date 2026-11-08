import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type Palette } from '@/constants/theme';

/** What the user picked in Profile → Appearance. "auto" follows the phone. */
export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'fyft.themePreference';

interface ThemeValue {
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: darkColors,
  preference: 'auto',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'auto' || v === 'light' || v === 'dark') setPref(v);
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  // Unknown system scheme → dark (the app's original look).
  const scheme = preference === 'auto' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo<ThemeValue>(
    () => ({ colors: scheme === 'light' ? lightColors : darkColors, preference, setPreference }),
    [scheme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** The active palette. */
export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

/** Styles built from the active palette, rebuilt only when the theme changes. */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
