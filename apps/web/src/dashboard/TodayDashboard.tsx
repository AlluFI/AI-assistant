import type { CSSProperties } from 'react'
import type { TodaySummary } from './todayTypes'

type Props = {
  today: TodaySummary | null
  busy?: boolean
  onLogWeight?: () => void
  onLogActivity?: () => void
}

function macroRing(pct: number, color?: string, size: 'md' | 'sm' = 'md') {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div
      className={`macroRing${size === 'sm' ? ' macroRingSm' : ''}`}
      style={
        {
          '--macro-pct': `${clamped}%`,
          ...(color ? { '--macro-color': color } : {}),
        } as CSSProperties
      }
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="macroRingLabel">{Math.round(clamped)}%</span>
    </div>
  )
}

const MACRO_OVERVIEW = [
  { key: 'protein' as const, label: 'Protein', color: '#2563eb' },
  { key: 'carbs' as const, label: 'Carbs', color: '#16a34a' },
  { key: 'fats' as const, label: 'Fats', color: '#f59e0b' },
]

export function TodayDashboard({
  today,
  busy,
  onLogWeight,
  onLogActivity,
}: Props) {
  const n = today?.nutrition
  const targetCal = n?.target.calories ?? 2000
  const intakeCal = n?.intake.calories ?? 0
  const remaining = n?.caloriesRemaining ?? Math.max(0, targetCal - intakeCal)

  return (
    <section className="card cardSpan2 todayDashboard">
      <div className="todayHead">
        <div>
          <h2>Today</h2>
          <p className="hint">{today?.date ?? new Date().toISOString().slice(0, 10)}</p>
        </div>
      </div>

      {busy && !today ? (
        <p className="hint loadingPulse">Loading your day…</p>
      ) : (
        <div className="todayGrid">
          <div className="todayStat todayStatPrimary">
            <span className="todayStatLabel">Calories left</span>
            <strong className="todayStatValue">{remaining}</strong>
            <span className="hint">
              {intakeCal} / {targetCal} kcal eaten
            </span>
          </div>

          <div className="todayStat todayStatMacros">
            <span className="todayStatLabel">Macros today</span>
            <p className="hint todayMacrosHint">Logged intake vs daily targets</p>
            <div className="todayMacrosGrid">
              {MACRO_OVERVIEW.map(({ key, label, color }) => {
                const pct = n?.macroPercentOfTarget[key] ?? 0
                const intake = Math.round(n?.intake[key] ?? 0)
                const target = n?.target.macros[key]
                return (
                  <div key={key} className="todayMacroItem">
                    <span className="todayMacroName">{label}</span>
                    {macroRing(pct, color, 'sm')}
                    <span className="hint todayMacroAmount">
                      {intake}g / {target ?? '—'}g
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="todayStat">
            <span className="todayStatLabel">Next meal</span>
            {today?.nextMeal?.next ? (
              <>
                <strong className="todayStatValueSm">
                  {today.nextMeal.next.mealType}: {today.nextMeal.next.title}
                </strong>
                <span className="hint">
                  {new Date(today.nextMeal.next.scheduledAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                  {today.nextMeal.next.calories != null
                    ? ` · ${today.nextMeal.next.calories} kcal`
                    : ''}
                </span>
              </>
            ) : (
              <p className="hint">No upcoming planned meal — generate a plan in Nutrition.</p>
            )}
          </div>

          <div className="todayStat todayStatCheckIn">
            <span className="todayStatLabel">Daily check-in</span>
            {today?.checkIn &&
            (today.checkIn.sleepHours != null ||
              today.checkIn.waterGlasses != null ||
              today.checkIn.mood != null) ? (
              <>
                <ul className="todayCheckInList">
                  {today.checkIn.sleepHours != null ? (
                    <li>
                      Sleep <strong>{today.checkIn.sleepHours}h</strong>
                    </li>
                  ) : null}
                  {today.checkIn.waterGlasses != null ? (
                    <li>
                      Water <strong>{today.checkIn.waterGlasses}</strong> glasses
                    </li>
                  ) : null}
                  {today.checkIn.mood != null ? (
                    <li>
                      Mood <strong>{today.checkIn.mood}/5</strong>
                    </li>
                  ) : null}
                  {today.checkIn.steps != null ? (
                    <li>
                      Steps <strong>{today.checkIn.steps.toLocaleString()}</strong>
                    </li>
                  ) : null}
                </ul>
                {today.checkInDayScore != null ? (
                  <span className="hint">
                    Today habits score: {today.checkInDayScore}/100
                    {today.checkInWeekScore != null
                      ? ` · 7-day avg ${today.checkInWeekScore}/100 (feeds wellness score)`
                      : ''}
                  </span>
                ) : null}
              </>
            ) : (
              <p className="hint">Log sleep, water, and mood in the card below.</p>
            )}
          </div>

          <div className="todayStat">
            <span className="todayStatLabel">Activity this week</span>
            <strong className="todayStatValueSm">
              {today?.activityWeek.activeDaysThisWeek ?? 0}
              {today?.activityWeek.targetDays != null
                ? ` / ${today.activityWeek.targetDays} days`
                : ' days'}
            </strong>
            {(today?.reminders.weightDue || today?.reminders.activityDue) && (
              <div className="todayReminders">
                {today.reminders.weightDue && onLogWeight ? (
                  <button type="button" className="secondary" onClick={onLogWeight}>
                    Log weight
                  </button>
                ) : null}
                {today.reminders.activityDue && onLogActivity ? (
                  <button type="button" className="secondary" onClick={onLogActivity}>
                    Log activity
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {today?.adherence.adherencePercent != null ? (
            <div className="todayStat">
              <span className="todayStatLabel">Plan adherence (7d)</span>
              <strong className="todayStatValueSm">{today.adherence.adherencePercent}%</strong>
              <span className="hint">
                {today.adherence.mealsEaten}/{today.adherence.mealsPlanned} planned meals eaten
              </span>
            </div>
          ) : null}

          {(today?.streaks.proteinTargetDays ?? 0) > 0 ||
          (today?.streaks.loggingDays ?? 0) > 0 ? (
            <div className="todayStreaks">
              {(today?.streaks.proteinTargetDays ?? 0) > 0 ? (
                <span className="streakBadge">
                  Protein streak: {today!.streaks.proteinTargetDays}d
                </span>
              ) : null}
              {(today?.streaks.loggingDays ?? 0) > 0 ? (
                <span className="streakBadge">
                  Logging streak: {today!.streaks.loggingDays}d
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
