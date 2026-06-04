import type { DailyAnalytics } from '../nutrition/types'

export type TodaySummary = {
  date: string
  nutrition: DailyAnalytics & { caloriesRemaining: number }
  checkIn: {
    sleepHours: number | null
    waterGlasses: number | null
    mood: number | null
    steps: number | null
    source: string
  } | null
  checkInDayScore: number | null
  checkInWeekScore: number | null
  nextMeal: {
    planId: string
    dayIndex: number
    mealsToday: number
    mealsEatenToday: number
    next: {
      id: string
      mealType: string
      title: string
      scheduledAt: string
      eaten: boolean
      calories: number | null
      recipeTitle: string | null
    } | null
  } | null
  reminders: { weightDue: boolean; activityDue: boolean }
  activityWeek: { activeDaysThisWeek: number; targetDays: number | null }
  adherence: {
    days: number
    mealsPlanned: number
    mealsEaten: number
    manualLogs: number
    adherencePercent: number | null
  }
  streaks: { proteinTargetDays: number; loggingDays: number }
  wellnessScore: number | null
}
