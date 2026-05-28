/** Monday 00:00 UTC for the week containing `d`. */
export function weekStartUtc(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = x.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

/** Sunday 12:00 UTC — chart point timestamp for a week bucket. */
export function weekChartTimestamp(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(12, 0, 0, 0);
  return end.toISOString();
}

export function dayKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ActivityLogRow = { activityAt: Date };

/** Distinct active days per week (capped at 7) from session logs. */
export function weeklyActiveDaysFromLogs(
  logs: ActivityLogRow[],
): Array<{ t: string; weeklyActivityDays: number }> {
  const byWeek = new Map<string, Set<string>>();

  for (const log of logs) {
    const at = log.activityAt;
    const ws = weekStartUtc(at);
    const wk = ws.toISOString().slice(0, 10);
    const days = byWeek.get(wk) ?? new Set<string>();
    days.add(dayKeyUtc(at));
    byWeek.set(wk, days);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, days]) => {
      const weekStart = new Date(`${wk}T00:00:00.000Z`);
      return {
        t: weekChartTimestamp(weekStart),
        weeklyActivityDays: Math.min(7, days.size),
      };
    });
}

export function weekKeyFromIso(t: string): string {
  return weekStartUtc(new Date(t)).toISOString().slice(0, 10);
}
