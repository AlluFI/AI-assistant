/** Form state and API mapping for PATCH /api/profile (matches ProfileUpdateDto). */

export type HealthProfileFormState = {
  age: string
  gender: string
  heightCm: string
  startingWeightKg: string
  weightKg: string
  targetWeightKg: string
  occupationType: string
  activityLevel: string
  dietaryPreferences: string[]
  dietaryRestrictions: string[]
  fitnessGoalPrimary: string
  desiredActivityLevel: string
  weeklyActivityDays: string
  exerciseTypes: string[]
  sessionDurationBand: string
  fitnessSelfLevel: string
  exerciseEnvironment: string
  exerciseTimeOfDay: string
  enduranceMinutes: string
  pushupsMax: string
  squatsMax: string
}

export const GENDER_OPTIONS = [
  { value: '', label: '—' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_say', label: 'Prefer not to say' },
  { value: 'other', label: 'Other' },
] as const

export const ACTIVITY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
] as const

export const FITNESS_GOAL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'weight_loss', label: 'Weight loss' },
  { value: 'muscle_gain', label: 'Muscle gain' },
  { value: 'general_fitness', label: 'General fitness' },
  { value: 'maintenance', label: 'Maintenance' },
] as const

export const SESSION_DURATION_OPTIONS = [
  { value: '', label: '—' },
  { value: '15_30', label: '15–30 min' },
  { value: '30_60', label: '30–60 min' },
  { value: '60_plus', label: '60+ min' },
] as const

export const FITNESS_LEVEL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const

export const EXERCISE_ENV_OPTIONS = [
  { value: '', label: '—' },
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
  { value: 'outdoors', label: 'Outdoors' },
  { value: 'mixed', label: 'Mixed' },
] as const

export const EXERCISE_TIME_OPTIONS = [
  { value: '', label: '—' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'varies', label: 'Varies' },
] as const

export const EXERCISE_TYPE_OPTIONS = [
  { value: 'cardio', label: 'Cardio' },
  { value: 'strength', label: 'Strength' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'sports', label: 'Sports' },
] as const

export const DIETARY_PREFERENCE_OPTIONS = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'high_protein', label: 'High protein' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'dash', label: 'DASH' },
  { value: 'whole30', label: 'Whole30' },
  { value: 'low_fat', label: 'Low fat' },
  { value: 'high_fiber', label: 'High fiber' },
  { value: 'flexitarian', label: 'Flexitarian' },
  { value: 'raw_food', label: 'Raw food' },
  { value: 'diabetic_friendly', label: 'Diabetic friendly' },
] as const

