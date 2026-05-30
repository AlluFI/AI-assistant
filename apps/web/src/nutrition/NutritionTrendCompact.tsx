import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint, WeeklyAnalytics } from './types'

type Props = {
  trend: TrendPoint[]
  weekly?: WeeklyAnalytics | null
  busy?: boolean
  chartDays?: number
  onViewNutrition?: () => void
}

export function NutritionTrendCompact({
  trend,
  weekly,
  busy,
  chartDays,
  onViewNutrition,
}: Props) {
  const data = trend.map((p) => ({ ...p, label: p.date.slice(5) }))
  const hasTrend = data.length > 0

  return (
    <div className="nutritionTrendCompact nutritionHistoricalBlock">
      <div className="vizBlockHead">
        <h3 className="chartTitle">Historical nutrition</h3>
        {onViewNutrition ? (
          <button type="button" className="secondary" onClick={onViewNutrition}>
            Full charts
          </button>
        ) : null}
      </div>
      <p className="hint">
        Caloric balance from logged meal-plan intake
        {chartDays ? ` (last ${chartDays} days)` : ''}. Positive = below target, negative = above.
      </p>

      {weekly ? (
        <div className="nutritionWeeklySummaryInline">
          <p className="hint">
            <strong>Week {weekly.start} → {weekly.end}:</strong>{' '}
            {weekly.avgCalories} kcal/day avg · target {weekly.targetCalories} kcal/day
            {' · '}
            {weekly.avgDeficit > 0
              ? `${weekly.avgDeficit} kcal below target`
              : weekly.avgDeficit < 0
                ? `${Math.abs(weekly.avgDeficit)} kcal above target`
                : 'on target'}
            {weekly.days > 0
              ? ` · totals P ${Math.round(weekly.totalProtein)}g · C ${Math.round(weekly.totalCarbs)}g · F ${Math.round(weekly.totalFats)}g`
              : ''}
          </p>
        </div>
      ) : null}

      {busy && !hasTrend ? <p className="hint loadingPulse">Loading nutrition trend…</p> : null}

      {!busy && !hasTrend ? (
        <p className="hint vizEmpty">
          Log meals from your meal plan to build a nutrition history here.
        </p>
      ) : null}

      {hasTrend ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={40} unit=" kcal" />
            <Tooltip
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as TrendPoint | undefined
                return row?.date ?? ''
              }}
              formatter={(v) => [`${v} kcal`, 'Balance vs target']}
            />
            <ReferenceLine y={0} stroke="var(--border, #ccc)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="deficit" stroke="#16a34a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
