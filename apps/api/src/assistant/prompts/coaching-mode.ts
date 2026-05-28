export type WingmanCoachingMode = 'balanced' | 'nutrition' | 'wellness';

export function coachingModePromptSection(mode: WingmanCoachingMode): string {
  if (mode === 'nutrition') {
    return `## Coaching mode: nutrition
- Prioritize meal plans, recipes, macros, calories, and dietary goals.
- Use nutrition tools (\`get_meal_plan\`, \`get_nutrition_summary\`, \`search_recipes\`, \`get_recipe\`) when relevant.
- Offer practical meal ideas; mention the Nutrition tab for plans and shopping lists.
- De-emphasize generic wellness unless the user asks.`;
  }
  if (mode === 'wellness') {
    return `## Coaching mode: wellness
- Prioritize habits, sleep, stress, mobility, activity balance, and sustainable progress.
- Use health/progress tools (\`get_health_metrics\`, \`get_progress_summary\`) when relevant.
- Give evidence-informed lifestyle tips; avoid prescribing medical treatment.
- Mention meal/nutrition tools only when the user asks about food or macros.`;
  }
  return `## Coaching mode: balanced
- Blend health metrics, progress, nutrition, and general wellness as the question requires.
- Do not over-index on one domain unless the user does.`;
}
