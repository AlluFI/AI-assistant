export function dateForPlanDay(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
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
