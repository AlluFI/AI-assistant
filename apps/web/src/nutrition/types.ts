export type MacroNutrition = {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export type DailyAnalytics = {
  date: string
  target: { calories: number; macros: { protein: number; carbs: number; fats: number } }
  intake: MacroNutrition
  plannedIntake?: MacroNutrition
  mealsEaten?: number
  mealsPlanned?: number
  deficit: number
  surplus: number
  macroPercentOfTarget: { protein: number; carbs: number; fats: number }
  status: 'deficit' | 'surplus' | 'on_track'
}

export type TrendPoint = {
  date: string
  calories: number
  deficit: number
  protein?: number
  carbs?: number
  fats?: number
}

export type NutritionInsights = {
  achievements: string[]
  concerns: string[]
  macroBalance: { protein: string; carbs: string; fats: string }
  suggestions: string[]
  usedFallback: boolean
}

export type PlannedMealRow = {
  id: string
  dayIndex: number
  mealType: string
  scheduledAt: string
  title: string
  recipeId: string | null
  nutrition: MacroNutrition
  alternatives?: Array<{ recipeId: string; title: string }> | null
  sortOrder: number
  eatenAt?: string | null
  recipe?: { id: string; title: string; cuisine: string; timeMinutes: number } | null
}

export type GenerationStepRecord = {
  step: number
  name: string
  prompt?: string
  response?: unknown
}

export type MealPlanVersionDetail = {
  id: string
  versionLabel: string
  versionNumber: number
  isActive: boolean
  preferencesSnapshot?: { calorie_target?: number } | null
  generationSteps?: GenerationStepRecord[] | null
  meals: PlannedMealRow[]
  mealPlan: { id: string; duration: string; startDate: string }
}

export type WeeklyAnalytics = {
  start: string
  end: string
  targetCalories: number
  days: number
  avgCalories: number
  avgDeficit: number
  totalProtein: number
  totalCarbs: number
  totalFats: number
  daily: Array<{ date: string; calories: number; deficit: number }>
}

export type MealPlanListItem = {
  id: string
  duration: string
  startDate: string
  versions?: Array<{
    id: string
    versionLabel: string
    versionNumber: number
    isActive: boolean
  }>
}

export type ShoppingListItem = {
  id: string
  name: string
  category: string
  quantityGrams: number | null
  quantityMl: number | null
  excluded: boolean
  ingredientId: string | null
}

export type ShoppingList = {
  id: string
  title: string | null
  mealPlanVersionId: string | null
  createdAt: string
  updatedAt: string
  items: ShoppingListItem[]
}
