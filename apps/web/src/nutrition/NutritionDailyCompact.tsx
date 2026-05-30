import type { DailyAnalytics } from './types'

type Props = {
  daily: DailyAnalytics | null
  busy?: boolean
  onViewNutrition?: () => void
}

export function NutritionDailyCompact({ daily, busy, onViewNutrition }: Props) {
  const targetCal = daily?.target.calories ?? 2000
  const intakeCal = daily?.intake.calories ?? 0
  const pctOfTarget = targetCal > 0 ? Math.min(100, Math.round((intakeCal / targetCal) * 100)) : 0
  const status = daily?.status ?? 'on_track'
  const todayLabel = daily?.date ?? new Date().toISOString().slice(0, 10)

  return (
    <section className="vizBlock nutritionDailyCompact">
      <div className="vizBlockHead">
        <h3>Today&apos;s nutrition</h3>
        {onViewNutrition ? (
          <button type="button" className="secondary" onClick={onViewNutrition}>
            Nutrition tab
          </button>
        ) : null}
      </div>
      {busy && !daily ? (
        <p className="hint loadingPulse">Loading today&apos;s intake…</p>
      ) : (
        <>
          <p className="hint nutritionDailyDate">{todayLabel}</p>
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
              Mark meals as eaten in your meal plan to track daily intake.
            </p>
          ) : null}
          {daily ? (
            <p className="hint chartFootnote">
              P {Math.round(daily.intake.protein)}g · C {Math.round(daily.intake.carbs)}g · F{' '}
              {Math.round(daily.intake.fats)}g
            </p>
          ) : (
            <p className="hint chartFootnote">
              Generate a meal plan on the Nutrition tab to start tracking.
            </p>
          )}
        </>
      )}
    </section>
  )
}
