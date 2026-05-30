import {
  enforceMealStructureSlots,
  fallbackMealStructure,
} from './meal-plan-structure.util';

describe('meal-plan-structure.util', () => {
  const prefs = {
    meals_per_day: 3,
    snacks_per_day: 1,
  };

  it('builds breakfast/lunch/dinner plus snack per day', () => {
    const { meals } = fallbackMealStructure(prefs, 2, '2026-06-01', 'UTC');
    expect(meals).toHaveLength(8);
    const day0 = meals.filter((m) => m.dayIndex === 0);
    expect(day0.map((m) => m.mealType)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
    ]);
  });

  it('trims extra AI slots and preserves titles when present', () => {
    const template = fallbackMealStructure(prefs, 1, '2026-06-01', 'UTC');
    const extraAiSlots = [
      ...template.meals,
      {
        dayIndex: 0,
        mealType: 'extra',
        scheduledAt: template.meals[0].scheduledAt,
        title: 'Should be dropped',
      },
    ];
    extraAiSlots[0] = { ...extraAiSlots[0], title: 'AI breakfast' };
    const { meals } = enforceMealStructureSlots(
      { meals: extraAiSlots },
      prefs,
      1,
      '2026-06-01',
      'UTC',
    );
    expect(meals).toHaveLength(4);
    expect(meals[0].title).toBe('AI breakfast');
    expect(meals[0].mealType).toBe('breakfast');
  });
});
