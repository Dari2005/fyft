import { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';

export interface DropdownOption<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
}

const MENU_WIDTH = 230;

/**
 * Filter "pill" that opens a small menu under itself (Dari, 2026-11-14:
 * filters must fit one row with no sideways scrolling). The pill shows the
 * current choice; it turns magenta when the choice is not the default.
 * Optional `toggle` adds an on/off row under the options (used for
 * "Only organizers I follow" inside the Type menu).
 */
export default function Dropdown<K extends string>({
  label,
  icon,
  active,
  options,
  value,
  onSelect,
  toggle,
  floating,
}: {
  label: string;
  icon?: IconName;
  /** Highlight the pill (a non-default choice is selected). */
  active: boolean;
  options: DropdownOption<K>[];
  value: K;
  onSelect: (key: K) => void;
  toggle?: { label: string; icon: IconName; on: boolean; onToggle: () => void };
  floating?: boolean;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, _w, h) => {
      const maxX = Dimensions.get('window').width - MENU_WIDTH - Spacing.sm;
      setAnchor({ x: Math.max(Spacing.sm, Math.min(x, maxX)), y: y + h + 6 });
    });
  };
  const close = () => setAnchor(null);

  const textColor = active ? Colors.primaryText : floating ? Colors.text : Colors.textSoft;

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity
          onPress={open}
          style={[styles.pill, floating && styles.pillFloating, active && styles.pillActive]}
          activeOpacity={0.8}
        >
          {icon && <Icon name={icon} size={14} color={active ? Colors.primaryBright : textColor} />}
          <Text style={[styles.pillText, { color: textColor }]} numberOfLines={1}>
            {label}
          </Text>
          <Icon name="chevronDown" size={14} color={active ? Colors.primaryBright : Colors.muted} />
        </TouchableOpacity>
      </View>

      <Modal visible={anchor != null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          {anchor && (
            <Pressable style={[styles.menu, { top: anchor.y, left: anchor.x }]} onPress={() => {}}>
              {options.map((o) => {
                const selected = o.key === value;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.item, selected && styles.itemSelected]}
                    onPress={() => {
                      onSelect(o.key);
                      close();
                    }}
                  >
                    {o.icon && (
                      <Icon name={o.icon} size={16} color={selected ? Colors.primaryBright : Colors.muted} />
                    )}
                    <Text style={[styles.itemText, selected && styles.itemTextSelected]}>{o.label}</Text>
                    {selected && <Icon name="check" size={16} color={Colors.primaryBright} />}
                  </TouchableOpacity>
                );
              })}
              {toggle && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity style={styles.item} onPress={toggle.onToggle}>
                    <Icon name={toggle.icon} size={16} color={toggle.on ? Colors.primaryBright : Colors.muted} />
                    <Text style={[styles.itemText, toggle.on && styles.itemTextSelected]}>{toggle.label}</Text>
                    <View style={[styles.box, toggle.on && styles.boxOn]}>
                      {toggle.on && <Icon name="check" size={12} color={Colors.primaryBright} strokeWidth={2.8} />}
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      borderRadius: 999,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 7,
    },
    pillFloating: { backgroundColor: Colors.glass },
    pillActive: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.primary },
    pillText: { fontSize: 13, fontWeight: '700' },
    menu: {
      position: 'absolute',
      width: MENU_WIDTH,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.primary,
      borderRadius: 16,
      padding: 6,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 11,
      borderRadius: 10,
    },
    itemSelected: { backgroundColor: Colors.surfaceHigh },
    itemText: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
    itemTextSelected: { color: Colors.primaryBright },
    divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4, marginHorizontal: 6 },
    box: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxOn: { borderColor: Colors.primary },
  });
