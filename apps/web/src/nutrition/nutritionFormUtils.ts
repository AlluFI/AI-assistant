const MEAL_TIME_DEFAULTS: Record<string, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '19:00',
  snack: '15:00',
}

export function isoToMealTimeInput(iso: unknown, mealType: string): string {
  if (typeof iso !== 'string' || !iso.trim()) {
    return MEAL_TIME_DEFAULTS[mealType] ?? '12:00'
  }
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return MEAL_TIME_DEFAULTS[mealType] ?? '12:00'
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  } catch {
    return MEAL_TIME_DEFAULTS[mealType] ?? '12:00'
  }
}

export function mealTimeInputToIso(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(':')
  const h = Math.min(23, Math.max(0, Number(hRaw) || 0))
  const m = Math.min(59, Math.max(0, Number(mRaw) || 0))
  const d = new Date()
  d.setUTCHours(h, m, 0, 0)
  return d.toISOString()
}

export function parsePreferredMealTimes(
  raw: unknown,
): Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    breakfast: isoToMealTimeInput(obj.breakfast, 'breakfast'),
    lunch: isoToMealTimeInput(obj.lunch, 'lunch'),
    dinner: isoToMealTimeInput(obj.dinner, 'dinner'),
    snack: isoToMealTimeInput(obj.snack, 'snack'),
  }
}

export function buildPreferredMealTimesPayload(times: Record<string, string>) {
  return {
    breakfast: mealTimeInputToIso(times.breakfast ?? MEAL_TIME_DEFAULTS.breakfast),
    lunch: mealTimeInputToIso(times.lunch ?? MEAL_TIME_DEFAULTS.lunch),
    dinner: mealTimeInputToIso(times.dinner ?? MEAL_TIME_DEFAULTS.dinner),
    snack: mealTimeInputToIso(times.snack ?? MEAL_TIME_DEFAULTS.snack),
  }
}
