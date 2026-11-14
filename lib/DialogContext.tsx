import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';

/**
 * App-styled dialogs for the whole app (Dari, 2026-11-10: the native Android
 * Alert "looks ugly"). One provider at the root draws the dialog; screens
 * call `useDialog()` instead of `Alert.alert`:
 *
 *   notify(title, message)                 – one "OK" button
 *   ask({ title, message, confirmLabel, onConfirm }) – Cancel + one action
 *   choose({ title, options, onChoose })   – pick one row, then confirm
 *
 * `ConfirmDialog` stays for the destructive Delete (red, with a spinner).
 */
interface Base {
  title: string;
  message?: string;
  icon?: IconName;
}
interface AskSpec extends Base {
  confirmLabel: string;
  onConfirm: () => void;
}
interface ChooseSpec extends Base {
  options: { key: string; label: string }[];
  confirmLabel: string;
  onChoose: (key: string) => void;
}
type Spec =
  | ({ kind: 'notify' } & Base)
  | ({ kind: 'ask' } & AskSpec)
  | ({ kind: 'choose' } & ChooseSpec);

interface DialogApi {
  notify: (title: string, message?: string, icon?: IconName) => void;
  ask: (spec: AskSpec) => void;
  choose: (spec: ChooseSpec) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used inside <DialogProvider>');
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useColors();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const open = useCallback((next: Spec) => {
    setPicked(null);
    setSpec(next);
  }, []);
  const close = useCallback(() => setSpec(null), []);

  const api = useMemo<DialogApi>(
    () => ({
      notify: (title, message, icon) => open({ kind: 'notify', title, message, icon }),
      ask: (s) => open({ kind: 'ask', ...s }),
      choose: (s) => open({ kind: 'choose', ...s }),
    }),
    [open]
  );

  const confirm = () => {
    if (!spec) return;
    // Close first so an action that opens another dialog is not overwritten.
    close();
    if (spec.kind === 'ask') spec.onConfirm();
    if (spec.kind === 'choose' && picked != null) spec.onChoose(picked);
  };
  const needsPick = spec?.kind === 'choose' && picked == null;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={spec != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Inner Pressable swallows taps so they don't close the dialog. */}
          <Pressable style={styles.box} onPress={() => {}} accessibilityViewIsModal>
            {spec?.icon && (
              <View style={styles.iconRing}>
                <Icon name={spec.icon} size={20} color={Colors.primaryBright} />
              </View>
            )}
            <Text style={styles.title} accessibilityRole="header">
              {spec?.title}
            </Text>
            {!!spec?.message && <Text style={styles.message}>{spec.message}</Text>}

            {spec?.kind === 'choose' && (
              <View style={styles.options}>
                {spec.options.map((o) => {
                  const on = picked === o.key;
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.option, on && styles.optionOn]}
                      onPress={() => setPicked(o.key)}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={styles.optionText}>{o.label}</Text>
                      {on && <Icon name="check" size={16} color={Colors.primaryBright} strokeWidth={2.4} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.row}>
              {spec?.kind !== 'notify' && (
                <TouchableOpacity
                  style={[styles.button, styles.cancel]}
                  onPress={close}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.confirm, needsPick && styles.disabled]}
                onPress={confirm}
                disabled={needsPick}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: needsPick }}
              >
                <Text style={styles.confirmText}>
                  {spec?.kind === 'notify' || !spec ? 'OK' : spec.confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
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
      borderColor: Colors.primary,
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
    options: { alignSelf: 'stretch', gap: Spacing.xs, marginTop: Spacing.md },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
      minHeight: 46,
      paddingHorizontal: Spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surfaceHigh,
    },
    optionOn: { borderColor: Colors.primary },
    optionText: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
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
    cancelText: { color: Colors.textSoft, fontSize: 15, fontWeight: '700' },
    // Magenta is never a fill: the main action is the outline button.
    confirm: { ...outline(Colors) },
    confirmText: { color: Colors.primaryText, fontSize: 15, fontWeight: '800' },
    disabled: { opacity: 0.45 },
  });
