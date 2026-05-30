import { devToolsEnabled } from '../devTools'
import { NutritionTrendCompact } from '../nutrition/NutritionTrendCompact'
import type { TrendPoint, WeeklyAnalytics } from '../nutrition/types'
import { UnifiedProgressChart } from './UnifiedProgressChart'
import { mergeMetricSeries } from './dashboardUtils'

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

type Props = {
  busy: boolean
  chartDays: number
  onChartDaysChange: (days: number) => void
  weightSeries: Point[]
  wellnessSeries: Point[]
  activitySeries: ActivityPoint[]
  startingWeight: number | null
  latestWeight: number | null
  latestWellness: number | null
  latestBmi: number | null
  latestActivityDays: number | null
  targetWeightKg: number | null
  desiredActivityTargetDays: number | null
  fitnessGoalPrimary: string | null
  progressSummary: {
    weekly: { weightDeltaKg: number | null; wellnessDelta: number | null; entries: number }
    monthly: { weightDeltaKg: number | null; wellnessDelta: number | null; entries: number }
  } | null
  nutritionTrend?: TrendPoint[]
  nutritionWeekly?: WeeklyAnalytics | null
  onViewNutrition?: () => void
}

const CHART_RANGES = [30, 90, 180, 365] as const

export function ProgressChartsPanel({
  busy,
  chartDays,
  onChartDaysChange,
  weightSeries,
  wellnessSeries,
  activitySeries,
  startingWeight,
  latestWeight,
  latestWellness,
  latestBmi,
  latestActivityDays,
  targetWeightKg,
  desiredActivityTargetDays,
  fitnessGoalPrimary,
  progressSummary,
  nutritionTrend = [],
  nutritionWeekly = null,
  onViewNutrition,
}: Props) {
  const combined = mergeMetricSeries(weightSeries, wellnessSeries, activitySeries)
  const baselinePoint = combined.find((p) => p.isBaseline) ?? combined[0] ?? null

  const hasAnyData = combined.length > 0

  return (
    <section className="card cardSpan2 progressChartsPanel">
      <div className="chartPanelHead">
        <h2>Progress</h2>
        <label className="chartRangeLabel">
          Range
          <select
            value={chartDays}
            onChange={(e) => onChartDaysChange(Number(e.target.value))}
            disabled={busy}
          >
            {CHART_RANGES.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {busy && !hasAnyData ? (
        <p className="hint loadingPulse">Loading chart data…</p>
      ) : null}
      {!busy && !hasAnyData ? (
        <p className="hint vizEmpty">
          Save your health profile
          {devToolsEnabled ? ' or use "Load demo overview" to populate the chart' : ''}.
        </p>
      ) : null}

      {progressSummary ? (
        <div className="statsGrid">
          <div className="statCard">
            <p className="statLabel">Weekly change</p>
            <p className="statValue">
              {progressSummary.weekly.weightDeltaKg != null
                ? `${progressSummary.weekly.weightDeltaKg > 0 ? '+' : ''}${progressSummary.weekly.weightDeltaKg} kg`
                : '-'}
            </p>
            <p className="hint">
              Wellness Δ: {progressSummary.weekly.wellnessDelta ?? '-'} ({progressSummary.weekly.entries}{' '}
              entries)
            </p>
          </div>
          <div className="statCard">
            <p className="statLabel">Monthly change</p>
            <p className="statValue">
              {progressSummary.monthly.weightDeltaKg != null
                ? `${progressSummary.monthly.weightDeltaKg > 0 ? '+' : ''}${progressSummary.monthly.weightDeltaKg} kg`
                : '-'}
            </p>
            <p className="hint">
              Wellness Δ: {progressSummary.monthly.wellnessDelta ?? '-'} ({progressSummary.monthly.entries}{' '}
              entries)
            </p>
          </div>
        </div>
      ) : null}

      {hasAnyData ? (
        <UnifiedProgressChart
          weightSeries={weightSeries}
          wellnessSeries={wellnessSeries}
          activitySeries={activitySeries}
          currentWeight={latestWeight}
          currentWellness={latestWellness}
          currentBmi={latestBmi}
          currentActivityDays={latestActivityDays}
          targetWeightKg={targetWeightKg}
          desiredActivityTargetDays={desiredActivityTargetDays}
          fitnessGoalPrimary={fitnessGoalPrimary}
          startingWeight={startingWeight}
          baselinePoint={baselinePoint}
        />
      ) : null}

      <NutritionTrendCompact
        trend={nutritionTrend}
        weekly={nutritionWeekly}
        busy={busy}
        chartDays={chartDays}
        onViewNutrition={onViewNutrition}
      />
    </section>
  )
}
