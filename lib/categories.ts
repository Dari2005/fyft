import type { IconName } from '@/components/Icon';

/**
 * Fixed event categories (Dari, 2026-11-14). Fyft is evening-only; every
 * event is one of these three. Stored in `parties.party_type` as the key.
 * Older events may hold free text there (the field used to be "Event type"):
 * anything that is not a known key counts as 'party'.
 */
export type CategoryKey = 'party' | 'live' | 'kafana';

export const CATEGORIES: { key: CategoryKey; label: string; icon: IconName }[] = [
  { key: 'party', label: 'Party', icon: 'disco' },
  { key: 'live', label: 'Live music', icon: 'mic' },
  { key: 'kafana', label: 'Kafana night', icon: 'wine' },
];

export function categoryOf(partyType: string | null | undefined): CategoryKey {
  return partyType === 'live' || partyType === 'kafana' ? partyType : 'party';
}

export function categoryInfo(partyType: string | null | undefined) {
  const key = categoryOf(partyType);
  return CATEGORIES.find((c) => c.key === key)!;
}
