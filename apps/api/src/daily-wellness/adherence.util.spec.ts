import { sumLogNutrition } from './adherence.util';

describe('sumLogNutrition', () => {
  it('sums valid nutrition rows', () => {
    const total = sumLogNutrition([
      { nutrition: { calories: 200, protein: 20, carbs: 10, fats: 5 } },
      { nutrition: { calories: 100, protein: 5, carbs: 15, fats: 2 } },
    ]);
    expect(total.calories).toBe(300);
    expect(total.protein).toBe(25);
  });
});
