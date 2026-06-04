export type WingmanCoachingMode =
  | 'balanced'
  | 'nutrition'
  | 'wellness'
  | 'onboarding';

export function coachingModePromptSection(mode: WingmanCoachingMode): string {
  if (mode === 'onboarding') {
    return `## Coaching mode: setup wizard
- Guide the user through initial setup: health basics → calorie/macro targets → meal schedule.
- Use \`update_health_profile\`, \`update_nutrition_targets\`, and \`update_nutrition_preferences\` to save what they state explicitly.
- Prefer confirm buttons for AI/formula targets and default schedules; do not claim data was saved without a tool or confirm action.
- Keep replies short and ask one step at a time when information is missing.`;
  }
  if (mode === 'nutrition') {
    return `## Coaching mode: nutrition
- Prioritize meal plans, recipes, macros, calories, and dietary goals.
- Use nutrition tools (\`get_meal_plan\`, \`get_nutrition_summary\`, \`search_recipes\`, \`get_recipe\`, \`update_nutrition_targets\`, \`update_nutrition_preferences\`) when relevant.
- Offer practical meal ideas; mention the Nutrition tab for plans and shopping lists.
- De-emphasize generic wellness unless the user asks.`;
  }
  if (mode === 'wellness') {
    return `## Coaching mode: wellness
- Prioritize habits, sleep, stress, mobility, activity balance, and sustainable progress.
- Use health/progress tools (\`get_health_metrics\`, \`get_progress_summary\`) when relevant.
- Give evidence-informed lifestyle tips; avoid prescribing medical treatment.
- Mention meal/nutrition tools only when the user asks about food or macros.
- Use \`get_daily_check_in\` for sleep, hydration, and mood questions.`;
  }
  return `## Coaching mode: balanced
- Blend health metrics, progress, nutrition, and general wellness as the question requires.
- Do not over-index on one domain unless the user does.
- Stay on-topic: never append a goals/wellness recap after a narrow factual answer.`;
}
