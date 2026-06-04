export type WingmanChartType =
  | 'weight_trend'
  | 'calorie_trend'
  | 'protein_vs_target'
  | 'macro_breakdown'

export type WingmanChartBlock = {
  type: 'chart'
  chart: WingmanChartType
  title: string
  data: unknown
}

export type WingmanUiBlock =
  | WingmanChartBlock
  | {
      type: 'cta'
      label: string
      action:
        | 'confirm_log_activity'
        | 'confirm_log_weight'
        | 'confirm_regenerate_meal'
        | 'confirm_generate_shopping_list'
        | 'confirm_mark_meal_eaten'
        | 'confirm_generate_meal_plan'
        | 'confirm_onboarding_skip'
        | 'confirm_onboarding_ai_targets'
        | 'confirm_onboarding_formula_targets'
        | 'confirm_onboarding_meal_defaults'
        | 'open_record'
        | 'open_nutrition'
        | 'open_insights'
      payload?: Record<string, unknown>
    }
  | {
      type: 'hint'
      text: string
    }

export type WingmanMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  uiBlocks?: WingmanUiBlock[]
  createdAt?: string
}

export type WingmanNudges = {
  lines: string[]
  uiBlocks?: WingmanUiBlock[]
}

export type WingmanCoachingMode = 'balanced' | 'nutrition' | 'wellness' | 'onboarding'

export type WingmanOnboardingStepId =
  | 'health_basics'
  | 'nutrition_targets'
  | 'meal_schedule'
  | 'complete'

export type WingmanOnboardingStatus = {
  active: boolean
  step: WingmanOnboardingStepId
  steps: Array<{ id: WingmanOnboardingStepId; label: string; done: boolean }>
  percentComplete: number
  opener: { content: string; uiBlocks?: WingmanUiBlock[] }
}

export const WINGMAN_STARTER_PROMPTS: Record<
  Exclude<WingmanCoachingMode, 'onboarding'>,
  readonly string[]
> = {
  balanced: [
    "What's my current BMI?",
    "What's on my meal plan today?",
    'Show my weight trend for the last month',
    'How many calories have I consumed today?',
  ],
  nutrition: [
    "What's on my meal plan today?",
    'Find high-protein dinner recipes',
    'Am I meeting my protein target?',
    'Create a shopping list from my plan',
    'Mark dinner as eaten',
    'Generate a weekly meal plan',
  ],
  wellness: [
    'How close am I to my weight goal?',
    'How can I improve my sleep habits?',
    'What stretches help lower back tension?',
    'Record 30 minutes walking for today',
  ],
}
