const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type WeekMealPlanDay = {
  dayIndex: number;
  date: string;
  weekday?: string;
  meals: Array<{
    mealType: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fats: number | null;
  }>;
  totalPlannedCalories: number;
};

export type WeekMealPlanToolResult = {
  scope: 'week';
  startDate: string;
  endDate: string;
  dayCount?: number;
  days: WeekMealPlanDay[];
  error?: string;
  message?: string;
};

export function weekdayForDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return WEEKDAYS[d.getUTCDay()] ?? '';
}

export function weekMealPlanFromTraces(
  traceResults: Array<{ name: string; result: unknown }>,
): WeekMealPlanToolResult | null {
  const trace = traceResults.find((t) => t.name === 'get_meal_plan');
  if (!trace) return null;
  const result = trace.result as WeekMealPlanToolResult;
  if (result?.scope !== 'week' || result.error) return null;
  if (!Array.isArray(result.days) || result.days.length === 0) return null;
  return result;
}

function mealEmoji(mealType: string): string {
  switch (mealType) {
    case 'breakfast':
      return '🍳';
    case 'lunch':
      return '🥗';
    case 'dinner':
      return '🍛';
    case 'snack':
      return '🥜';
    default:
      return '🍽️';
  }
}

function formatMacro(n: number | null): string {
  return n != null ? `${Math.round(n)}g` : '—';
}

function weeklyProteinNote(days: WeekMealPlanDay[]): string | null {
  let totalProtein = 0;
  let daysWithMeals = 0;
  for (const day of days) {
    if (!day.meals.length) continue;
    daysWithMeals += 1;
    totalProtein += day.meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  }
  if (daysWithMeals === 0) return null;
  const avg = Math.round(totalProtein / daysWithMeals);
  if (avg < 130) {
    return `At ~**${avg}g protein/day** from meals alone, you may be short of a high-protein target (~130–150g). A protein-rich snack on training days can help.`;
  }
  return null;
}

/** Deterministic markdown for all 7 plan days — avoids LLM truncating the last day. */
export function formatWeeklyMealPlanMarkdown(plan: WeekMealPlanToolResult): string {
  const dayCount = plan.dayCount ?? plan.days.length;
  const lines: string[] = [
    `Here is your meal plan for **${plan.startDate}** through **${plan.endDate}** (${dayCount} days):`,
    '',
  ];

  for (const day of plan.days) {
    const weekday = day.weekday ?? weekdayForDate(day.date);
    lines.push(`### ${weekday} ${day.date}`);
    if (!day.meals.length) {
      lines.push('_No meals planned for this day._');
      lines.push('');
      continue;
    }
    lines.push('| Meal | Title | Protein | Carbs | Fats | Kcal |');
    lines.push('|------|-------|---------|-------|------|------|');
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFats = 0;
    for (const meal of day.meals) {
      dayProtein += meal.protein ?? 0;
      dayCarbs += meal.carbs ?? 0;
      dayFats += meal.fats ?? 0;
      const label = meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1);
      lines.push(
        `| ${mealEmoji(meal.mealType)} **${label}** | ${meal.title} | ${formatMacro(meal.protein)} | ${formatMacro(meal.carbs)} | ${formatMacro(meal.fats)} | ${meal.calories ?? '—'} |`,
      );
    }
    lines.push(
      `| **Daily total** | | **${Math.round(dayProtein)}g** | **${Math.round(dayCarbs)}g** | **${Math.round(dayFats)}g** | **${Math.round(day.totalPlannedCalories).toLocaleString()}** |`,
    );
    lines.push('');
  }

  const proteinNote = weeklyProteinNote(plan.days);
  if (proteinNote) {
    lines.push(proteinNote);
  }

  return lines.join('\n').trim();
}

/** Use server-formatted week listing; keep a short LLM add-on when it is not a duplicate listing. */
export function mergeWeeklyMealPlanReply(
  llmContent: string,
  plan: WeekMealPlanToolResult,
): string {
  const formatted = formatWeeklyMealPlanMarkdown(plan);
  const trimmed = llmContent.trim();
  if (!trimmed) return formatted;

  const looksLikeListing =
    (trimmed.match(/\|/g)?.length ?? 0) >= 6 ||
    (trimmed.match(/breakfast|lunch|dinner/gi)?.length ?? 0) >= 4;
  if (looksLikeListing) return formatted;

  return `${formatted}\n\n${trimmed}`;
}
