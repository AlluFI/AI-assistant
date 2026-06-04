import { wellnessScoreColor } from './dashboardUtils'
import type { SummaryComponents } from './dashboardUtils'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Props = {
  score: number | null
  components: SummaryComponents | null
}

const COMPONENT_COLORS = ['#2563eb', '#7c3aed', '#0f766e', '#f97316']
const COMPONENT_LABELS: Partial<Record<keyof SummaryComponents, string>> = {
  bmi: 'BMI',
  activity: 'Activity',
  progress: 'Goal progress',
  habits: 'Weekly activity',
  checkIn: 'Check-in (7d)',
}

export function WellnessGauge({ score, components }: Props) {
  const s = score ?? 0
  const color = wellnessScoreColor(s)
  const componentRows = components
    ? (Object.keys(COMPONENT_LABELS) as Array<keyof SummaryComponents>)
        .filter((key) => components[key] != null)
        .map((key, i) => ({
          name: COMPONENT_LABELS[key] ?? key,
          value: components[key] as number,
          fill: COMPONENT_COLORS[i % COMPONENT_COLORS.length],
        }))
    : []

  return (
    <section className="vizBlock wellnessGaugeBlock">
      <div className="vizBlockHead">
        <h3>Wellness score</h3>
        {score != null ? (
          <p className="vizHeadValue" style={{ color }}>
            {score}/100
          </p>
        ) : (
          <p className="vizHeadValue muted">—</p>
        )}
      </div>
      <div className="wellnessGaugeRow">
        <div
          className="wellnessGauge"
          style={{ background: score != null ? undefined : 'var(--gauge-track)' }}
          role="meter"
          aria-valuenow={score ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Wellness score"
        >
          {score != null ? (
            <div
              className="wellnessGaugeRing"
              style={{
                background: `conic-gradient(${color} ${s * 3.6}deg, var(--gauge-track) 0)`,
              }}
            >
              <div className="wellnessGaugeInner">
                <span className="wellnessGaugeScore" style={{ color }}>
                  {score}
                </span>
                <span className="wellnessGaugeSub">/ 100</span>
              </div>
            </div>
          ) : (
            <div className="wellnessGaugeInner">
              <span className="wellnessGaugeSub">No data</span>
            </div>
          )}
        </div>
        {componentRows.length ? (
          <div className="wellnessComponentsChart">
            <p className="chartTitle">Score breakdown</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={componentRows} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}`, 'Score']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                  {componentRows.map((row) => (
                    <Cell key={row.name} fill={row.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </section>
  )
}
