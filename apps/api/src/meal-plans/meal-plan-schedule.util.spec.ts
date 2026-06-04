import {
  applyScheduleToMeals,
  mealSlotTimeKeys,
  preferredTimesBySlotKey,
} from './meal-plan-schedule.util';

describe('meal-plan-schedule.util', () => {
  it('builds snack_2 key for second snack', () => {
    expect(mealSlotTimeKeys(3, 2)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'snack_2',
    ]);
  });

  it('applies preferred times per snack slot', () => {
    const prefs = {
      meals_per_day: 3,
      snacks_per_day: 2,
      preferred_meal_times: {
        breakfast: '2026-01-01T07:00:00.000Z',
        lunch: '2026-01-01T12:00:00.000Z',
        dinner: '2026-01-01T18:00:00.000Z',
        snack: '2026-01-01T10:00:00.000Z',
        snack_2: '2026-01-01T16:00:00.000Z',
      },
    };
    const meals = applyScheduleToMeals(
      [
        {
          dayIndex: 0,
          mealType: 'breakfast',
          scheduledAt: '2026-06-01T08:00:00.000Z',
          title: 'A',
        },
        {
          dayIndex: 0,
          mealType: 'lunch',
          scheduledAt: '2026-06-01T12:30:00.000Z',
          title: 'B',
        },
        {
          dayIndex: 0,
          mealType: 'dinner',
          scheduledAt: '2026-06-01T19:00:00.000Z',
          title: 'C',
        },
        {
          dayIndex: 0,
          mealType: 'snack',
          scheduledAt: '2026-06-01T15:00:00.000Z',
          title: 'D',
        },
        {
          dayIndex: 0,
          mealType: 'snack',
          scheduledAt: '2026-06-01T15:00:00.000Z',
          title: 'E',
        },
      ],
      prefs,
      '2026-06-01',
    );
    const hour = (title: string) =>
      new Date(meals.find((m) => m.title === title)!.scheduledAt).getUTCHours();
    expect(hour('A')).toBe(7);
    expect(hour('D')).toBe(10);
    expect(hour('E')).toBe(16);
  });

  it('parses legacy snack key for first snack only', () => {
    const map = preferredTimesBySlotKey(
      { snack: '2026-01-01T11:30:00.000Z' },
      3,
      1,
    );
    expect(map.get('snack')).toBe('11:30');
  });
});
