import type { ReactNode } from 'react'
import './dashboard.css'
import { BmiSpectrum } from './BmiSpectrum'
import { ComparisonPanel } from './ComparisonPanel'
import { GoalTracker } from './GoalTracker'
import { InsightsHighlight } from './InsightsHighlight'
import { ProgressChartsPanel } from './ProgressChartsPanel'
import { WellnessGauge } from './WellnessGauge'
import { NutritionDailyCompact } from '../nutrition/NutritionDailyCompact'
import type { DailyAnalytics, TrendPoint, WeeklyAnalytics } from '../nutrition/types'
import type { SummaryComponents } from './dashboardUtils'
import { weightProgressPct } from './dashboardUtils'

type Point = {
  t: string
  weightKg?: number | null
  wellnessScore?: number | null
  bmi?: number | null
  isBaseline?: boolean
}
type ActivityPoint = {
  t: string
  weeklyActivityDays: number | null
  isBaseline?: boolean
}

type Summary = {
  wellnessScore?: number
  bmi?: number | null
  bmiClassification?: string | null
  components?: SummaryComponents | null
}

export type HealthOverviewProps = {
  busy: boolean
  loadError: string | null
  summary: Summary | null
  progressSummary: {
    weekly: { weightDeltaKg: number | null; wellnessDelta: number | null; entries: number }
    monthly: { weightDeltaKg: number | null; wellnessDelta: number | null; entries: number }
  } | null
  chartDays: number
  onChartDaysChange: (days: number) => void
  weightSeries: Point[]
  wellnessSeries: Point[]
  activitySeries: ActivityPoint[]
  insights: Array<Record<string, unknown>>
  targetWeightKg: number | null
  desiredActivityTargetDays: number | null
  fitnessGoalPrimary: string | null
  onViewInsights: () => void
  onViewNutrition?: () => void
  quickActions?: ReactNode
  nutritionDaily?: DailyAnalytics | null
  nutritionTrend?: TrendPoint[]
  nutritionWeekly?: WeeklyAnalytics | null
  nutritionInsightPreview?: string | null
}

export function HealthOverview({
  busy,
  loadError,
  summary,
  progressSummary,
  chartDays,
  onChartDaysChange,
  weightSeries,
  wellnessSeries,
  activitySeries,
  insights,
  targetWeightKg,
  desiredActivityTargetDays,
  fitnessGoalPrimary,
  onViewInsights,
  onViewNutrition,
  quickActions,
  nutritionDaily = null,
  nutritionTrend = [],
  nutritionWeekly = null,
  nutritionInsightPreview = null,
}: HealthOverviewProps) {
  const startingWeight =
    (weightSeries.find((p) => p.isBaseline) ?? weightSeries[0])?.weightKg ?? null
  const latestWeight = weightSeries.length
    ? (weightSeries[weightSeries.length - 1]?.weightKg ?? null)
    : null
  const latestWellness = wellnessSeries.length
    ? (wellnessSeries[wellnessSeries.length - 1]?.wellnessScore ?? null)
    : (summary?.wellnessScore ?? null)
  const latestBmi = wellnessSeries.length
    ? (wellnessSeries[wellnessSeries.length - 1]?.bmi ?? null)
    : (summary?.bmi != null ? Number(summary.bmi) : null)
  const latestActivityDays = activitySeries.length
    ? (activitySeries[activitySeries.length - 1]?.weeklyActivityDays ?? null)
    : null

  const weightPct = weightProgressPct(
    latestWeight,
    startingWeight,
    targetWeightKg,
    fitnessGoalPrimary,
  )
  const activityPct =
    latestActivityDays != null &&
    desiredActivityTargetDays != null &&
    desiredActivityTargetDays > 0
      ? Math.min(100, Math.round((latestActivityDays / desiredActivityTargetDays) * 100))
      : null

  return (
    <div className="dashboardGrid healthOverview">
      {quickActions ?? null}

      {loadError ? <p className="err vizError">{loadError}</p> : null}

      <section className="card cardSpan2 healthDashboard">
        <h2>Health dashboard</h2>
        {busy && !summary ? (
          <p className="hint loadingPulse">Loading your health snapshot…</p>
        ) : null}
        <div className="healthDashboardGrid">
          <BmiSpectrum
            bmi={summary?.bmi != null ? Number(summary.bmi) : null}
            classification={summary?.bmiClassification ?? null}
          />
          <WellnessGauge score={summary?.wellnessScore ?? null} components={summary?.components ?? null} />
        </div>
        <GoalTracker
          wellnessScore={summary?.wellnessScore ?? null}
          currentWeight={latestWeight}
          startingWeight={startingWeight}
          targetWeightKg={targetWeightKg}
          fitnessGoalPrimary={fitnessGoalPrimary}
          currentActivityDays={latestActivityDays}
          targetActivityDays={desiredActivityTargetDays}
          weightSeries={weightSeries}
        />
        <NutritionDailyCompact
          daily={nutritionDaily}
          busy={busy}
          onViewNutrition={onViewNutrition}
        />
        <InsightsHighlight
          insights={insights}
          nutritionPreview={nutritionInsightPreview}
          bmiClass={summary?.bmiClassification ?? null}
          wellnessScore={summary?.wellnessScore ?? null}
          weeklyDays={latestActivityDays}
          targetDays={desiredActivityTargetDays}
          onViewAll={onViewInsights}
        />
      </section>

      <ComparisonPanel
        currentWeight={latestWeight}
        targetWeightKg={targetWeightKg}
        currentActivityDays={latestActivityDays}
        targetActivityDays={desiredActivityTargetDays}
        wellnessScore={summary?.wellnessScore ?? null}
        weightProgressPct={weightPct}
        activityProgressPct={activityPct}
        progressSummary={progressSummary}
      />

      <ProgressChartsPanel
        busy={busy}
        chartDays={chartDays}
        onChartDaysChange={onChartDaysChange}
        weightSeries={weightSeries}
        wellnessSeries={wellnessSeries}
        activitySeries={activitySeries}
        startingWeight={startingWeight}
        latestWeight={latestWeight}
        latestWellness={latestWellness}
        latestBmi={latestBmi}
        latestActivityDays={latestActivityDays}
        targetWeightKg={targetWeightKg}
        desiredActivityTargetDays={desiredActivityTargetDays}
        fitnessGoalPrimary={fitnessGoalPrimary}
        progressSummary={progressSummary}
        nutritionTrend={nutritionTrend}
        nutritionWeekly={nutritionWeekly}
        onViewNutrition={onViewNutrition}
      />
    </div>
  )
}
