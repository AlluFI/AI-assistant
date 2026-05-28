import {
  projectedGoalDate,
  weightMilestoneValues,
  weightProgressPct,
} from './dashboardUtils'

type Props = {
  wellnessScore: number | null
  currentWeight: number | null
  startingWeight: number | null
  targetWeightKg: number | null
  fitnessGoalPrimary: string | null
  currentActivityDays: number | null
  targetActivityDays: number | null
  weightSeries: Array<{ t: string; weightKg?: number | null }>
}

function GoalBar({
  label,
  currentLabel,
  targetLabel,
  pct,
  extra,
}: {
  label: string
  currentLabel: string
  targetLabel: string
  pct: number | null
  extra?: string
}) {
  return (
    <div className="goalTrack">
      <div className="goalTrackHead">
        <span className="statLabel">{label}</span>
        <span className="goalTrackPct">{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div className="goalBar" aria-hidden={pct == null}>
        <div
          className="goalFill"
          style={{ width: pct != null ? `${pct}%` : '0%' }}
        />
      </div>
      <p className="hint goalTrackMeta">
        {currentLabel}
        {targetLabel ? ` → ${targetLabel}` : ''}
        {extra ? ` · ${extra}` : ''}
      </p>
    </div>
  )
}

export function GoalTracker({
  wellnessScore,
  currentWeight,
  startingWeight,
  targetWeightKg,
  fitnessGoalPrimary,
  currentActivityDays,
  targetActivityDays,
  weightSeries,
}: Props) {
  const weightPct = weightProgressPct(
    currentWeight,
    startingWeight,
    targetWeightKg,
    fitnessGoalPrimary,
  )
  const activityPct =
    currentActivityDays != null && targetActivityDays != null && targetActivityDays > 0
      ? Math.min(100, Math.round((currentActivityDays / targetActivityDays) * 100))
      : null
  const wellnessPct = wellnessScore != null ? Math.min(100, wellnessScore) : null

  const milestones =
    startingWeight != null && targetWeightKg != null
      ? weightMilestoneValues(startingWeight, targetWeightKg, fitnessGoalPrimary).filter(
          (m) => m.pct % 10 === 0 || m.pct === 5,
        )
      : []

  const projected = projectedGoalDate(weightSeries, targetWeightKg)

  return (
    <section className="vizBlock goalTracker">
      <div className="vizBlockHead">
        <h3>Progress towards goals</h3>
      </div>
      <GoalBar
        label="Wellness target (100 pts)"
        pct={wellnessPct}
        currentLabel={wellnessScore != null ? `${wellnessScore} pts` : '—'}
        targetLabel="100 pts"
      />
      <GoalBar
        label="Weight goal"
        pct={weightPct}
        currentLabel={currentWeight != null ? `${currentWeight} kg` : '—'}
        targetLabel={targetWeightKg != null ? `${targetWeightKg} kg` : 'set target in profile'}
        extra={projected ? `est. ${projected}` : undefined}
      />
      <GoalBar
        label="Weekly activity"
        pct={activityPct}
        currentLabel={
          currentActivityDays != null ? `${currentActivityDays} days/week` : '—'
        }
        targetLabel={
          targetActivityDays != null ? `${targetActivityDays} days/week` : 'set desired level'
        }
      />
      {milestones.length ? (
        <div className="milestoneRow">
          <p className="statLabel">Weight milestones</p>
          <div className="milestoneChips">
            {milestones.map((m) => (
              <span
                key={m.pct}
                className={`milestoneChip ${weightPct != null && weightPct >= m.pct ? 'achieved' : ''}`}
                title={`${m.pct}% — ${m.kg} kg`}
              >
                {m.pct}%
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
