import {
  formatWeeklyMealPlanMarkdown,
  weekdayForDate,
} from './weekly-meal-plan-format.util';

describe('weekly-meal-plan-format.util', () => {
  it('formats weekday from date', () => {
    expect(weekdayForDate('2026-05-30')).toBe('Sat');
    expect(weekdayForDate('2026-06-05')).toBe('Fri');
  });

  it('includes all 7 days in markdown output', () => {
    const plan = {
      scope: 'week' as const,
      startDate: '2026-05-30',
      endDate: '2026-06-05',
      dayCount: 7,
      days: Array.from({ length: 7 }, (_, dayIndex) => ({
        dayIndex,
        date: `2026-05-${30 + dayIndex}`.replace(
          /-(\d\d\d)$/,
          (_, n) => `-0${Number(n) % 10 || 10}`.slice(-3),
        ),
        weekday: weekdayForDate(
          new Date(Date.UTC(2026, 4, 30 + dayIndex)).toISOString().slice(0, 10),
        ),
        meals: [
          {
            mealType: 'breakfast',
            title: `Breakfast ${dayIndex + 1}`,
            calories: 400,
            protein: 25,
            carbs: 40,
            fats: 12,
          },
        ],
        totalPlannedCalories: 400,
      })),
    };

    // Fix dates properly
    for (let i = 0; i < 7; i += 1) {
      const d = new Date('2026-05-30T12:00:00.000Z');
      d.setUTCDate(d.getUTCDate() + i);
      plan.days[i].date = d.toISOString().slice(0, 10);
      plan.days[i].weekday = weekdayForDate(plan.days[i].date);
    }

    const md = formatWeeklyMealPlanMarkdown(plan);
    expect(md).toContain('2026-05-30');
    expect(md).toContain('2026-06-05');
    expect((md.match(/^### /gm) ?? []).length).toBe(7);
  });
});
