import type { AssistantUiBlock } from './assistant-ui.types';

export type CreateRecipePayload = {
  query: string;
  meal?: string;
  cuisine?: string;
};

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

function normalizeMeal(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const meal = raw.trim().toLowerCase();
  return MEAL_TYPES.has(meal) ? meal : undefined;
}

/** User explicitly asked to save/create a catalog recipe. */
export function userWantsRecipeSaved(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(save|add|create|store|put|generate)\b.*\b(recipe|catalog|database)\b/i.test(
      lower,
    ) ||
    /\b(no match|nothing found|not found|can't find|cannot find|no results)\b.*\b(save|create|add)\b/i.test(
      lower,
    ) ||
    /\b(save|create|add)\b.*\b(custom|new|missing)\b.*\brecipe\b/i.test(lower)
  );
}

export function extractCreateRecipeQuery(text: string): string | null {
  const normalized = text.trim();
  const patterns = [
    /(?:create|save|add|store|generate)\s+(?:a\s+)?(?:new\s+)?recipe\s+(?:for|called|named|:)\s+(.+)/i,
    /(?:add|save)\s+(.+?)\s+to\s+(?:the\s+)?(?:recipe\s+)?(?:catalog|database)/i,
    /(?:create|save)\s+(?:this\s+)?recipe:?\s*(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const captured = match?.[1]?.trim();
    if (captured && captured.length >= 3) {
      return captured.replace(/[.?!]+$/, '').slice(0, 500);
    }
  }
  return null;
}

export function resolveCreateRecipePayload(
  userMessage: string,
  traceResults: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>,
): CreateRecipePayload | null {
  const search = traceResults.find((t) => t.name === 'search_recipes');
  const searchResult = search?.result as { count?: number; query?: string | null };
  const searchArgs = search?.args ?? {};
  const count = searchResult?.count ?? null;

  const explicitQuery = extractCreateRecipeQuery(userMessage);
  const searchQuery =
    typeof searchResult?.query === 'string' && searchResult.query.trim()
      ? searchResult.query.trim()
      : typeof searchArgs.query === 'string'
        ? searchArgs.query.trim()
        : '';

  const query = (explicitQuery || searchQuery || userMessage.trim()).slice(
    0,
    500,
  );
  if (query.length < 3) return null;

  const wantsSave = userWantsRecipeSaved(userMessage);
  const emptySearch = count === 0;
  if (!emptySearch && !wantsSave && !explicitQuery) return null;
  if (!search && !explicitQuery && !wantsSave) return null;

  return {
    query,
    meal: normalizeMeal(searchArgs.meal),
    cuisine:
      typeof searchArgs.cuisine === 'string'
        ? searchArgs.cuisine.trim().slice(0, 80)
        : undefined,
  };
}

export function buildCreateRecipeCta(
  payload: CreateRecipePayload,
): AssistantUiBlock {
  const label = payload.query.slice(0, 48);
  return {
    type: 'cta',
    label: `Confirm: Create & save recipe`,
    action: 'confirm_create_recipe',
    payload: {
      query: payload.query,
      meal: payload.meal,
      cuisine: payload.cuisine,
      previewTitle: label,
    },
  };
}

export function inferCreateRecipeCta(
  userMessage: string,
  traceResults: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>,
): AssistantUiBlock | null {
  const payload = resolveCreateRecipePayload(userMessage, traceResults);
  if (!payload) return null;
  return buildCreateRecipeCta(payload);
}
