import type { Palette } from '@/constants/theme';

/**
 * "Will it be empty?" — the crowd label shown on every event (Dari,
 * 2026-11-08: Fyft exists so people don't go to empty parties). Only
 * "going" counts; there is no "interested".
 *
 * With a capacity the label is relative (20 is busy for a 25-person house
 * party, empty for a 500-person club). Without one, fixed thresholds are
 * used — tune them here as the user base grows. "so far" is deliberate: a
 * low number days before the event only means people haven't signed up yet.
 */
export type CrowdLevel = 'empty' | 'quiet' | 'getting' | 'busy' | 'almost' | 'full';

/** Thresholds for events WITHOUT a capacity (number of people going). */
export const CROWD_THRESHOLDS = { getting: 10, busy: 25 } as const;

/** Thresholds for events WITH a capacity (share of capacity going). */
export const CAPACITY_THRESHOLDS = { getting: 0.25, busy: 0.6, almost: 0.9 } as const;

const LABELS: Record<CrowdLevel, string> = {
  empty: 'Be the first',
  quiet: 'Quiet so far',
  getting: 'Getting busy',
  busy: 'Busy',
  almost: 'Almost full',
  full: 'Full',
};

export interface Crowd {
  level: CrowdLevel;
  label: string;
  /** 0..1 — how much of the meter bar to fill. */
  fill: number;
}

export function crowdFor(going: number, capacity: number | null | undefined): Crowd {
  let level: CrowdLevel;
  let fill: number;
  if (capacity != null && capacity > 0) {
    const share = going / capacity;
    fill = Math.min(1, share);
    if (going === 0) level = 'empty';
    else if (share >= 1) level = 'full';
    else if (share >= CAPACITY_THRESHOLDS.almost) level = 'almost';
    else if (share >= CAPACITY_THRESHOLDS.busy) level = 'busy';
    else if (share >= CAPACITY_THRESHOLDS.getting) level = 'getting';
    else level = 'quiet';
  } else {
    // Bar reaches ~full a bit past "busy".
    fill = Math.min(1, going / (CROWD_THRESHOLDS.busy * 1.4));
    if (going === 0) level = 'empty';
    else if (going >= CROWD_THRESHOLDS.busy) level = 'busy';
    else if (going >= CROWD_THRESHOLDS.getting) level = 'getting';
    else level = 'quiet';
  }
  return { level, label: LABELS[level], fill };
}

/** Color of the label and bar: amber when quiet → green when busy. */
export function crowdColor(level: CrowdLevel, c: Palette): string {
  switch (level) {
    case 'empty':
      return c.primaryBright;
    case 'quiet':
      return c.warning;
    case 'getting':
      return c.lime;
    case 'busy':
      return c.success;
    case 'almost':
      return c.orange;
    case 'full':
      return c.danger;
  }
}
