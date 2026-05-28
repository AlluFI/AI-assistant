export type ActivityTypeOption = { code: string; label: string }

/** Mirrors API GET /profile/activities/catalog (used as fallback). */
export const ACTIVITY_TYPES: ActivityTypeOption[] = [
  { code: 'running', label: 'Running' },
  { code: 'walking', label: 'Walking' },
  { code: 'cycling', label: 'Cycling' },
  { code: 'swimming', label: 'Swimming' },
  { code: 'strength', label: 'Strength training' },
  { code: 'yoga', label: 'Yoga' },
  { code: 'pilates', label: 'Pilates' },
  { code: 'hiit', label: 'HIIT' },
  { code: 'football', label: 'Football' },
  { code: 'basketball', label: 'Basketball' },
  { code: 'tennis', label: 'Tennis' },
  { code: 'hiking', label: 'Hiking' },
  { code: 'dance', label: 'Dance' },
  { code: 'rowing', label: 'Rowing' },
  { code: 'elliptical', label: 'Elliptical' },
  { code: 'stretching', label: 'Stretching' },
  { code: 'martial_arts', label: 'Martial arts' },
  { code: 'cross_training', label: 'Cross-training' },
  { code: 'climbing', label: 'Climbing' },
  { code: 'other', label: 'Other' },
]

export function activityLabel(code: string, catalog = ACTIVITY_TYPES): string {
  return catalog.find((a) => a.code === code)?.label ?? code
}
