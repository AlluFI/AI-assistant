export function pickGroundedRecipeId(
  responseRecipeId: string | undefined,
  allowedIds: string[],
): string | undefined {
  if (!allowedIds.length) return undefined;
  const allowed = new Set(allowedIds);
  if (responseRecipeId && allowed.has(responseRecipeId)) {
    return responseRecipeId;
  }
  return allowedIds[0];
}

export function pickRetrievedRecipeForVariety(
  retrieved: Array<{ id: string; title: string }>,
  usedIds: Set<string>,
) {
  if (!retrieved.length) return undefined;
  return retrieved.find((r) => !usedIds.has(r.id)) ?? retrieved[0];
}
