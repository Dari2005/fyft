import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import Icon, { type IconName } from '@/components/Icon';
import type { EventFilters, PeopleFilter, TimeFilter } from '@/lib/eventFilters';

const TIMES: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

const PEOPLE: { key: Exclude<PeopleFilter, 'all'>; icon: IconName; label: string }[] = [
  { key: 'friends', icon: 'users', label: 'Friends going' },
  { key: 'following', icon: 'star', label: 'Following' },
];

interface ChipProps {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
  floating?: boolean;
}

/** One filter chip: neutral glass, thin bright-purple border when active. */
export function FilterChip({ label, icon, active, onPress, floating }: ChipProps) {
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
  /** Extra chips shown first (e.g. the Events list's sort options). */
  leadingChips?: ReactNode;
  /** Translucent glass style for drawing over the map. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Search bar + one row of time and people filter chips. */
export default function EventFilterBar({
  filters,
  onChange,
  leadingChips,
  floating,
  style,
}: Props) {
  const set = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch });

  return (
    <View style={style}>
      <View style={[styles.searchWrap, floating && styles.searchFloating]}>
        <Icon name="search" size={17} color={Colors.muted} />
        <TextInput
          value={filters.query}
          onChangeText={(query) => set({ query })}
          placeholder="Search events, places, types…"
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {leadingChips}
        {leadingChips ? <View style={styles.chipDivider} /> : null}
        {TIMES.map((t) => (
          <FilterChip
            key={t.key}
            label={t.label}
            active={filters.time === t.key}
            onPress={() => set({ time: t.key })}
            floating={floating}
          />
        ))}
        <View style={styles.chipDivider} />
        {PEOPLE.map((p) => (
          <FilterChip
            key={p.key}
            icon={p.icon}
            label={p.label}
            active={filters.people === p.key}
            // Tapping the active people chip again turns it off.
            onPress={() => set({ people: filters.people === p.key ? 'all' : p.key })}
            floating={floating}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  chipScroll: { flexGrow: 0, marginTop: Spacing.sm },
  chipRow: { paddingHorizontal: Spacing.md, gap: Spacing.xs, alignItems: 'center' },
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
