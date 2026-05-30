/** User asked for the full weekly meal plan, not a single day. */
export function inferMealPlanWeekScope(message: string): boolean {
  return /meal plan.*(this |the |whole |entire )?week|week'?s meal plan|plan for the week|meals for the week|all 7 days|seven days|full week/i.test(
    message.toLowerCase(),
  );
}

export function normalizeMealPlanToolArgs(
  userMessage: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (args.scope === 'week') return args;
  if (inferMealPlanWeekScope(userMessage)) {
    return { ...args, scope: 'week' };
  }
  return args;
}
