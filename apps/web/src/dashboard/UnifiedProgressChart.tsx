import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BMI_HEALTHY_TARGET,
  WELLNESS_TARGET,
  bmiProgressPct,
  fmtDate,
  fmtDateFull,
  mergeMetricSeries,
  simpleProgressPct,
  weightProgressPct,
  type CombinedMetricPoint,
} from './dashboardUtils'

type Props = {
  weightSeries: Array<{ t: string; weightKg?: number | null; isBaseline?: boolean }>
  wellnessSeries: Array<{ t: string; wellnessScore?: number | null; bmi?: number | null; isBaseline?: boolean }>
  activitySeries: Array<{ t: string; weeklyActivityDays: number | null; isBaseline?: boolean }>
  currentWeight: number | null
  currentWellness: number | null
  currentBmi: number | null
  currentActivityDays: number | null
  targetWeightKg: number | null
  desiredActivityTargetDays: number | null
  fitnessGoalPrimary: string | null
  startingWeight: number | null
  baselinePoint: CombinedMetricPoint | null
}

type TooltipPayload = {
  payload?: CombinedMetricPoint
}

function MetricProgressRow({
  label,
  current,
  target,
  pct,
  color,
}: {
  label: string
  current: string
  target: string
  pct: number | null
  color: string
}) {
  return (
    <div className="metricProgressRow">
      <div className="metricProgressHead">
        <span className="metricProgressLabel" style={{ borderLeftColor: color }}>
          {label}
        </span>
        <span className="metricProgressPct">{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div className="metricCompare">
        <span>
          <span className="compareTag">Current</span> {current}
        </span>
        <span>
          <span className="compareTag">Target</span> {target}
        </span>
      </div>
      <div className="goalBar" aria-hidden={pct == null}>
        <div className="goalFill" style={{ width: pct != null ? `${pct}%` : '0%', background: color }} />
      </div>
    </div>
  )
}

export function UnifiedProgressChart({
  weightSeries,
  wellnessSeries,
  activitySeries,
  currentWeight,
  currentWellness,
  currentBmi,
  currentActivityDays,
  targetWeightKg,
  desiredActivityTargetDays,
  fitnessGoalPrimary,
  startingWeight,
  baselinePoint,
}: Props) {
  const [showTargets, setShowTargets] = useState(true)

  const data = useMemo(
    () => mergeMetricSeries(weightSeries, wellnessSeries, activitySeries),
    [weightSeries, wellnessSeries, activitySeries],
  )

  const weightPct = weightProgressPct(
    currentWeight,
    startingWeight,
    targetWeightKg,
    fitnessGoalPrimary,
  )
  const wellnessPct = currentWellness != null ? currentWellness : null
  const bmiPct = bmiProgressPct(currentBmi)
  const activityPct = simpleProgressPct(currentActivityDays, desiredActivityTargetDays)

  const hasWeight = data.some((p) => p.weightKg != null)
  const hasWellness = data.some((p) => p.wellnessScore != null)
  const hasBmi = data.some((p) => p.bmi != null)
  const hasActivity = data.some((p) => p.weeklyActivityDays != null)

  return (
    <div className="unifiedProgress">
      <div className="metricProgressGrid">
        <MetricProgressRow
          label="Weight"
          color="#0f766e"
          current={currentWeight != null ? `${currentWeight} kg` : '—'}
          target={targetWeightKg != null ? `${targetWeightKg} kg` : '—'}
          pct={weightPct}
        />
        <MetricProgressRow
          label="Wellness"
          color="#2563eb"
          current={currentWellness != null ? String(currentWellness) : '—'}
          target={String(WELLNESS_TARGET)}
          pct={wellnessPct}
        />
        <MetricProgressRow
          label="BMI"
          color="#f97316"
          current={currentBmi != null ? currentBmi.toFixed(1) : '—'}
          target={`${BMI_HEALTHY_TARGET} (healthy)`}
          pct={bmiPct}
        />
        <MetricProgressRow
          label="Activity"
          color="#7c3aed"
          current={currentActivityDays != null ? `${currentActivityDays} d/wk` : '—'}
          target={desiredActivityTargetDays != null ? `${desiredActivityTargetDays} d/wk` : '—'}
          pct={activityPct}
        />
      </div>

      <div className="chartControls">
        <label className="toggleLabel chartTargetToggle">
          <input
            type="checkbox"
            checked={showTargets}
            onChange={(e) => setShowTargets(e.target.checked)}
          />
          Show target lines on chart
        </label>
        <p className="hint chartAxisHint">
          Left axis: weight (kg) & BMI · Right axis: wellness (0–100) & activity (days/week)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={fmtDate} minTickGap={28} />
          <YAxis
            yAxisId="weight"
            orientation="left"
            domain={['auto', 'auto']}
            width={44}
            tick={{ fontSize: 11 }}
            label={{ value: 'kg', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <YAxis
            yAxisId="wellness"
            orientation="right"
            domain={[0, 100]}
            width={44}
            tick={{ fontSize: 11 }}
            label={{ value: 'Score', angle: 90, position: 'insideRight', fontSize: 10 }}
          />
          <YAxis yAxisId="bmi" hide domain={['dataMin - 1', 'dataMax + 1']} />
          <YAxis yAxisId="activity" hide domain={[0, 7]} />
          <Tooltip
            labelFormatter={fmtDate}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = (payload[0] as TooltipPayload)?.payload
              if (!row) return null
              return (
                <div className="chartTooltip">
                  <p className="chartTooltipTitle">{fmtDateFull(label)}</p>
                  {row.weightKg != null ? <p>Weight: {row.weightKg} kg</p> : null}
                  {row.wellnessScore != null ? <p>Wellness: {row.wellnessScore}</p> : null}
                  {row.bmi != null ? <p>BMI: {Number(row.bmi).toFixed(1)}</p> : null}
                  {row.weeklyActivityDays != null ? (
                    <p>Activity: {row.weeklyActivityDays} days/week</p>
                  ) : null}
                </div>
              )
            }}
          />
          <Legend />
          {hasWeight ? (
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weightKg"
              name="Weight (kg)"
              stroke="#0f766e"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ) : null}
          {hasWellness ? (
            <Line
              yAxisId="wellness"
              type="monotone"
              dataKey="wellnessScore"
              name="Wellness"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ) : null}
          {hasBmi ? (
            <Line
              yAxisId="bmi"
              type="monotone"
              dataKey="bmi"
              name="BMI"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
          ) : null}
          {hasActivity ? (
            <Line
              yAxisId="activity"
              type="monotone"
              dataKey="weeklyActivityDays"
              name="Activity (d/wk)"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ) : null}
          {baselinePoint?.weightKg != null ? (
            <ReferenceDot
              yAxisId="weight"
              x={baselinePoint.t}
              y={baselinePoint.weightKg}
              r={5}
              fill="#0f766e"
              stroke="#fff"
              label={{ value: 'Start', position: 'top', fontSize: 10 }}
            />
          ) : null}
          {showTargets && targetWeightKg != null ? (
            <ReferenceLine
              yAxisId="weight"
              y={targetWeightKg}
              stroke="#0f766e"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: 'Weight goal', fontSize: 10 }}
            />
          ) : null}
          {showTargets ? (
            <ReferenceLine
              yAxisId="wellness"
              y={WELLNESS_TARGET}
              stroke="#2563eb"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: 'Wellness goal', fontSize: 10 }}
            />
          ) : null}
          {showTargets ? (
            <ReferenceLine
              yAxisId="bmi"
              y={BMI_HEALTHY_TARGET}
              stroke="#f97316"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: 'BMI target', fontSize: 10 }}
            />
          ) : null}
          {showTargets && desiredActivityTargetDays != null ? (
            <ReferenceLine
              yAxisId="activity"
              y={desiredActivityTargetDays}
              stroke="#7c3aed"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: 'Activity goal', fontSize: 10 }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
