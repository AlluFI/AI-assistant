/** Scoring helpers for DailyCheckIn → wellness habits component. */

export type CheckInRow = {
  sleepHours: number | null;
  waterGlasses: number | null;
  mood: number | null;
};

export function sleepCheckInScore(hours: number): number {
  if (hours < 4) return Math.max(20, Math.round(hours * 10));
  if (hours >= 7 && hours <= 9) return 100;
  if (hours >= 6 && hours < 7) return 85;
  if (hours > 9 && hours <= 10) return 85;
  if (hours >= 5 && hours < 6) return 70;
  return 55;
}

export function waterCheckInScore(glasses: number): number {
  const target = 8;
  return Math.min(100, Math.round((glasses / target) * 100));
}

export function moodCheckInScore(mood: number): number {
  const m = Math.min(5, Math.max(1, Math.round(mood)));
  return Math.round((m / 5) * 100);
}

/** 0–100 for one day from whichever fields are logged. */
export function dayCheckInScore(row: CheckInRow): number | null {
  const parts: number[] = [];
  if (row.sleepHours != null && row.sleepHours >= 0) {
    parts.push(sleepCheckInScore(row.sleepHours));
  }
  if (row.waterGlasses != null && row.waterGlasses >= 0) {
    parts.push(waterCheckInScore(row.waterGlasses));
  }
  if (row.mood != null && row.mood >= 1) {
    parts.push(moodCheckInScore(row.mood));
  }
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Average daily check-in score over rows that have at least one habit field. */
export function averageCheckInScore(rows: CheckInRow[]): number | null {
  const scores = rows
    .map((r) => dayCheckInScore(r))
    .filter((s): s is number => s != null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
