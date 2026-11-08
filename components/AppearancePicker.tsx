import { StyleSheet, Text, View } from 'react-native';
import { FilterChip } from '@/components/EventFilterBar';
import { Spacing, type Palette } from '@/constants/theme';
import { useTheme, useThemedStyles, type ThemePreference } from '@/lib/ThemeContext';

const OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/** Profile → Appearance: Auto (follows the phone) / Light / Dark. Saved on the device. */
export default function AppearancePicker() {
  const { preference, setPreference } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Appearance</Text>
      <View style={styles.row}>
        {OPTIONS.map((o) => (
          <FilterChip
            key={o.key}
            label={o.label}
            active={preference === o.key}
            onPress={() => setPreference(o.key)}
          />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
    label: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
    row: { flexDirection: 'row', gap: Spacing.xs },
  });
