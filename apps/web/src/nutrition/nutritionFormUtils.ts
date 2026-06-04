const MEAL_TIME_DEFAULTS: Record<string, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '19:00',
  snack: '15:00',
}

const DEFAULT_SNACK_TIMES = ['15:00', '10:30', '16:30', '21:00']

const MAIN_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const

/** Keys for preferred meal times: breakfast, lunch, dinner, snack, snack_2, … */
export function snackSlotKey(index: number): string {
  return index === 0 ? 'snack' : `snack_${index + 1}`
}

export function preferredMealTimeSlots(snacksPerDay: number): string[] {
  const snacks = Math.min(4, Math.max(0, Math.round(snacksPerDay)))
  const slots: string[] = [...MAIN_MEAL_SLOTS]
  for (let i = 0; i < snacks; i++) {
    slots.push(snackSlotKey(i))
  }
  return slots
}

export function formatMealTimeSlotLabel(slot: string): string {
  if (slot === 'snack') return 'snack'
  const m = /^snack_(\d+)$/.exec(slot)
  if (m) return `snack ${m[1]}`
  return slot.replace(/_/g, ' ')
}

function defaultTimeForSlot(slot: string): string {
  if (slot in MEAL_TIME_DEFAULTS) return MEAL_TIME_DEFAULTS[slot]
  const m = /^snack_(\d+)$/.exec(slot)
  if (slot === 'snack') return DEFAULT_SNACK_TIMES[0]
  if (m) {
    const idx = Number(m[1]) - 1
    return DEFAULT_SNACK_TIMES[idx] ?? '15:00'
  }
  return '12:00'
}

export function isoToMealTimeInput(iso: unknown, mealType: string): string {
  if (typeof iso !== 'string' || !iso.trim()) {
    return defaultTimeForSlot(mealType)
  }
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return defaultTimeForSlot(mealType)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  } catch {
    return defaultTimeForSlot(mealType)
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
  snacksPerDay = 0,
): Record<string, string> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const result: Record<string, string> = {}
  for (const slot of preferredMealTimeSlots(snacksPerDay)) {
    if (slot.startsWith('snack')) {
      const snackIndex =
        slot === 'snack' ? 0 : Math.max(0, Number(slot.replace('snack_', '')) - 1)
      const legacy = snackIndex === 0 ? obj.snack : undefined
      result[slot] = isoToMealTimeInput(obj[slot] ?? legacy, slot)
    } else {
      result[slot] = isoToMealTimeInput(obj[slot], slot)
    }
  }
  return result
}

export function buildPreferredMealTimesPayload(
  times: Record<string, string>,
  snacksPerDay = 0,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slot of preferredMealTimeSlots(snacksPerDay)) {
    const hhmm = times[slot] ?? defaultTimeForSlot(slot)
    out[slot] = mealTimeInputToIso(hhmm)
  }
  return out
}

/** Add default times for newly enabled snack slots without overwriting existing values. */
export function mergeMealTimesForSnackCount(
  prev: Record<string, string>,
  snacksPerDay: number,
): Record<string, string> {
  const defaults = parsePreferredMealTimes({}, snacksPerDay)
  const next = { ...prev }
  let changed = false
  for (const slot of preferredMealTimeSlots(snacksPerDay)) {
    if (!next[slot]?.trim()) {
      next[slot] = defaults[slot]
      changed = true
    }
  }
  return changed ? next : prev
}
