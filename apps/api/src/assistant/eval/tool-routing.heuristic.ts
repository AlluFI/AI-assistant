import { inferChartToolCall } from '../chart-ui-blocks.util';
import {
  parseLogActivityIntent,
  parseLogWeightIntent,
  parseRegenerateMealIntent,
  parseShoppingListIntent,
} from '../wingman-intent';

/** Offline routing hints for eval — not a substitute for the live LLM. */
export function inferExpectedTools(message: string): string[] {
  const lower = message.toLowerCase();
  const tools: string[] = [];

  if (/\bbmi\b/i.test(lower) || /health metric/i.test(lower)) {
    tools.push('get_health_metrics');
  }
  if (/weight goal|progress|how close/i.test(lower)) {
    tools.push('get_progress_summary');
  }
  if (/meal plan.*week|week'?s meal plan|plan for the week|meals for the week/i.test(lower)) {
    tools.push('get_meal_plan');
  } else if (/meal plan|what's for|whats for|lunch today|dinner today/i.test(lower)) {
    tools.push('get_meal_plan');
  }
  if (/calorie|protein target|macro|consumed today/i.test(lower)) {
    tools.push('get_nutrition_summary');
  }
  if (/search|find.*recipe/i.test(lower)) {
    tools.push('search_recipes');
  }
  if (/recipe details|how do i prepare|how to prepare|prepare tonight|prepare tomorrow|ingredients for/i.test(lower)) {
    tools.push('get_meal_plan', 'get_recipe');
  }
  const chart = inferChartToolCall(message);
  if (chart) tools.push('get_chart_data');
  if (/weight trend|weight change/i.test(lower) && !chart) {
    tools.push('get_health_metrics');
  }

  return [...new Set(tools)];
}

export function inferExpectedIntent(
  message: string,
): 'log_activity' | 'log_weight' | 'regenerate_meal' | 'shopping_list' | null {
  if (parseLogActivityIntent(message)) return 'log_activity';
  if (parseLogWeightIntent(message)) return 'log_weight';
  if (parseRegenerateMealIntent(message)) return 'regenerate_meal';
  if (parseShoppingListIntent(message)) return 'shopping_list';
  return null;
}
