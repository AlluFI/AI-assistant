type PlannedMealRow = {
  mealType: string;
  title: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  recipeLinked?: boolean;
};

export function formatPlannedMealNutrientsReply(
  mealTypeLabel: string,
  date: string,
  meal: PlannedMealRow,
): string {
  const lines = [
    `**${mealTypeLabel}** on ${date}: **${meal.title}**`,
  ];
  if (meal.calories != null) {
    const macroParts: string[] = [`**${Math.round(meal.calories)} kcal**`];
    if (meal.protein != null) macroParts.push(`**${meal.protein}g** protein`);
    if (meal.carbs != null) macroParts.push(`**${meal.carbs}g** carbs`);
    if (meal.fats != null) macroParts.push(`**${meal.fats}g** fat`);
    lines.push(`Planned macros: ${macroParts.join(' · ')}.`);
  } else {
    lines.push('Macro totals are not on the plan yet — confirm recipes in the Nutrition tab.');
  }
  if (meal.recipeLinked === false) {
    lines.push(
      'No recipe linked to this slot yet; regenerate or confirm recipes for full ingredient detail.',
    );
  }
  return lines.join('\n');
}

export function mealTypeLabel(mealType: string): string {
  switch (mealType) {
    case 'breakfast':
      return 'Breakfast';
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    case 'snack':
      return 'Snack';
    default:
      return mealType;
  }
}
