import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import Icon, { type IconName } from '@/components/Icon';
import { nightWindows } from '@/lib/tonight';
import type { EventFilters, TimeFilter } from '@/lib/eventFilters';
import { CATEGORIES, type CategoryKey } from '@/lib/categories';
import Dropdown from '@/components/Dropdown';

const TIMES: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'Any time' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

const ALL_TYPES = { key: 'all' as const, label: 'All types', icon: 'grid' as IconName };

interface ChipProps {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
  floating?: boolean;
}

/** One filter chip: neutral glass, thin bright-magenta border when active. */
export function FilterChip({ label, icon, active, onPress, floating }: ChipProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const textColor = active ? Colors.primaryText : floating ? Colors.text : Colors.muted;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, floating && styles.chipFloating, active && styles.chipActive]}
    >
      <View style={styles.chipInner}>
        {icon ? <Icon name={icon} size={14} color={active ? Colors.primaryBright : textColor} /> : null}
        <Text style={[styles.chipText, { color: textColor }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  filters: EventFilters;
  onChange: (next: EventFilters) => void;
  /** Extra control shown last in the row (e.g. the Events list's sort menu). */
  trailing?: ReactNode;
  /** Translucent glass style for drawing over the map. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Search bar + ONE row of dropdowns (Dari, 2026-11-14: no sideways
 * scrolling): When, Type (with "Only organizers I follow" inside), plus an
 * optional trailing control.
 */
export default function EventFilterBar({
  filters,
  onChange,
  trailing,
  floating,
  style,
}: Props) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const set = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch });

  return (
    <View style={style}>
      <View style={[styles.searchWrap, floating && styles.searchFloating]}>
        <Icon name="search" size={17} color={Colors.muted} />
        <TextInput
          value={filters.query}
          onChangeText={(query) => set({ query })}
          placeholder="Search events and places…"
          placeholderTextColor={Colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {filters.query !== '' && (
          <TouchableOpacity onPress={() => set({ query: '' })} hitSlop={8}>
            <Icon name="close" size={16} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.row}>
        <Dropdown<TimeFilter>
          label={
            filters.time === 'tonight'
              ? nightWindows().tonightLabel
              : TIMES.find((t) => t.key === filters.time)!.label
          }
          active={filters.time !== 'all'}
          value={filters.time}
          // "Tonight" in the evening, "Today" in the daytime (05:00 boundary).
          options={TIMES.map((t) => ({
            key: t.key,
            label: t.key === 'tonight' ? nightWindows().tonightLabel : t.label,
          }))}
          onSelect={(time) => set({ time })}
          floating={floating}
        />
        <Dropdown<CategoryKey | 'all'>
          label={
            filters.category === 'all'
              ? filters.people === 'following'
                ? 'Following'
                : ALL_TYPES.label
              : CATEGORIES.find((c) => c.key === filters.category)!.label
          }
          icon={
            filters.people === 'following'
              ? 'star'
              : filters.category === 'all'
                ? undefined
                : CATEGORIES.find((c) => c.key === filters.category)!.icon
          }
          active={filters.category !== 'all' || filters.people === 'following'}
          value={filters.category}
          options={[ALL_TYPES, ...CATEGORIES]}
          onSelect={(category) => set({ category })}
          toggle={{
            label: 'Only organizers I follow',
            icon: 'star',
            on: filters.people === 'following',
            onToggle: () => set({ people: filters.people === 'following' ? 'all' : 'following' }),
          }}
          floating={floating}
        />
        {trailing}
      </View>
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  searchFloating: { backgroundColor: Colors.glass },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  chipFloating: { backgroundColor: Colors.glass },
  chipActive: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.primary },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipDivider: { width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: 2 },
});
