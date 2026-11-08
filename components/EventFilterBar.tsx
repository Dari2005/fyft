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
import type { EventFilters, PeopleFilter, TimeFilter } from '@/lib/eventFilters';

const TIMES: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

const PEOPLE: { key: Exclude<PeopleFilter, 'all'>; icon: string; label: string }[] = [
  { key: 'friends', icon: '👥', label: 'Friends going' },
  { key: 'following', icon: '⭐', label: 'Following' },
];

interface ChipProps {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
  floating?: boolean;
}

/**
 * One filter chip. The icon and the label are separate Text nodes on
 * purpose: with an emoji in the same string, Android truncated or dropped
 * the label once the active style kicked in.
 */
export function FilterChip({ label, icon, active, onPress, floating }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, floating && styles.chipFloating, active && styles.chipActive]}
    >
      <View style={styles.chipInner}>
        {icon ? <Text style={styles.chipText}>{icon}</Text> : null}
        <Text style={[styles.chipText, floating && styles.textFloating, active && styles.chipTextActive]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  filters: EventFilters;
  onChange: (next: EventFilters) => void;
  /** Extra chips shown first (e.g. the Events list's sort options). */
  leadingChips?: ReactNode;
  /** Opaque, shadowed style for drawing over the map. */
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
        <Text style={styles.searchIcon}>🔍</Text>
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
            <Text style={styles.clearText}>✕</Text>
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

const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 4,
};

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchFloating: { ...shadow },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10 },
  clearText: { color: Colors.muted, fontSize: 16, paddingHorizontal: 4 },
  chipScroll: { flexGrow: 0, marginTop: Spacing.sm },
  chipRow: { paddingHorizontal: Spacing.md, gap: Spacing.xs, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  chipFloating: { ...shadow, elevation: 3 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },
  textFloating: { color: Colors.text },
  chipTextActive: { color: Colors.primaryText },
  chipDivider: { width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: 2 },
});
