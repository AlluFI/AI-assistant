import { parseAddManualMealIntent } from './wingman-intent';

describe('parseAddManualMealIntent', () => {
  it('parses "as a snack for today\'s meal plan"', () => {
    const parsed = parseAddManualMealIntent(
      "add a protein shake as a snack for today's meal plan",
    );
    expect(parsed).toEqual({
      title: 'protein shake',
      mealType: 'snack',
      mealTypeLabel: 'Snack',
    });
  });

  it('parses "to my meal plan"', () => {
    const parsed = parseAddManualMealIntent('add a protein shake to my meal plan');
    expect(parsed).toEqual({
      title: 'protein shake',
      mealType: 'snack',
      mealTypeLabel: 'Snack',
    });
  });

  it('ignores nutrient lookup phrasing', () => {
    expect(
      parseAddManualMealIntent('what protein is in my snack today?'),
    ).toBeNull();
  });
});
