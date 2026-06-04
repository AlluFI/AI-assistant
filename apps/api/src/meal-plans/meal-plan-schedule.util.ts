import type { MealSlot } from './meal-plans.types';

const DEFAULT_TIMES: Record<string, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '19:00',
  snack: '15:00',
};

const DEFAULT_SNACK_TIMES = ['15:00', '10:30', '16:30', '21:00'];

/** Time-slot keys aligned with nutrition profile (`snack`, `snack_2`, …). */
export function mealSlotTimeKeys(
  mealsPerDay: number,
  snacksPerDay: number,
): string[] {
  const mains = ['breakfast', 'lunch', 'dinner'];
  const keys: string[] = [];
  const meals = Math.min(6, Math.max(1, Math.round(mealsPerDay)));
  const snacks = Math.min(4, Math.max(0, Math.round(snacksPerDay)));
  for (let i = 0; i < meals; i++) {
    keys.push(mains[i] ?? `meal_${i + 1}`);
  }
  for (let s = 0; s < snacks; s++) {
    keys.push(s === 0 ? 'snack' : `snack_${s + 1}`);
  }
  return keys;
}

function defaultHhmmForKey(key: string): string {
  if (key in DEFAULT_TIMES) return DEFAULT_TIMES[key];
  const m = /^snack_(\d+)$/.exec(key);
  if (key === 'snack') return DEFAULT_SNACK_TIMES[0];
  if (m) {
    const idx = Number(m[1]) - 1;
    return DEFAULT_SNACK_TIMES[idx] ?? '15:00';
  }
  return '12:00';
}

function parseIsoToHhmm(iso: unknown, fallbackKey: string): string {
  if (typeof iso !== 'string' || !iso.trim()) {
    return defaultHhmmForKey(fallbackKey);
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultHhmmForKey(fallbackKey);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function hhmmToIsoOnDate(hhmm: string, date: string): string {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Math.min(23, Math.max(0, Number(hRaw) || 0));
  const m = Math.min(59, Math.max(0, Number(mRaw) || 0));
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

/** Map preferred_meal_times JSON to slot keys. */
export function preferredTimesBySlotKey(
  raw: unknown,
  mealsPerDay: number,
  snacksPerDay: number,
): Map<string, string> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const map = new Map<string, string>();
  for (const key of mealSlotTimeKeys(mealsPerDay, snacksPerDay)) {
    if (key.startsWith('snack')) {
      const legacy = key === 'snack' ? obj.snack : undefined;
      map.set(key, parseIsoToHhmm(obj[key] ?? legacy, key));
    } else {
      map.set(key, parseIsoToHhmm(obj[key], key));
    }
  }
  return map;
}

/** Apply saved preferred meal times to planned slots (per day, by slot order). */
export function applyScheduleToMeals(
  meals: MealSlot[],
  prefs: Record<string, unknown>,
  startDate: string,
): MealSlot[] {
  const mealsPerDay = Number(prefs.meals_per_day ?? 3);
  const snacksPerDay = Number(prefs.snacks_per_day ?? 0);
  const keys = mealSlotTimeKeys(mealsPerDay, snacksPerDay);
  const times = preferredTimesBySlotKey(
    prefs.preferred_meal_times,
    mealsPerDay,
    snacksPerDay,
  );

  const byDay = new Map<number, MealSlot[]>();
  for (const slot of meals) {
    const list = byDay.get(slot.dayIndex) ?? [];
    list.push(slot);
    byDay.set(slot.dayIndex, list);
  }

  const out: MealSlot[] = [];
  for (const [dayIndex, dayMeals] of byDay.entries()) {
    const date = dateForPlanDay(startDate, dayIndex);
    dayMeals.forEach((meal, i) => {
      const key = keys[i] ?? keys[keys.length - 1] ?? 'lunch';
      const hhmm = times.get(key) ?? defaultHhmmForKey(key);
      out.push({
        ...meal,
        scheduledAt: hhmmToIsoOnDate(hhmm, date),
      });
    });
  }

  return out.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return (
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  });
}

function dateForPlanDay(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}
