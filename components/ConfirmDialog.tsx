import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';

/**
 * Centered confirm dialog in the app's own style — used instead of the
 * native Android Alert, which looks like system UI (Dari, 2026-11-10).
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  icon,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  icon?: IconName;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const accent = destructive ? Colors.danger : Colors.primary;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        {/* Inner Pressable swallows taps so they don't close the dialog. */}
        <Pressable style={styles.box} onPress={() => {}}>
          {icon && (
            <View style={[styles.iconRing, { borderColor: accent }]}>
              <Icon name={icon} size={20} color={accent} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.button, styles.cancel]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: accent }]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    box: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 20,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    iconRing: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    title: { color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    message: {
      color: Colors.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 6,
    },
    row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, alignSelf: 'stretch' },
    button: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    cancel: { borderWidth: 1, borderColor: Colors.border },
    cancelText: { color: Colors.text, fontSize: 15, fontWeight: '700' },
    confirmText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  });
