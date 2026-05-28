/** Canonical dietary options (≥15 preferences, ≥10 restrictions). */

export const DIETARY_PREFERENCE_VALUES = [
  'balanced',
  'vegetarian',
  'vegan',
  'pescatarian',
  'high_protein',
  'low_carb',
  'keto',
  'paleo',
  'mediterranean',
  'dash',
  'whole30',
  'low_fat',
  'high_fiber',
  'flexitarian',
  'raw_food',
  'diabetic_friendly',
] as const;

export const DIETARY_RESTRICTION_VALUES = [
  'dairy_free',
  'gluten_free',
  'nut_free',
  'soy_free',
  'halal',
  'kosher',
  'egg_free',
  'shellfish_free',
  'fish_free',
  'sesame_free',
  'lactose_intolerant',
  'fodmap_low',
] as const;

export const CUISINE_VALUES = [
  'Italian',
  'Mexican',
  'Indian',
  'Chinese',
  'Japanese',
  'Thai',
  'Mediterranean',
  'American',
  'French',
  'Middle Eastern',
  'Korean',
  'Vietnamese',
] as const;

export const SHOPPING_CATEGORIES = [
  'produce',
  'dairy',
  'protein',
  'grains',
  'pantry',
  'frozen',
  'beverages',
  'other',
] as const;

export type DietaryPreference = (typeof DIETARY_PREFERENCE_VALUES)[number];
export type DietaryRestriction = (typeof DIETARY_RESTRICTION_VALUES)[number];

export function isDietaryPreference(v: string): v is DietaryPreference {
  return (DIETARY_PREFERENCE_VALUES as readonly string[]).includes(v);
}

export function isDietaryRestriction(v: string): v is DietaryRestriction {
  return (DIETARY_RESTRICTION_VALUES as readonly string[]).includes(v);
}
