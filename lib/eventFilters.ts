import { isOver, nightWindows } from '@/lib/tonight';
import type { Party } from '@/lib/types';
import { categoryInfo, categoryOf, type CategoryKey } from '@/lib/categories';

/**
 * Search + filter state shared by the Events list and the Map, so both
 * screens narrow events down the same way.
 */
export type TimeFilter = 'all' | 'tonight' | 'tomorrow' | 'weekend';
/** 'following' = events by organizers the user follows. */
export type PeopleFilter = 'all' | 'following';

export interface EventFilters {
  query: string;
  time: TimeFilter;
  people: PeopleFilter;
  category: CategoryKey | 'all';
}

export const DEFAULT_FILTERS: EventFilters = {
  query: '',
  time: 'all',
  people: 'all',
  category: 'all',
};

export interface FilterContext {
  now: Date;
  followingIds: Set<string>;
}

export function isFiltering(f: EventFilters): boolean {
  return f.query.trim() !== '' || f.time !== 'all' || f.people !== 'all' || f.category !== 'all';
}

/**
 * True when the date falls on THIS weekend: the coming Saturday/Sunday, or
 * the one we are in. (Until 2026-11-14 any Saturday or Sunday matched, so
 * "This weekend" also listed events weeks away.)
 */
function isWeekend(d: Date, now: Date): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const saturday = new Date(today);
  // On a Sunday the weekend's Saturday was yesterday, not six days ahead.
  saturday.setDate(
    today.getDate() + (today.getDay() === 0 ? -1 : (6 - today.getDay() + 7) % 7)
  );
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  const only = new Date(d);
  only.setHours(0, 0, 0, 0);
  return only.getTime() === saturday.getTime() || only.getTime() === sunday.getTime();
}

/**
 * Returns a predicate for the given filters. "Tonight" and "Tomorrow" use the
 * 05:00 night boundary from lib/tonight (an event at 01:30 Saturday is still
 * Friday night; events in progress stay visible for a few hours).
 */
export function makeEventMatcher(
  f: EventFilters,
  ctx: FilterContext
): (p: Party) => boolean {
  const q = f.query.trim().toLowerCase();
  const w = nightWindows(ctx.now);

  return (p) => {
    // Events whose night is finished never show on Events or the Map.
    if (isOver(p.starts_at, ctx.now)) return false;

    if (
      q &&
      !(
        p.title.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q) ?? false) ||
        (p.host_name?.toLowerCase().includes(q) ?? false) ||
        categoryInfo(p.party_type).label.toLowerCase().includes(q)
      )
    ) {
      return false;
    }

    if (f.category !== 'all' && categoryOf(p.party_type) !== f.category) return false;

    if (f.people === 'following' && !ctx.followingIds.has(p.organizer_id)) return false;

    const start = new Date(p.starts_at);
    const t = start.getTime();
    switch (f.time) {
      case 'tonight':
        return t >= w.from.getTime() && t < w.tonightEnd.getTime();
      case 'tomorrow':
        return t >= w.tonightEnd.getTime() && t < w.tomorrowEnd.getTime();
      case 'weekend':
        return isWeekend(start, ctx.now);
      default:
        return true;
    }
  };
}
