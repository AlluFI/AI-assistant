import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import type { DailyAnalytics, TrendPoint, WeeklyAnalytics } from './types'

const MACRO_COLORS = ['#2563eb', '#16a34a', '#f59e0b']

type Props = {
  daily: DailyAnalytics | null
  dailyDate: string
  onDailyDateChange: (date: string) => void
  weekly: WeeklyAnalytics | null
  trend: TrendPoint[]
  trendDays: number
  onTrendDaysChange: (days: number) => void
  busy?: boolean
}

const TREND_RANGES = [7, 30, 90] as const

function macroKcal(n: { protein: number; carbs: number; fats: number }) {
  return {
    protein: n.protein * 4,
    carbs: n.carbs * 4,
    fats: n.fats * 9,
  }
}

export function NutritionCharts({
  daily,
  dailyDate,
  onDailyDateChange,
  weekly,
  trend,
  trendDays,
  onTrendDaysChange,
  busy,
}: Props) {
  const targetCal = daily?.target.calories ?? 2000
  const intakeCal = daily?.intake.calories ?? 0
  const pctOfTarget = targetCal > 0 ? Math.min(150, Math.round((intakeCal / targetCal) * 100)) : 0
  const status = daily?.status ?? 'on_track'

  const kcalMacros = daily
    ? macroKcal(daily.intake)
    : { protein: 0, carbs: 0, fats: 0 }
  const pieData = [
    { name: 'Protein', value: kcalMacros.protein, grams: daily?.intake.protein ?? 0 },
    { name: 'Carbs', value: kcalMacros.carbs, grams: daily?.intake.carbs ?? 0 },
    { name: 'Fats', value: kcalMacros.fats, grams: daily?.intake.fats ?? 0 },
  ].filter((d) => d.value > 0)

  const macroBarData = daily
    ? [
        { name: 'Protein', pct: daily.macroPercentOfTarget.protein, target: daily.target.macros.protein, actual: daily.intake.protein },
        { name: 'Carbs', pct: daily.macroPercentOfTarget.carbs, target: daily.target.macros.carbs, actual: daily.intake.carbs },
        { name: 'Fats', pct: daily.macroPercentOfTarget.fats, target: daily.target.macros.fats, actual: daily.intake.fats },
      ]
    : []

  const trendChart = trend.map((p) => ({
    ...p,
    label: p.date.slice(5),
  }))

  return (
    <section className="card cardWide nutritionCharts">
      <h2>Nutrition progress</h2>

      <div className="nutritionChartsGrid">
        <div className="nutritionChartBlock">
          <div className="chartPanelHead">
            <p className="chartTitle">Daily intake</p>
            <label className="chartRangeLabel">
              Date
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => onDailyDateChange(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <div className="calorieProgressWrap">
            <div
              className={`calorieProgressBar status-${status}`}
              style={{ width: `${pctOfTarget}%` }}
              role="progressbar"
              aria-valuenow={intakeCal}
              aria-valuemin={0}
              aria-valuemax={targetCal}
            />
          </div>
          <p className="calorieProgressLabel">
            <strong>{intakeCal}</strong> / {targetCal} kcal
            {daily?.mealsPlanned != null && daily.mealsPlanned > 0 ? (
              <span className="nutritionStatusInline">
                {' '}
                · {daily.mealsEaten ?? 0}/{daily.mealsPlanned} meals logged
              </span>
            ) : null}
            {daily ? (
              <span className={`nutritionStatusInline status-${status}`}>
                {daily.deficit > 0
                  ? ` · ${daily.deficit} kcal below target`
                  : daily.surplus > 0
                    ? ` · ${daily.surplus} kcal above target`
                    : ' · on track'}
              </span>
            ) : null}
          </p>
          {daily && intakeCal === 0 && (daily.mealsPlanned ?? 0) > 0 ? (
            <p className="hint chartFootnote">
              Mark meals as eaten in your meal plan to fill this chart.
            </p>
          ) : null}
        </div>

        <div className="nutritionChartBlock">
          <p className="chartTitle">Macro breakdown (kcal)</p>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {pieData.map((_, i) => (
                    <Cell key={pieData[i]!.name} fill={MACRO_COLORS[i % MACRO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const row = item?.payload as { name: string; grams: number }
                    return [`${Math.round(Number(value))} kcal (${row.grams}g)`, row.name]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="hint">Generate a meal plan to see macro breakdown.</p>
          )}
        </div>

        <div className="nutritionChartBlock macroBarsBlock">
          <p className="chartTitle">Macros vs daily target (%)</p>
          {macroBarData.length ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={macroBarData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <XAxis type="number" domain={[0, 120]} unit="%" />
                <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, _n, item) => {
                    const row = item?.payload as { actual: number; target: number }
                    return [`${v}% (${row.actual}g / ${row.target}g)`, '% of target']
                  }}
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                  {macroBarData.map((_, i) => (
                    <Cell key={macroBarData[i]!.name} fill={MACRO_COLORS[i % MACRO_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="hint">No macro data yet.</p>
          )}
        </div>
      </div>

      {weekly ? (
        <div className="nutritionChartBlock weeklySummaryBlock">
          <p className="chartTitle">
            Weekly summary ({weekly.start} → {weekly.end})
          </p>
          <p className="calorieProgressLabel">
            <strong>{weekly.avgCalories}</strong> kcal/day avg logged · target{' '}
            {weekly.targetCalories} kcal/day
          </p>
          <p className="hint">
            {weekly.days} day(s) with intake · avg balance{' '}
            {weekly.avgDeficit > 0
              ? `${weekly.avgDeficit} kcal below target`
              : weekly.avgDeficit < 0
                ? `${Math.abs(weekly.avgDeficit)} kcal above target`
                : 'on target'}
            {' '}
            · week totals P {Math.round(weekly.totalProtein)}g · C {Math.round(weekly.totalCarbs)}g
            · F {Math.round(weekly.totalFats)}g
          </p>
        </div>
      ) : null}

      <div className="nutritionChartBlock trendBlock">
        <div className="chartPanelHead">
          <p className="chartTitle">Caloric balance trend</p>
          <label className="chartRangeLabel">
            Range
            <select
              value={trendDays}
              onChange={(e) => onTrendDaysChange(Number(e.target.value))}
              disabled={busy}
            >
              {TREND_RANGES.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>
        {trendChart.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" kcal" />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as TrendPoint | undefined
                  return row?.date ?? ''
                }}
                formatter={(v) => [`${v} kcal`, 'Balance (deficit +)']}
              />
              <ReferenceLine y={0} stroke="var(--border, #ccc)" />
              <Line
                type="monotone"
                dataKey="deficit"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="hint">Trend appears after meal plans update daily nutrition logs.</p>
        )}
        <p className="hint chartFootnote">
          Positive values = below calorie target (deficit). Negative = surplus.
        </p>
      </div>
    </section>
  )
}
