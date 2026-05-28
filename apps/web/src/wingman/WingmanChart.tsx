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
} from 'recharts'
import type { WingmanChartBlock } from './types'
import { useChartTheme } from './useChartTheme'

const MACRO_COLORS = ['#2563eb', '#16a34a', '#f59e0b']

type Props = {
  block: WingmanChartBlock
}

export function WingmanChart({ block }: Props) {
  const { chart, title, data } = block
  const chartTheme = useChartTheme()
  const tick = { fontSize: 10, fill: chartTheme.tick }
  const tooltipProps = {
    contentStyle: {
      background: chartTheme.surface,
      border: `1px solid ${chartTheme.border}`,
      color: chartTheme.text,
      borderRadius: 6,
      fontSize: 12,
    },
  }

  if (chart === 'weight_trend') {
    const series = (data as { series?: Array<{ t: string; weightKg: number | null }> })
      .series ?? []
    const points = series
      .filter((p) => p.weightKg != null)
      .map((p) => ({
        label: p.t.slice(5, 10),
        weightKg: p.weightKg,
      }))
    if (!points.length) {
      return <p className="wingmanChartEmpty">No weight data in this range.</p>
    }
    return (
      <div className="wingmanChart">
        <p className="wingmanChartTitle">{title}</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={points}>
            <XAxis dataKey="label" tick={tick} />
            <YAxis domain={['auto', 'auto']} tick={tick} width={32} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="weightKg" stroke="#0d9488" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (chart === 'calorie_trend') {
    const series = (data as { series?: Array<{ date: string; calories: number }> }).series ?? []
    const points = series.map((p) => ({ label: p.date.slice(5), calories: p.calories }))
    if (!points.length) {
      return <p className="wingmanChartEmpty">No calorie logs in this range.</p>
    }
    return (
      <div className="wingmanChart">
        <p className="wingmanChartTitle">{title}</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={points}>
            <XAxis dataKey="label" tick={tick} />
            <YAxis tick={tick} width={36} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="calories" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (chart === 'protein_vs_target') {
    const d = data as {
      proteinIntake?: number
      proteinTarget?: number
      percent?: number
    }
    const barData = [
      { name: 'Actual', g: d.proteinIntake ?? 0 },
      { name: 'Target', g: d.proteinTarget ?? 0 },
    ]
    return (
      <div className="wingmanChart">
        <p className="wingmanChartTitle">{title}</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData}>
            <XAxis dataKey="name" tick={tick} />
            <YAxis tick={tick} width={32} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="g" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {d.percent != null ? (
          <p className="wingmanChartCaption">{d.percent}% of daily protein target</p>
        ) : null}
      </div>
    )
  }

  if (chart === 'macro_breakdown') {
    const d = data as {
      intake?: { protein: number; carbs: number; fats: number }
    }
    const intake = d.intake ?? { protein: 0, carbs: 0, fats: 0 }
    const pieData = [
      { name: 'Protein', value: intake.protein * 4 },
      { name: 'Carbs', value: intake.carbs * 4 },
      { name: 'Fats', value: intake.fats * 9 },
    ].filter((x) => x.value > 0)
    if (!pieData.length) {
      return <p className="wingmanChartEmpty">No macro intake logged today.</p>
    }
    return (
      <div className="wingmanChart">
        <p className="wingmanChartTitle">{title}</p>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={MACRO_COLORS[i % MACRO_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipProps} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return null
}
