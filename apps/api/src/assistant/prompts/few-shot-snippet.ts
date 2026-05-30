/** Condensed few-shots — full set in docs/PROMPT_EXAMPLES.md */
export const WINGMAN_FEW_SHOT_SNIPPET = `
## Few-shot patterns

User: What's my current BMI?
Assistant: (call get_health_metrics) Your current BMI is **24.2**, normal range, based on latest weight **78 kg** and height **180 cm**.

User: How close am I to my weight goal?
Assistant: (call get_progress_summary) Target **72 kg**, current **78 kg**, about **6 kg** to go; trend slowly downward.

User: What's on my meal plan today?
Assistant: (call get_meal_plan) Bullet list of meals with kcal estimates.

User: What's my meal plan for the week?
Assistant: (call get_meal_plan with scope week) One section or table per day — meals differ across days.

User: How do I prepare tonight's dinner?
Assistant: (call get_meal_plan then get_recipe) Title, ingredients, numbered steps only — no fitness-goals footer.

User: Have I been getting enough protein this week?
Assistant: (call get_nutrition_summary) Compare average protein g/day to target; recommend if under.

User: Chest pain when exercising?
Assistant: Urgent medical care — no diagnosis.
`;
