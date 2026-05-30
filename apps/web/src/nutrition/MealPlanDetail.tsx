import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { MealMacroChart } from './MealMacroChart'
import { EnhancedMealPlanPanel, EnhancedRecipePanel } from './EnhancedNutritionPanels'
import { RecipeCommunityFeedback } from './RecipeCommunityFeedback'
import { GenerationStepsPanel } from './GenerationStepsPanel'
import { RecipeNutritionViz } from './RecipeNutritionViz'
import { formatDietaryTags, formatPreparationStep } from './recipeDisplay'
import { devToolsEnabled } from '../devTools'
import { apiGet, apiPost, apiRequest } from '../lib/apiClient'
import type {
  EnhancedRecipeNutrition,
  MealPlanListItem,
  MealPlanVersionDetail,
  PlannedMealRow,
} from './types'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type RecipeModalData = {
  id: string
  title: string
  cuisine: string
  meal: string
  servings: number
  summary: string
  time: number
  difficulty_level: string
  ingredients: Array<{ id: string; name: string; quantity: number }>
  preparation: unknown[] | null
  nutrition?: { calories?: number; protein?: number; carbs?: number; fats?: number } | null
  dietary_tags?: string[] | null
  source?: string | null
  img?: string | null
  enhanced_nutrition?: EnhancedRecipeNutrition
  verified?: boolean
  community_score?: number | null
  community_rating_count?: number
}
type RecipeScaleData = {
  servings: number
  scaledIngredients: Array<{ id?: string; name: string; quantity: number; unit?: string }>
  nutrition: { calories: number; protein: number; carbs: number; fats: number }
  perServing: { calories: number; protein: number; carbs: number; fats: number }
}

type Props = {
  accessToken: string
  planId: string | null
  plans: MealPlanListItem[]
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
  onPlanChange: (planId: string | null) => void
  onRefreshPlans: () => Promise<void>
  onRefreshAnalytics: () => Promise<void>
  onRegeneratePlan?: (startDate: string, duration: 'daily' | 'weekly') => void
  onShoppingListCreated?: (listId: string) => void
}

