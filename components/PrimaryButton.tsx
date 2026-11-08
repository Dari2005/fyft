import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';

interface PrimaryButtonProps {
  title: string;
  /** Optional leading emoji/icon, rendered as its OWN Text node: an emoji
   * inside the same Text as the label truncates the label's end on Android. */
  icon?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}

export default function PrimaryButton({
  title,
  icon,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.primaryText} />
      ) : (
        <>
          {icon != null && (
            <Text
              style={[
                styles.label,
                variant === 'outline'
                  ? styles.labelOutline
                  : variant === 'danger'
                    ? styles.labelDanger
                    : styles.labelPrimary,
              ]}
            >
              {icon}
            </Text>
          )}
          <Text
            style={[
              styles.label,
              styles.labelText,
              variant === 'outline'
                ? styles.labelOutline
                : variant === 'danger'
                  ? styles.labelDanger
                  : styles.labelPrimary,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: Spacing.xs,
  },
  primary: { ...outline(Colors) },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  danger: { backgroundColor: Colors.danger },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '800' },
  labelText: { flexShrink: 1 },
  labelPrimary: { color: Colors.primaryText },
  labelOutline: { color: Colors.primaryBright },
    labelDanger: { color: '#ffffff' },
});
