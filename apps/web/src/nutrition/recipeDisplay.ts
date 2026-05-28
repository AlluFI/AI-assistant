export function formatDietaryTags(tags: unknown): string {
  if (!Array.isArray(tags)) return ''
  return tags
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .join(', ')
}

/** Normalize recipe preparation steps from API (string or seeded object shape). */
export function formatPreparationStep(step: unknown, idx: number): string {
  if (typeof step === 'string') return step
  if (step && typeof step === 'object') {
    const s = step as { step?: string; description?: string }
    const head = s.step?.trim() || `Step ${idx + 1}`
    const body = s.description?.trim()
    return body ? `${head}: ${body}` : head
  }
  return String(step)
}
