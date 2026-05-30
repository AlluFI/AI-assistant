import type { MealSlot } from './meal-plans.types';

export function fallbackMealStructure(
  prefs: Record<string, unknown>,
  days: number,
  startDate: string,
  timezone: string,
): { meals: MealSlot[] } {
  const meals: MealSlot[] = [];
  const mealsPerDay = Number(prefs.meals_per_day ?? 3);
  const snacksPerDay = Number(prefs.snacks_per_day ?? 0);
  const mainLabels = ['breakfast', 'lunch', 'dinner'];
  const types: string[] = [];
  for (let i = 0; i < mealsPerDay; i++) {
    types.push(mainLabels[i] ?? 'meal');
  }
  for (let s = 0; s < snacksPerDay; s++) {
    types.push('snack');
  }

  for (let d = 0; d < days; d++) {
    const base = new Date(`${startDate}T08:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + d);
    void timezone;
    const hours = [8, 10, 12, 15, 19];
    types.forEach((mealType, i) => {
      const at = new Date(base);
      at.setUTCHours(hours[i] ?? 12, 0, 0, 0);
      meals.push({
        dayIndex: d,
        mealType,
        scheduledAt: at.toISOString(),
        title: `${mealType} — day ${d + 1}`,
      });
    });
  }
  return { meals };
}

/** Align AI structure with meals_per_day + snacks_per_day so calorie budgets stay correct. */
export function enforceMealStructureSlots(
  structure: { meals: MealSlot[] },
  prefs: Record<string, unknown>,
  days: number,
  startDate: string,
  timezone: string,
): { meals: MealSlot[] } {
  const template = fallbackMealStructure(
    prefs,
    days,
    startDate,
    timezone,
  ).meals;
  const byDay = new Map<number, MealSlot[]>();
  for (const slot of structure.meals) {
    const list = byDay.get(slot.dayIndex) ?? [];
    list.push(slot);
    byDay.set(slot.dayIndex, list);
  }

  const meals: MealSlot[] = [];
  for (let d = 0; d < days; d++) {
    const expected = template.filter((m) => m.dayIndex === d);
    const fromAi = (byDay.get(d) ?? []).slice(0, expected.length);
    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const act = fromAi[i];
      meals.push({
        dayIndex: d,
        mealType: exp.mealType,
        scheduledAt: act?.scheduledAt ?? exp.scheduledAt,
        title: act?.title ?? exp.title,
      });
    }
  }
  return { meals };
}