function parseNutrition(raw: unknown): PlannedMealRow['nutrition'] {
  const n = raw as PlannedMealRow['nutrition'] | null
  return {
    calories: n?.calories ?? 0,
    protein: n?.protein ?? 0,
    carbs: n?.carbs ?? 0,
    fats: n?.fats ?? 0,
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function normalizeMeals(version: MealPlanVersionDetail): PlannedMealRow[] {
  return version.meals.map((m) => ({
    ...m,
    nutrition: parseNutrition(m.nutrition),
    alternatives: Array.isArray(m.alternatives) ? m.alternatives : [],
  }))
}

export function MealPlanDetail({
  accessToken,
  planId,
  plans,
  busy,
  setBusy,
  setMessage,
  setError,
  onPlanChange,
  onRefreshPlans,
  onRefreshAnalytics,
  onRegeneratePlan,
  onShoppingListCreated,
}: Props) {
  const [planDetail, setPlanDetail] = useState<{
    id: string
    duration: string
    startDate: string
    versions: MealPlanVersionDetail[]
  } | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [swapMode, setSwapMode] = useState(false)
  const [swapFirstId, setSwapFirstId] = useState<string | null>(null)
  const [dragMealId, setDragMealId] = useState<string | null>(null)
  const [localDayOrder, setLocalDayOrder] = useState<string[] | null>(null)
  const [manualMealTitle, setManualMealTitle] = useState('')
  const [manualMealType, setManualMealType] = useState<(typeof MEAL_TYPES)[number]>('lunch')
  const [manualMealTime, setManualMealTime] = useState('12:30')
  const [manualMealCalories, setManualMealCalories] = useState('')
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [recipeModalLoading, setRecipeModalLoading] = useState(false)
  const [recipeScaleLoading, setRecipeScaleLoading] = useState(false)
  const [recipeServings, setRecipeServings] = useState(1)
  const [recipeScaleData, setRecipeScaleData] = useState<RecipeScaleData | null>(null)
  const [recipeModalData, setRecipeModalData] = useState<RecipeModalData | null>(null)
  const [recipePlannedNutrition, setRecipePlannedNutrition] = useState<
    PlannedMealRow['nutrition'] | null
  >(null)

  const loadPlan = useCallback(async () => {
    if (!planId) {
      setPlanDetail(null)
      setVersionId(null)
      return
    }
    try {
      const body = await apiGet<{
        id: string
        duration: string
        startDate: string
        versions?: MealPlanVersionDetail[]
      }>(`/meal-plans/${planId}`, accessToken)
      const versions = (body.versions ?? []) as MealPlanVersionDetail[]
      setPlanDetail({
        id: body.id,
        duration: body.duration,
        startDate: body.startDate,
        versions,
      })
      const active = versions.find((v) => v.isActive) ?? versions[0]
      setVersionId(active?.id ?? null)
      setSelectedDay(0)
      setLocalDayOrder(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meal plan')
    }
  }, [planId, accessToken, setError])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  const activeVersion = planDetail?.versions.find((v) => v.id === versionId) ?? null

  const mealsByDay = useMemo(() => {
    if (!activeVersion) return new Map<number, PlannedMealRow[]>()
    const map = new Map<number, PlannedMealRow[]>()
    for (const m of normalizeMeals(activeVersion)) {
      const list = map.get(m.dayIndex) ?? []
      list.push(m)
      map.set(m.dayIndex, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [activeVersion])

  const dayIndexes = [...mealsByDay.keys()].sort((a, b) => a - b)
  const baseDayMeals = useMemo(() => mealsByDay.get(selectedDay) ?? [], [mealsByDay, selectedDay])

  const dayMeals = useMemo(() => {
    if (!localDayOrder?.length) return baseDayMeals
    const byId = new Map(baseDayMeals.map((m) => [m.id, m]))
    return localDayOrder.map((id) => byId.get(id)).filter(Boolean) as PlannedMealRow[]
  }, [baseDayMeals, localDayOrder])

  useEffect(() => {
    setLocalDayOrder(null)
  }, [selectedDay, versionId, activeVersion?.id])

  const mealsEatenCount = dayMeals.filter((m) => m.eatenAt).length
  const unlinkedRecipeCount = activeVersion?.meals.filter((m) => !m.recipeId).length ?? 0

  const sumNutrition = (meals: PlannedMealRow[]) =>
    meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.nutrition.calories,
        protein: acc.protein + m.nutrition.protein,
        carbs: acc.carbs + m.nutrition.carbs,
        fats: acc.fats + m.nutrition.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    )

  const dayTotals = sumNutrition(dayMeals.filter((m) => m.eatenAt))
  const plannedDayTotals = sumNutrition(dayMeals)

  const calorieTarget = (() => {
    const snap = activeVersion?.preferencesSnapshot as { calorie_target?: number } | null | undefined
    const n = snap?.calorie_target
    return typeof n === 'number' && n > 0 ? n : null
  })()

  async function runVersionAction(
    path: string,
    init: { method?: string; body?: unknown } = {},
    successMsg = 'Saved',
  ) {
    setBusy(true)
    setError('')
    try {
      await apiRequest(path, {
        accessToken,
        method: init.method ?? 'POST',
        body: init.body,
        parseJson: false,
      })
      setMessage(successMsg)
      setLocalDayOrder(null)
      await loadPlan()
      await onRefreshPlans()
      await onRefreshAnalytics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
      setLocalDayOrder(null)
    } finally {
      setBusy(false)
      setSwapFirstId(null)
      setSwapMode(false)
    }
  }

  function onMealClickForSwap(mealId: string) {
    if (!versionId) return
    if (!swapFirstId) {
      setSwapFirstId(mealId)
      return
    }
    if (swapFirstId === mealId) {
      setSwapFirstId(null)
      return
    }
    void runVersionAction(
      `/meal-plans/versions/${versionId}/swap`,
      { body: { mealIdA: swapFirstId, mealIdB: mealId } },
      'Meals swapped',
    )
  }

  async function selectAlternative(mealId: string, recipeId: string) {
    if (!versionId) return
    await runVersionAction(
      `/meal-plans/versions/${versionId}/meals/${mealId}/alternative`,
      { body: { recipeId } },
      'Alternative meal applied',
    )
  }

  async function logMealEaten(mealId: string, eaten: boolean) {
    if (!versionId) return
    await runVersionAction(
      `/meal-plans/versions/${versionId}/meals/${mealId}/${eaten ? 'log-eaten' : 'unlog-eaten'}`,
      {},
      eaten ? 'Meal logged as eaten' : 'Meal removed from today’s intake',
    )
  }

  async function logAllDayMeals(eaten: boolean) {
    if (!versionId) return
    await runVersionAction(
      `/meal-plans/versions/${versionId}/days/${selectedDay}/${eaten ? 'log-all-eaten' : 'unlog-all-eaten'}`,
      {},
      eaten ? 'All meals for this day logged' : 'All meals for this day unlogged',
    )
  }

  async function regenerateMeal(mealId: string) {
    if (!versionId) return
    await runVersionAction(
      `/meal-plans/versions/${versionId}/meals/${mealId}/regenerate`,
      {},
      'Meal regenerated with a new recipe',
    )
  }

  async function changeMealType(mealId: string, mealType: string) {
    if (!versionId) return
    await runVersionAction(
      `/meal-plans/versions/${versionId}/meals/${mealId}`,
      { method: 'PATCH', body: { mealType } },
      `Meal slot set to ${mealType}`,
    )
  }

  async function persistReorder(orderedIds: string[]) {
    if (!versionId) return
    await runVersionAction(
      `/meal-plans/versions/${versionId}/reorder`,
      { body: { dayIndex: selectedDay, mealIds: orderedIds } },
      'Meal order updated',
    )
  }

  function handleDragStart(mealId: string) {
    if (swapMode || busy) return
    setDragMealId(mealId)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function handleDrop(targetMealId: string) {
    if (!dragMealId || dragMealId === targetMealId || swapMode) return
    const ids = dayMeals.map((m) => m.id)
    const from = ids.indexOf(dragMealId)
    const to = ids.indexOf(targetMealId)
    if (from < 0 || to < 0) return

    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, dragMealId)
    setLocalDayOrder(next)
    setDragMealId(null)
    void persistReorder(next)
  }

  async function restoreVersion(vid: string) {
    if (!planDetail) return
    await runVersionAction(
      `/meal-plans/${planDetail.id}/versions/${vid}/restore`,
      {},
      'Version restored',
    )
  }

  async function createShoppingList() {
    if (!versionId) return
    setBusy(true)
    setError('')
    try {
      const created = await apiPost<{ id?: string }>(
        `/shopping-lists/from-version/${versionId}`,
        accessToken,
        {},
      )
      if (created.id) onShoppingListCreated?.(created.id)
      setMessage('Shopping list created — opening list')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shopping list failed')
    } finally {
      setBusy(false)
    }
  }

  async function createShoppingListForMeal(mealId: string, mealTitle: string) {
    if (!versionId) return
    setBusy(true)
    setError('')
    try {
      const created = await apiPost<{ id?: string }>(
        `/shopping-lists/from-meal/${versionId}/${mealId}`,
        accessToken,
        { title: `Shopping list — ${mealTitle}` },
      )
      if (created.id) onShoppingListCreated?.(created.id)
      setMessage('Meal shopping list created')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meal shopping list failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRecipesForVersion() {
    if (!versionId) return
    setBusy(true)
    setError('')
    try {
      const body = await apiPost<{ message?: string }>(
        `/meal-plans/versions/${versionId}/confirm-recipes`,
        accessToken,
      )
      setMessage(body.message ?? 'Meal plan recipes confirmed.')
      await loadPlan()
      await onRefreshPlans()
      await onRefreshAnalytics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm recipes')
    } finally {
      setBusy(false)
    }
  }

  async function addManualMeal() {
    if (!versionId) return
    const title = manualMealTitle.trim()
    if (!title) {
      setError('Enter a meal title')
      return
    }
    setBusy(true)
    setError('')
    try {
      const dayDate = new Date(`${planDetail?.startDate ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
      dayDate.setUTCDate(dayDate.getUTCDate() + selectedDay)
      const dayIso = dayDate.toISOString().slice(0, 10)
      const scheduledAt = `${dayIso}T${manualMealTime || '12:30'}:00.000Z`
      const payload: Record<string, unknown> = {
        dayIndex: selectedDay,
        mealType: manualMealType,
        scheduledAt,
        title,
      }
      if (manualMealCalories) payload.calories = Number(manualMealCalories)
      await apiPost(`/meal-plans/versions/${versionId}/meals`, accessToken, payload)
      setMessage('Manual meal added')
      setManualMealTitle('')
      setManualMealCalories('')
      await loadPlan()
      await onRefreshPlans()
      await onRefreshAnalytics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add manual meal')
    } finally {
      setBusy(false)
    }
  }

  async function openRecipeModal(
    recipeId: string,
    plannedNutrition?: PlannedMealRow['nutrition'],
  ) {
    setRecipeModalOpen(true)
    setRecipeModalLoading(true)
    setRecipeScaleLoading(false)
    setRecipeScaleData(null)
    setRecipeModalData(null)
    setRecipePlannedNutrition(plannedNutrition ?? null)
    try {
      const recipe = await apiGet<RecipeModalData>(`/recipes/${recipeId}`, accessToken)
      setRecipeModalData(recipe)
      const initialServings = Math.max(1, recipe.servings)
      setRecipeServings(initialServings)
      void loadScaledRecipe(recipe.id, initialServings)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load recipe')
      setRecipeModalOpen(false)
    } finally {
      setRecipeModalLoading(false)
    }
  }

  async function loadScaledRecipe(recipeId: string, servings: number) {
    setRecipeScaleLoading(true)
    try {
      const body = await apiPost<RecipeScaleData>('/recipes/scale', accessToken, {
        recipeId,
        servings,
      })
      setRecipeScaleData(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not scale recipe')
      setRecipeScaleData(null)
    } finally {
      setRecipeScaleLoading(false)
    }
  }

  if (!plans.length) {
    return (
      <section className="card cardWide">
        <h2>Meal plan detail</h2>
        <p className="hint">Generate a meal plan above to view and customize meals.</p>
      </section>
    )
  }

  return (
    <section className="card cardWide mealPlanDetail">
      <div className="mealPlanDetailHead">
        <h2>Meal plan detail</h2>
        <label>
          Plan
          <select
            value={planId ?? ''}
            onChange={(e) => onPlanChange(e.target.value || null)}
            disabled={busy}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.duration} · {p.startDate}
              </option>
            ))}
          </select>
        </label>
      </div>

      {planDetail && activeVersion ? (
        <>
          <div className="row mealPlanMeta">
            <span>
              {planDetail.duration} plan starting {planDetail.startDate}
            </span>
            <label>
              Version
              <select
                value={versionId ?? ''}
                onChange={(e) => setVersionId(e.target.value)}
                disabled={busy}
              >
                {planDetail.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionLabel} {v.isActive ? '(active)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {!activeVersion.isActive ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void restoreVersion(activeVersion.id)}
              >
                Restore this version
              </button>
            ) : null}
            <button
              type="button"
              className="secondary"
              disabled={busy || unlinkedRecipeCount > 0}
              title={
                unlinkedRecipeCount > 0
                  ? 'Confirm recipes first to generate shopping list ingredients'
                  : 'Create a shopping list from all meals in this plan version'
              }
              onClick={() => void createShoppingList()}
            >
              Create shopping list
            </button>
            <button
              type="button"
              className={`secondary${swapMode ? ' active' : ''}`}
              disabled={busy}
              onClick={() => {
                setSwapMode((s) => !s)
                setSwapFirstId(null)
              }}
            >
              {swapMode ? 'Cancel swap' : 'Swap two meals'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || unlinkedRecipeCount === 0}
              title={
                unlinkedRecipeCount > 0
                  ? `Store AI-generated recipes (${unlinkedRecipeCount} pending)`
                  : 'All meals already linked to stored recipes'
              }
              onClick={() => void confirmRecipesForVersion()}
            >
              Confirm recipes
            </button>
            {onRegeneratePlan ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                title="Generate a new version with current nutrition preferences"
                onClick={() =>
                  onRegeneratePlan(
                    planDetail.startDate,
                    planDetail.duration === 'weekly' ? 'weekly' : 'daily',
                  )
                }
              >
                Regenerate plan
              </button>
            ) : null}
          </div>
          {unlinkedRecipeCount > 0 ? (
            <p className="hint">
              {unlinkedRecipeCount} meal(s) still using draft AI recipes. Confirm recipes to enable
              ingredient-based shopping lists.
            </p>
          ) : null}

          {devToolsEnabled ? (
            <div className="card generationStepsCard">
              <h3 style={{ marginTop: 0 }}>Plan generation (sequential AI)</h3>
              <GenerationStepsPanel steps={activeVersion.generationSteps} />
            </div>
          ) : null}

          {activeVersion.enhanced_analytics ? (
            <EnhancedMealPlanPanel data={activeVersion.enhanced_analytics} />
          ) : null}

          {!swapMode && dayMeals.length > 1 ? (
            <p className="hint dragHint">Drag meal cards to reorder within the day.</p>
          ) : null}

          {planDetail.duration === 'weekly' && dayIndexes.length > 1 ? (
            <div className="dayTabs">
              {dayIndexes.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`secondary${selectedDay === d ? ' active' : ''}`}
                  onClick={() => setSelectedDay(d)}
                >
                  Day {d + 1}
                </button>
              ))}
            </div>
          ) : null}

          <div className="dayTotalsRow">
            <p className="dayTotals">
              Logged: <strong>{Math.round(dayTotals.calories)}</strong> kcal
              {plannedDayTotals.calories > dayTotals.calories ? (
                <span className="dayTarget">
                  {' '}
                  ({Math.round(plannedDayTotals.calories)} kcal planned for day)
                </span>
              ) : null}
              {calorieTarget != null ? (
                <>
                  {' '}
                  · target <span className="dayTarget">{calorieTarget}</span> kcal
                </>
              ) : null}{' '}
              · P {dayTotals.protein.toFixed(0)}g · C {dayTotals.carbs.toFixed(0)}g · F{' '}
              {dayTotals.fats.toFixed(0)}g
            </p>
            {dayMeals.length > 0 ? (
              <div className="dayLogActions">
                <span className="hint">
                  {mealsEatenCount}/{dayMeals.length} logged as eaten
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || swapMode}
                  onClick={() => void logAllDayMeals(mealsEatenCount < dayMeals.length)}
                >
                  {mealsEatenCount < dayMeals.length ? 'Log all for day' : 'Unlog all for day'}
                </button>
              </div>
            ) : null}
          </div>

          {!swapMode ? (
            <div className="card" style={{ marginBottom: '0.9rem' }}>
              <h3 style={{ marginTop: 0 }}>Add manual meal</h3>
              <div className="row">
                <label>
                  Title
                  <input
                    value={manualMealTitle}
                    onChange={(e) => setManualMealTitle(e.target.value)}
                    disabled={busy}
                    placeholder="Custom meal title"
                  />
                </label>
                <label>
                  Type
                  <select
                    value={manualMealType}
                    onChange={(e) => setManualMealType(e.target.value as (typeof MEAL_TYPES)[number])}
                    disabled={busy}
                  >
                    {MEAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    value={manualMealTime}
                    onChange={(e) => setManualMealTime(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Calories (optional)
                  <input
                    type="number"
                    min={0}
                    value={manualMealCalories}
                    onChange={(e) => setManualMealCalories(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <button type="button" onClick={() => void addManualMeal()} disabled={busy}>
                  Add meal
                </button>
              </div>
            </div>
          ) : null}

          <ul className="mealCards">
            {dayMeals.map((meal) => (
              <li
                key={meal.id}
                className={`mealCard${meal.eatenAt ? ' mealEaten' : ''}${swapMode && swapFirstId === meal.id ? ' swapSelected' : ''}${dragMealId === meal.id ? ' dragging' : ''}`}
                draggable={!swapMode && !busy}
                onDragStart={() => handleDragStart(meal.id)}
                onDragEnd={() => setDragMealId(null)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(meal.id)}
              >
                <div className="mealCardTop">
                  <div className="mealCardHead">
                    <span className="mealTypeBadge" data-meal-type={meal.mealType}>
                      {meal.mealType}
                    </span>
                    {!swapMode ? <span className="dragHandle" title="Drag to reorder">⠿</span> : null}
                    <h3>{meal.title}</h3>
                    <p className="hint">{fmtTime(meal.scheduledAt)}</p>
                  </div>
                  <MealMacroChart nutrition={meal.nutrition} compact />
                </div>

                <p className="mealNutrition">
                  {meal.nutrition.calories} kcal · P {meal.nutrition.protein}g · C {meal.nutrition.carbs}g · F{' '}
                  {meal.nutrition.fats}g
                </p>
                {meal.recipe ? (
                  <p className="hint">
                    {meal.recipe.cuisine} · {meal.recipe.timeMinutes} min prep
                  </p>
                ) : (
                  <p className="hint">
                    AI-generated draft meal (no linked recipe yet). Confirm recipes to unlock shopping list
                    ingredients.
                  </p>
                )}

                <div className="mealCardActions row">
                  {!swapMode ? (
                    <button
                      type="button"
                      className={meal.eatenAt ? 'secondary' : ''}
                      disabled={busy}
                      onClick={() => void logMealEaten(meal.id, !meal.eatenAt)}
                    >
                      {meal.eatenAt ? 'Undo eaten' : 'Log as eaten'}
                    </button>
                  ) : null}
                  <label className="mealTypeSelect">
                    Slot
                    <select
                      value={meal.mealType}
                      disabled={busy || swapMode}
                      onChange={(e) => void changeMealType(meal.id, e.target.value)}
                    >
                      {MEAL_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!swapMode ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => void regenerateMeal(meal.id)}
                    >
                      Regenerate
                    </button>
                  ) : null}
                  {!swapMode ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || !meal.recipeId}
                      title={
                        meal.recipeId
                          ? 'Create a shopping list for this meal only'
                          : 'Confirm recipes first to generate ingredient list'
                      }
                      onClick={() => void createShoppingListForMeal(meal.id, meal.title)}
                    >
                      Create list for meal
                    </button>
                  ) : null}
                  {!swapMode && meal.recipeId ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void openRecipeModal(meal.recipeId as string, meal.nutrition)
                      }
                    >
                      View recipe
                    </button>
                  ) : null}
                </div>

                {swapMode ? (
                  <button type="button" onClick={() => onMealClickForSwap(meal.id)} disabled={busy}>
                    {swapFirstId === meal.id
                      ? 'Selected (click another)'
                      : swapFirstId
                        ? 'Swap with selected'
                        : 'Select for swap'}
                  </button>
                ) : null}

                {meal.alternatives?.length && !swapMode ? (
                  <div className="alternatives">
                    <p className="hint">Alternatives</p>
                    <div className="chipRow">
                      {meal.alternatives.map((alt) => (
                        <button
                          key={alt.recipeId}
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => void selectAlternative(meal.id, alt.recipeId)}
                        >
                          {alt.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {recipeModalOpen ? (
            <div
              className="consentModalBackdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recipe-modal-title"
              onClick={() => setRecipeModalOpen(false)}
            >
              <section
                className="card cardWide"
                style={{ width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
                  <h2 id="recipe-modal-title" style={{ margin: 0 }}>
                    {recipeModalData?.title ?? 'Recipe'}
                  </h2>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setRecipeModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
                {recipeModalLoading ? (
                  <p className="hint loadingPulse">Loading recipe...</p>
                ) : recipeModalData ? (
                  <>
                    <div className="row">
                      <label>
                        Servings
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={recipeServings}
                          onChange={(e) => {
                            const next = Math.max(1, Number(e.target.value || 1))
                            setRecipeServings(next)
                            void loadScaledRecipe(recipeModalData.id, next)
                          }}
                        />
                      </label>
                    </div>
                    <p className="hint">
                      {recipeModalData.cuisine} · {recipeModalData.meal} ·{' '}
                      {recipeModalData.time} min · base serves {recipeModalData.servings}
                    </p>
                    {recipeModalData.summary ? (
                      <p className="hint">{recipeModalData.summary}</p>
                    ) : null}
                    {formatDietaryTags(recipeModalData.dietary_tags) ? (
                      <p className="hint">
                        <strong>Tags:</strong> {formatDietaryTags(recipeModalData.dietary_tags)}
                      </p>
                    ) : null}
                    {recipeModalData.source ? (
                      <p className="hint">
                        <strong>Source:</strong> {recipeModalData.source}
                      </p>
                    ) : null}
                    {recipeModalData.difficulty_level ? (
                      <p className="hint">
                        <strong>Difficulty:</strong> {recipeModalData.difficulty_level}
                      </p>
                    ) : null}
                    {recipeModalData.img ? (
                      <p className="hint recipeDetailImage">
                        <img src={recipeModalData.img} alt="" loading="lazy" />
                      </p>
                    ) : null}
                    {recipePlannedNutrition ? (
                      <div className="recipePlanNutritionNotice">
                        <p>
                          <strong>In your meal plan (this slot):</strong>{' '}
                          {Math.round(recipePlannedNutrition.calories)} kcal · P{' '}
                          {recipePlannedNutrition.protein.toFixed(1)}g · C{' '}
                          {recipePlannedNutrition.carbs.toFixed(1)}g · F{' '}
                          {recipePlannedNutrition.fats.toFixed(1)}g
                        </p>
                        <p className="hint">
                          The meal card uses a portion sized to your daily calorie target for{' '}
                          {recipeModalData.meal}. Full recipe nutrition below is calculated from
                          all listed ingredients.
                          {recipeScaleData &&
                          recipeScaleData.perServing.calories > 0 &&
                          Math.abs(
                            recipeScaleData.perServing.calories - recipePlannedNutrition.calories,
                          ) > 25
                            ? ` To approximate the planned amount (~${Math.round(recipePlannedNutrition.calories)} kcal), use about ${Math.max(0.25, Math.min(2.5, recipePlannedNutrition.calories / recipeScaleData.perServing.calories)).toFixed(2)} of one serving.`
                            : ''}
                        </p>
                      </div>
                    ) : null}
                    {recipeScaleLoading ? (
                      <p className="hint loadingPulse">Scaling nutrition...</p>
                    ) : null}
                    {!recipeScaleLoading && recipeScaleData ? (
                      <>
                        {recipeScaleData.servings > 1 ? (
                          <RecipeNutritionViz
                            title={`Total nutrition (${recipeScaleData.servings} servings)`}
                            nutrition={recipeScaleData.nutrition}
                            footnote="Summed from scaled ingredient quantities."
                          />
                        ) : null}
                        <RecipeNutritionViz
                          title={
                            recipePlannedNutrition
                              ? 'Full recipe (per serving)'
                              : 'Nutrition per serving'
                          }
                          nutrition={recipeScaleData.perServing}
                          footnote="Calculated from recipe ingredients (function-calling nutrition path)."
                        />
                      </>
                    ) : !recipeScaleLoading && recipeModalData.nutrition ? (
                      <RecipeNutritionViz
                        title={
                          recipePlannedNutrition
                            ? 'Full recipe (per serving)'
                            : 'Nutrition per serving'
                        }
                        nutrition={{
                          calories: recipeModalData.nutrition.calories ?? 0,
                          protein: recipeModalData.nutrition.protein ?? 0,
                          carbs: recipeModalData.nutrition.carbs ?? 0,
                          fats: recipeModalData.nutrition.fats ?? 0,
                        }}
                        footnote="Calculated from recipe ingredients."
                      />
                    ) : !recipeScaleLoading ? (
                      <p className="hint">Nutrition data not available.</p>
                    ) : null}
                    {recipeModalData.enhanced_nutrition ? (
                      <EnhancedRecipePanel data={recipeModalData.enhanced_nutrition} />
                    ) : null}
                    <RecipeCommunityFeedback
                      accessToken={accessToken}
                      recipeId={recipeModalData.id}
                      setError={setError}
                      recipeVerified={recipeModalData.verified}
                      communityScore={recipeModalData.community_score}
                      communityRatingCount={recipeModalData.community_rating_count}
                    />
                    <h3>Ingredients</h3>
                    <ul>
                      {(recipeScaleData?.scaledIngredients ?? recipeModalData.ingredients).map((item) => (
                        <li key={`${item.id}-${item.name}`}>
                          {item.name} — {Math.round(item.quantity)}{' '}
                          {'unit' in item && item.unit === 'milliliter' ? 'ml' : 'g'}
                        </li>
                      ))}
                    </ul>
                    <h3>Preparation</h3>
                    {Array.isArray(recipeModalData.preparation) &&
                    recipeModalData.preparation.length ? (
                      <ol>
                        {recipeModalData.preparation.map((step, idx) => {
                          const text = formatPreparationStep(step, idx)
                          return (
                            <li key={`${idx}-${text.slice(0, 24)}`}>{text}</li>
                          )
                        })}
                      </ol>
                    ) : (
                      <p className="hint">No preparation steps available.</p>
                    )}
                  </>
                ) : (
                  <p className="hint">Recipe data not available.</p>
                )}
              </section>
            </div>
          ) : null}
        </>
      ) : (
        <p className="hint loadingPulse">Loading plan…</p>
      )}
    </section>
  )
}
