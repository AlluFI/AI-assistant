export type AssistantChartType =
  | 'weight_trend'
  | 'calorie_trend'
  | 'protein_vs_target'
  | 'macro_breakdown';

export type AssistantUiBlock =
  | {
      type: 'chart';
      chart: AssistantChartType;
      title: string;
      data: unknown;
    }
  | {
      type: 'cta';
      label: string;
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
        | 'open_insights';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'hint';
      text: string;
    };

export type AssistantChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  uiBlocks?: AssistantUiBlock[];
  createdAt: string;
};
