/** Mirrors apps/api/src/shared/meal-plan-date.util.ts for meal plan UI. */

export function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dateForPlanDay(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate.slice(0, 10)}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dayIndex)
  return d.toISOString().slice(0, 10)
}

/** 0-based day index for a calendar date within a plan (weekly clamped 0–6). */
export function dayIndexForPlanDate(
  startDate: string,
  targetDate: string,
  duration: string,
): number {
  if (duration === 'daily') return 0
  const start = new Date(`${startDate.slice(0, 10)}T12:00:00.000Z`)
  const target = new Date(`${targetDate.slice(0, 10)}T12:00:00.000Z`)
  const diff = Math.round((target.getTime() - start.getTime()) / 86400000)
  return Math.max(0, Math.min(6, diff))
}

/** Default day tab for “today” (or nearest day that has meals). */
export function pickVisibleDayIndex(
  availableDayIndexes: number[],
  startDate: string,
  duration: string,
  referenceDate: string = utcTodayIso(),
): number {
  if (!availableDayIndexes.length) return 0
  const preferred = dayIndexForPlanDate(startDate, referenceDate, duration)
  if (availableDayIndexes.includes(preferred)) return preferred
  return availableDayIndexes.reduce((best, d) =>
    Math.abs(d - preferred) < Math.abs(best - preferred) ? d : best,
  )
}
