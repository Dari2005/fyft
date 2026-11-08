/**
 * "Tonight" / "Tomorrow" windows for the Tonight tab.
 *
 * A night out doesn't end at midnight, so the day boundary is 05:00: an event
 * starting at 01:30 on Saturday still belongs to "Friday night". Events that
 * started up to LIVE_WINDOW_MS ago are still "happening now".
 */
export const NIGHT_CUTOFF_HOUR = 5;
export const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

export interface NightWindows {
  /** Earliest start time still worth showing (events in progress). */
  from: Date;
  /** End of tonight == start of tomorrow's window. */
  tonightEnd: Date;
  tomorrowEnd: Date;
  /** "Tonight" in the evening / small hours, "Today" in the daytime. */
  tonightLabel: 'Tonight' | 'Today';
}

export function nightWindows(now: Date = new Date()): NightWindows {
  const tonightEnd = new Date(now);
  tonightEnd.setHours(NIGHT_CUTOFF_HOUR, 0, 0, 0);
  if (now.getTime() >= tonightEnd.getTime()) {
    tonightEnd.setDate(tonightEnd.getDate() + 1);
  }
  const tomorrowEnd = new Date(tonightEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const hour = now.getHours();
  const tonightLabel = hour >= 17 || hour < NIGHT_CUTOFF_HOUR ? 'Tonight' : 'Today';

  return {
    from: new Date(now.getTime() - LIVE_WINDOW_MS),
    tonightEnd,
    tomorrowEnd,
    tonightLabel,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The "night" a moment belongs to: local midnight of (time − 05:00). */
function nightStart(d: Date): Date {
  const n = new Date(d.getTime() - NIGHT_CUTOFF_HOUR * 60 * 60 * 1000);
  n.setHours(0, 0, 0, 0);
  return n;
}

/**
 * Section key + heading for grouping a list by night: "Tonight"/"Today",
 * "Tomorrow", then "Sat 14 Nov". Uses the 05:00 boundary, so a 01:30 start
 * on Saturday is grouped under Friday night.
 */
export function nightGroup(startsAtIso: string, now: Date = new Date()): { key: string; title: string } {
  const night = nightStart(new Date(startsAtIso));
  const today = nightStart(now);
  const diff = Math.round((night.getTime() - today.getTime()) / DAY_MS);
  const key = `${night.getFullYear()}-${night.getMonth()}-${night.getDate()}`;
  if (diff === 0) return { key, title: nightWindows(now).tonightLabel };
  if (diff === 1) return { key, title: 'Tomorrow' };
  return {
    key,
    title: `${WEEKDAYS[night.getDay()]} ${night.getDate()} ${MONTHS[night.getMonth()]}`,
  };
}

/** True while an event is in progress (started within the live window). */
export function isLiveNow(startsAtIso: string, now: Date = new Date()): boolean {
  const start = new Date(startsAtIso).getTime();
  return start <= now.getTime() && now.getTime() - start <= LIVE_WINDOW_MS;
}
