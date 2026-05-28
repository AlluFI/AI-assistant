import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from './types'

type Props = {
  trend: TrendPoint[]
  busy?: boolean
}

export function NutritionTrendCompact({ trend, busy }: Props) {
  const data = trend.map((p) => ({ ...p, label: p.date.slice(5) }))
  if (!data.length) return null

  return (
    <div className="nutritionTrendCompact">
      <p className="chartTitle">Caloric balance (planned intake vs target)</p>
      {busy && !data.length ? <p className="hint loadingPulse">Loading…</p> : null}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <Tooltip
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as TrendPoint | undefined
              return row?.date ?? ''
            }}
            formatter={(v) => [`${v} kcal`, 'Deficit (+ below target)']}
          />
          <ReferenceLine y={0} stroke="var(--border, #ccc)" />
          <Line type="monotone" dataKey="deficit" stroke="#16a34a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="hint chartFootnote">From meal plan nutrition logs. See Nutrition tab for full charts.</p>
    </div>
  )
}
