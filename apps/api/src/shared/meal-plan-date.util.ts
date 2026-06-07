export function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateForPlanDay(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

export function planEndDate(startDate: string, duration: string): string {
  if (duration === 'weekly') {
    return dateForPlanDay(startDate, 6);
  }
  return startDate.slice(0, 10);
}

/** Daily plans apply only on startDate; weekly plans cover startDate … startDate+6. */
export function planCoversDate(
  startDate: string,
  duration: string,
  targetDate: string,
): boolean {
  const start = startDate.slice(0, 10);
  const target = targetDate.slice(0, 10);
  if (duration === 'daily') {
    return start === target;
  }
  const end = planEndDate(start, duration);
  return target >= start && target <= end;
}

export function dayIndexForPlanDate(
  startDate: string,
  targetDate: string,
  duration: string,
): number {
  if (duration === 'daily') return 0;
  const start = new Date(`${startDate}T12:00:00.000Z`);
  const target = new Date(`${targetDate}T12:00:00.000Z`);
  const diff = Math.round((target.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.min(6, diff));
}
