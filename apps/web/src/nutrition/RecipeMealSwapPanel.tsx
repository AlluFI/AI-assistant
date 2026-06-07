import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/apiClient'
import type { MealPlanVersionDetail } from './types'

type PlanMealOption = {
  id: string
  mealType: string
  title: string
  scheduledAt: string
}

type PreviewResponse = {
  mealId: string
  mealType: string
  dayIndex: number
  recipeTitle: string
  projectedTotals: {
    calories: number
    protein: number
    carbs: number
    fats: number
  }
  calorieTarget: number
  macroTargets: {
    protein?: number
    carbs?: number
    fats?: number
  } | null
  evaluation: {
    needsReplanWarning: boolean
    calorieDirection: 'over' | 'under' | 'ok'
    calorieDelta: number
    calorieTarget: number
  }
  dayMeals: PlanMealOption[]
}

type Props = {
  accessToken: string
  activePlanId: string | null
  recipeId: string
  recipeTitle: string
  servings: number
  busy?: boolean
  onDone: () => void
  onCancel: () => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

function formatPlanDay(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dayIndex)
  return d.toISOString().slice(0, 10)
}

function mealTypeLabel(mealType: string): string {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1)
}

export function RecipeMealSwapPanel({
  accessToken,
  activePlanId,
  recipeId,
  recipeTitle,
  servings,
  busy,
  onDone,
  onCancel,
  setMessage,
  setError,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState<'daily' | 'weekly'>('daily')
  const [selectedDay, setSelectedDay] = useState(0)
  const [mealsByDay, setMealsByDay] = useState<Map<number, PlanMealOption[]>>(new Map())
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [showReplanPrompt, setShowReplanPrompt] = useState(false)

  const loadPlan = useCallback(async () => {
    if (!activePlanId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const body = await apiGet<{
        startDate: string
        duration: string
        versions?: MealPlanVersionDetail[]
      }>(`/meal-plans/${activePlanId}`, accessToken)
      const versions = body.versions ?? []
      const active = versions.find((v) => v.isActive) ?? versions[0]
      if (!active) {
        setError('No active meal plan version found. Generate a plan first.')
        setLoading(false)
        return
      }
      setVersionId(active.id)
      setStartDate(body.startDate)
      setDuration(body.duration === 'weekly' ? 'weekly' : 'daily')

      const byDay = new Map<number, PlanMealOption[]>()
      for (const m of active.meals ?? []) {
        const list = byDay.get(m.dayIndex) ?? []
        list.push({
          id: m.id,
          mealType: m.mealType,
          title: m.title,
          scheduledAt: m.scheduledAt,
        })
        byDay.set(m.dayIndex, list)
      }
      setMealsByDay(byDay)

      const today = new Date().toISOString().slice(0, 10)
      let defaultDay = 0
      if (body.duration === 'weekly') {
        for (let d = 0; d < 7; d++) {
          if (formatPlanDay(body.startDate, d) === today) {
            defaultDay = d
            break
          }
        }
      }
      setSelectedDay(defaultDay)
      const dayMeals = byDay.get(defaultDay) ?? []
      setSelectedMealId(dayMeals[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load meal plan')
    } finally {
      setLoading(false)
    }
  }, [accessToken, activePlanId, setError])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  const dayMeals = useMemo(
    () => mealsByDay.get(selectedDay) ?? [],
    [mealsByDay, selectedDay],
  )

  useEffect(() => {
    if (!dayMeals.some((m) => m.id === selectedMealId)) {
      setSelectedMealId(dayMeals[0]?.id ?? null)
    }
    setPreview(null)
    setShowReplanPrompt(false)
  }, [dayMeals, selectedDay, selectedMealId])

  const dayCount = duration === 'weekly' ? 7 : 1

  async function runPreview(): Promise<PreviewResponse | null> {
    if (!versionId || !selectedMealId) {
      setError('Select a meal slot to replace')
      return null
    }
    setSaving(true)
    setError('')
    try {
      const body = await apiPost<PreviewResponse>(
        `/meal-plans/versions/${versionId}/meals/${selectedMealId}/replace-recipe`,
        accessToken,
        { recipeId, servings, preview: true },
      )
      setPreview(body)
      return body
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not preview swap')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function executeSwap(replanDay: boolean) {
    if (!versionId || !selectedMealId) return
    setSaving(true)
    setError('')
    try {
      await apiPost(
        `/meal-plans/versions/${versionId}/meals/${selectedMealId}/replace-recipe`,
        accessToken,
        { recipeId, servings, replanDay },
      )
      const meal = dayMeals.find((m) => m.id === selectedMealId)
      setMessage(
        replanDay
          ? `Replaced ${mealTypeLabel(meal?.mealType ?? 'meal')} and replanned the day`
          : `Swapped ${mealTypeLabel(meal?.mealType ?? 'meal')} to ${recipeTitle}`,
      )
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not swap meal')
    } finally {
      setSaving(false)
      setShowReplanPrompt(false)
    }
  }

  async function onContinue() {
    const result = preview ?? (await runPreview())
    if (!result) return
    if (result.evaluation.needsReplanWarning) {
      setShowReplanPrompt(true)
      return
    }
    await executeSwap(false)
  }

  const disabled = busy || saving || loading

  if (!activePlanId) {
    return (
      <div className="recipeSwapPanel">
        <p className="hint">Generate a meal plan first, then you can swap recipes into it.</p>
        <div className="row">
          <button type="button" className="secondary" onClick={onCancel}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <p className="hint loadingPulse">Loading your meal plan…</p>
  }

  if (!versionId || dayMeals.length === 0) {
    return (
      <div className="recipeSwapPanel">
        <p className="hint">No meals on this plan day. Pick another day or regenerate your plan.</p>
        <div className="row">
          <button type="button" className="secondary" onClick={onCancel}>
            Back
          </button>
        </div>
      </div>
    )
  }

  const calorieLine = preview
    ? `${preview.projectedTotals.calories} / ${preview.calorieTarget} kcal`
    : null

  return (
    <div className="recipeSwapPanel">
      <h3 className="recipeSwapTitle">Swap into meal plan</h3>
      <p className="hint">
        Replace a planned slot with <strong>{recipeTitle}</strong>
        {servings !== 1 ? ` (${servings} servings)` : ''}.
      </p>

      {duration === 'weekly' ? (
        <div className="recipeSwapDayRow" role="tablist" aria-label="Plan day">
          {Array.from({ length: dayCount }, (_, d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={selectedDay === d}
              className={selectedDay === d ? 'active' : 'secondary'}
              disabled={disabled}
              onClick={() => setSelectedDay(d)}
            >
              {formatPlanDay(startDate, d).slice(5)}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint recipeSwapDayLabel">Day: {formatPlanDay(startDate, 0)}</p>
      )}

      <p className="recipeSwapSectionLabel">Which meal should this replace?</p>
      <ul className="recipeSwapMealList">
        {dayMeals.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={`recipeSwapMealOption${selectedMealId === m.id ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => {
                setSelectedMealId(m.id)
                setPreview(null)
              }}
            >
              <span className="recipeSwapMealType">{mealTypeLabel(m.mealType)}</span>
              <span className="recipeSwapMealTitle">{m.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {preview && calorieLine ? (
        <div className="recipeSwapPreview">
          <p className="recipeSwapPreviewLabel">After swap (this day)</p>
          <p>
            <strong>{calorieLine}</strong>
            {preview.evaluation.calorieDirection !== 'ok' ? (
              <span className={`recipeSwapDelta ${preview.evaluation.calorieDirection}`}>
                {' '}
                ({preview.evaluation.calorieDelta > 0 ? '+' : ''}
                {preview.evaluation.calorieDelta} kcal vs target)
              </span>
            ) : null}
          </p>
          <p className="hint">
            Protein {Math.round(preview.projectedTotals.protein)}g
            {preview.macroTargets?.protein
              ? ` / ${preview.macroTargets.protein}g target`
              : ''}
          </p>
        </div>
      ) : null}

      <div className="row recipeSwapActions">
        <button type="button" className="secondary" disabled={disabled} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" disabled={disabled || !selectedMealId} onClick={() => void onContinue()}>
          {saving ? 'Working…' : preview ? 'Confirm swap' : 'Continue'}
        </button>
      </div>

      {showReplanPrompt && preview ? (
        <div className="recipeSwapConfirmBackdrop" role="presentation">
          <div
            className="recipeSwapConfirmDialog"
            role="alertdialog"
            aria-labelledby="recipe-swap-warning-title"
            aria-describedby="recipe-swap-warning-desc"
          >
            <h4 id="recipe-swap-warning-title">Daily targets may be off</h4>
            <p id="recipe-swap-warning-desc" className="hint">
              {preview.evaluation.calorieDirection === 'over'
                ? 'Your daily calorie total would be above your target.'
                : preview.evaluation.calorieDirection === 'under'
                  ? 'Your daily calorie total would be below your target.'
                  : 'Macros for this day may be outside your targets.'}{' '}
              Re-plan the rest of the day to rebalance calories and macros while keeping your chosen
              recipe?
            </p>
            <p className="hint">
              Projected: <strong>{preview.projectedTotals.calories} kcal</strong> · target{' '}
              <strong>{preview.calorieTarget} kcal</strong>
            </p>
            <div className="row">
              <button
                type="button"
                className="secondary"
                disabled={disabled}
                onClick={() => void executeSwap(false)}
              >
                No — swap only
              </button>
              <button type="button" disabled={disabled} onClick={() => void executeSwap(true)}>
                Yes — re-plan day
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
