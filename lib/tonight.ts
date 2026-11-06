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

/** True while an event is in progress (started within the live window). */
export function isLiveNow(startsAtIso: string, now: Date = new Date()): boolean {
  const start = new Date(startsAtIso).getTime();
  return start <= now.getTime() && now.getTime() - start <= LIVE_WINDOW_MS;
}
