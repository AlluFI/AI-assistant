import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ProgressSummary = {
  entries: number
  weightDeltaKg: number | null
  wellnessDelta: number | null
}

type Props = {
  currentWeight: number | null
  targetWeightKg: number | null
  currentActivityDays: number | null
  targetActivityDays: number | null
  wellnessScore: number | null
  weightProgressPct: number | null
  activityProgressPct: number | null
  progressSummary: { weekly: ProgressSummary; monthly: ProgressSummary } | null
}

function CompareRow({
  label,
  current,
  target,
  pct,
}: {
  label: string
  current: string
  target: string
  pct: number | null
}) {
  return (
    <div className="compareRow">
      <p className="statLabel">{label}</p>
      <div className="compareValues">
        <div className="compareCol">
          <span className="compareTag">Current</span>
          <strong>{current}</strong>
        </div>
        <div className="compareCol">
          <span className="compareTag">Target</span>
          <strong>{target}</strong>
        </div>
        <div className="compareCol comparePct">
          <span className="compareTag">Progress</span>
          <strong>{pct != null ? `${pct}%` : '—'}</strong>
        </div>
      </div>
    </div>
  )
}

export function ComparisonPanel({
  currentWeight,
  targetWeightKg,
  currentActivityDays,
  targetActivityDays,
  wellnessScore,
  weightProgressPct: weightPct,
  activityProgressPct: activityPct,
  progressSummary,
}: Props) {
  const barData = progressSummary
    ? [
        {
          period: 'Weekly',
          weight: progressSummary.weekly.weightDeltaKg ?? 0,
          wellness: progressSummary.weekly.wellnessDelta ?? 0,
        },
        {
          period: 'Monthly',
          weight: progressSummary.monthly.weightDeltaKg ?? 0,
          wellness: progressSummary.monthly.wellnessDelta ?? 0,
        },
      ]
    : []

  return (
    <section className="vizBlock comparisonPanel cardSpan2">
      <div className="vizBlockHead">
        <h3>Current vs target</h3>
      </div>
      <CompareRow
        label="Weight"
        current={currentWeight != null ? `${currentWeight} kg` : '—'}
        target={targetWeightKg != null ? `${targetWeightKg} kg` : '—'}
        pct={weightPct}
      />
      <CompareRow
        label="Activity"
        current={currentActivityDays != null ? `${currentActivityDays} d/wk` : '—'}
        target={targetActivityDays != null ? `${targetActivityDays} d/wk` : '—'}
        pct={activityPct}
      />
      <CompareRow
        label="Wellness"
        current={wellnessScore != null ? `${wellnessScore}` : '—'}
        target="100"
        pct={wellnessScore}
      />
      {barData.length ? (
        <div className="chartBox">
          <p className="chartTitle">Weekly vs monthly change</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="weight" name="Weight Δ (kg)" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wellness" name="Wellness Δ" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="hint">Load summary to compare weekly and monthly progress.</p>
      )}
    </section>
  )
}
