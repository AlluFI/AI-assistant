/** OpenAI-compatible tool definitions for the wingman. */
export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_health_metrics',
      description:
        "Retrieves the user's current health metrics (weight, BMI, wellness score, activity level).",
      parameters: {
        type: 'object',
        properties: {
          metric_type: {
            type: 'string',
            enum: ['bmi', 'weight', 'wellness_score', 'activity', 'all'],
            description: 'Which metric to emphasize',
          },
          time_period: {
            type: 'string',
            enum: ['current', 'weekly', 'monthly'],
            description: 'Time window for trends when relevant',
          },
        },
        required: ['metric_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_progress_summary',
      description:
        'Summarizes progress toward weight/fitness goals and recent weight trend.',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            enum: ['weight', 'wellness', 'goals', 'all'],
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_meal_plan',
      description:
        'Lists planned meals for a calendar date from the active meal plan.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'YYYY-MM-DD; defaults to today',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recipe',
      description:
        'Full recipe details: ingredients, preparation steps, nutrition per serving.',
      parameters: {
        type: 'object',
        properties: {
          recipe_id: {
            type: 'string',
            description: 'Recipe id from meal plan or search',
          },
        },
        required: ['recipe_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_nutrition_summary',
      description: 'Calorie and macro intake vs targets for a day or week.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week'],
          },
          date: {
            type: 'string',
            description: 'YYYY-MM-DD anchor (today or week ending)',
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_recipes',
      description:
        'Search the recipe catalog by keywords, cuisine, meal type, prep time, or macros. Returns ranked matches with nutrition per serving.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search (e.g. high protein chicken)',
          },
          cuisine: { type: 'string' },
          meal: {
            type: 'string',
            description: 'breakfast, lunch, dinner, snack',
          },
          max_prep_minutes: { type: 'number' },
          limit: { type: 'number', description: 'Max results (1–15)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_chart_data',
      description:
        'Structured series for describing or charting trends (weight, calories, protein vs target).',
      parameters: {
        type: 'object',
        properties: {
          chart_type: {
            type: 'string',
            enum: [
              'weight_trend',
              'calorie_trend',
              'protein_vs_target',
              'macro_breakdown',
            ],
          },
          days: {
            type: 'number',
            description: 'Lookback days (7–90)',
          },
        },
        required: ['chart_type'],
      },
    },
  },
];