export const DIETARY_RESTRICTION_OPTIONS = [
  { value: 'dairy_free', label: 'Dairy-free' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'nut_free', label: 'Nut-free' },
  { value: 'soy_free', label: 'Soy-free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'egg_free', label: 'Egg-free' },
  { value: 'shellfish_free', label: 'Shellfish-free' },
  { value: 'fish_free', label: 'Fish-free' },
  { value: 'sesame_free', label: 'Sesame-free' },
  { value: 'lactose_intolerant', label: 'Lactose intolerant' },
  { value: 'fodmap_low', label: 'Low FODMAP' },
] as const

export function emptyProfileForm(): HealthProfileFormState {
  return {
    age: '',
    gender: '',
    heightCm: '',
    startingWeightKg: '',
    weightKg: '',
    targetWeightKg: '',
    occupationType: '',
    activityLevel: '',
    dietaryPreferences: [],
    dietaryRestrictions: [],
    fitnessGoalPrimary: '',
    desiredActivityLevel: '',
    weeklyActivityDays: '',
    exerciseTypes: [],
    sessionDurationBand: '',
    fitnessSelfLevel: '',
    exerciseEnvironment: '',
    exerciseTimeOfDay: '',
    enduranceMinutes: '',
    pushupsMax: '',
    squatsMax: '',
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function strField(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string') return v
  return ''
}

export type ProfileApiMeta = {
  startingWeightKg?: number | null
  hasStartingWeight?: boolean
}

export function profileFromApi(
  profile: Record<string, unknown> | null | undefined,
  meta?: ProfileApiMeta,
): HealthProfileFormState {
  const p = profile ?? {}
  const starting =
    meta?.startingWeightKg != null
      ? strField(meta.startingWeightKg)
      : meta?.hasStartingWeight
        ? ''
        : strField(p.weightKg)
  return {
    age: strField(p.age),
    gender: strField(p.gender),
    heightCm: strField(p.heightCm),
    startingWeightKg: starting,
    weightKg: strField(p.weightKg),
    targetWeightKg: strField(p.targetWeightKg),
    occupationType: strField(p.occupationType),
    activityLevel: strField(p.activityLevel),
    dietaryPreferences: asStringArray(p.dietaryPreferences),
    dietaryRestrictions: asStringArray(p.dietaryRestrictions),
    fitnessGoalPrimary: strField(p.fitnessGoalPrimary),
    desiredActivityLevel: strField(p.desiredActivityLevel),
    weeklyActivityDays: strField(p.weeklyActivityDays),
    exerciseTypes: asStringArray(p.exerciseTypes),
    sessionDurationBand: strField(p.sessionDurationBand),
    fitnessSelfLevel: strField(p.fitnessSelfLevel),
    exerciseEnvironment: strField(p.exerciseEnvironment),
    exerciseTimeOfDay: strField(p.exerciseTimeOfDay),
    enduranceMinutes: strField(p.enduranceMinutes),
    pushupsMax: strField(p.pushupsMax),
    squatsMax: strField(p.squatsMax),
  }
}

function parseIntField(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

function parseOptionalString(s: string): string | undefined {
  const t = s.trim()
  return t ? t : undefined
}

function toggleInList(list: string[], value: string, checked: boolean): string[] {
  if (checked) return list.includes(value) ? list : [...list, value]
  return list.filter((v) => v !== value)
}

export function toggleProfileList(
  state: HealthProfileFormState,
  key: 'exerciseTypes' | 'dietaryPreferences' | 'dietaryRestrictions',
  value: string,
  checked: boolean,
): HealthProfileFormState {
  return {
    ...state,
    [key]: toggleInList(state[key], value, checked),
  }
}

/** Build PATCH body; omits empty optional fields. */
export function profileToPayload(
  state: HealthProfileFormState,
  options?: { includeStartingWeight?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  const age = parseIntField(state.age)
  if (age !== undefined) payload.age = age

  const gender = parseOptionalString(state.gender)
  if (gender) payload.gender = gender

  const heightCm = parseIntField(state.heightCm)
  if (heightCm !== undefined) payload.heightCm = heightCm

  if (options?.includeStartingWeight) {
    const startingWeightKg = parseFloat(state.startingWeightKg.trim())
    if (Number.isFinite(startingWeightKg)) payload.startingWeightKg = startingWeightKg
  }

  const weightKg = parseFloat(state.weightKg.trim())
  if (Number.isFinite(weightKg)) payload.weightKg = weightKg

  const targetWeightKg = parseFloat(state.targetWeightKg.trim())
  if (Number.isFinite(targetWeightKg)) payload.targetWeightKg = targetWeightKg

  const occupationType = parseOptionalString(state.occupationType)
  if (occupationType) payload.occupationType = occupationType

  const activityLevel = parseOptionalString(state.activityLevel)
  if (activityLevel) payload.activityLevel = activityLevel

  if (state.dietaryPreferences.length) payload.dietaryPreferences = state.dietaryPreferences
  if (state.dietaryRestrictions.length) payload.dietaryRestrictions = state.dietaryRestrictions

  const fitnessGoalPrimary = parseOptionalString(state.fitnessGoalPrimary)
  if (fitnessGoalPrimary) payload.fitnessGoalPrimary = fitnessGoalPrimary

  const desiredActivityLevel = parseOptionalString(state.desiredActivityLevel)
  if (desiredActivityLevel) payload.desiredActivityLevel = desiredActivityLevel

  const weeklyActivityDays = parseIntField(state.weeklyActivityDays)
  if (weeklyActivityDays !== undefined) payload.weeklyActivityDays = weeklyActivityDays

  if (state.exerciseTypes.length) payload.exerciseTypes = state.exerciseTypes

  const sessionDurationBand = parseOptionalString(state.sessionDurationBand)
  if (sessionDurationBand) payload.sessionDurationBand = sessionDurationBand

  const fitnessSelfLevel = parseOptionalString(state.fitnessSelfLevel)
  if (fitnessSelfLevel) payload.fitnessSelfLevel = fitnessSelfLevel

  const exerciseEnvironment = parseOptionalString(state.exerciseEnvironment)
  if (exerciseEnvironment) payload.exerciseEnvironment = exerciseEnvironment

  const exerciseTimeOfDay = parseOptionalString(state.exerciseTimeOfDay)
  if (exerciseTimeOfDay) payload.exerciseTimeOfDay = exerciseTimeOfDay

  const enduranceMinutes = parseIntField(state.enduranceMinutes)
  if (enduranceMinutes !== undefined) payload.enduranceMinutes = enduranceMinutes

  const pushupsMax = parseIntField(state.pushupsMax)
  if (pushupsMax !== undefined) payload.pushupsMax = pushupsMax

  const squatsMax = parseIntField(state.squatsMax)
  if (squatsMax !== undefined) payload.squatsMax = squatsMax

  return payload
}
