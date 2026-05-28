import { useCallback, useEffect, useMemo, useState } from 'react'
import { MealPhotoLog } from './MealPhotoLog'
import { NutritionCharts } from './NutritionCharts'
import { MealPlanDetail } from './MealPlanDetail'
import { RecipeSearchModal } from './RecipeSearchModal'
import { ShoppingListPanel } from './ShoppingListPanel'
import {
  buildPreferredMealTimesPayload,
  parsePreferredMealTimes,
} from './nutritionFormUtils'
import type {
  DailyAnalytics,
  MealPlanListItem,
  NutritionInsights,
  ShoppingList,
  TrendPoint,
  WeeklyAnalytics,
} from './types'
import { readApiJson } from '../lib/apiJson'
import './nutrition.css'

const apiBase = import.meta.env.VITE_API_BASE ?? '/api'

type NutritionPanelProps = {
  accessToken: string
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
  onOpenWellnessInsights?: () => void
  /** When set (e.g. from wingman), open the shopping list modal for this list. */
  openShoppingListId?: string | null
  onShoppingListOpened?: () => void
}

type CombinedProfile = {
  healthProfile?: {
    dietaryPreferences?: string[]
    dietaryRestrictions?: string[]
  } | null
  nutritionProfile?: {
    timezone?: string
    dislikedIngredients?: string[]
    cuisinePreferences?: string[]
    calorieTarget?: number
    macroTargets?: { protein?: number; carbs?: number; fats?: number }
    mealsPerDay?: number
    snacksPerDay?: number
    preferredMealTimes?: Record<string, string>
  } | null
  suggestedTargets?: {
    calories: number
    macros?: { protein: number; carbs: number; fats: number }
  } | null
}

export function NutritionPanel({
  accessToken,
  busy,
  setBusy,
  setMessage,
  setError,
  onOpenWellnessInsights,
  openShoppingListId,
  onShoppingListOpened,
}: NutritionPanelProps) {
  const [profile, setProfile] = useState<CombinedProfile | null>(null)
  const [cuisines, setCuisines] = useState('')
  const [disliked, setDisliked] = useState('')
  const [calorieTarget, setCalorieTarget] = useState('')
  const [macroProtein, setMacroProtein] = useState('')
  const [macroCarbs, setMacroCarbs] = useState('')
  const [macroFats, setMacroFats] = useState('')
  const [mealsPerDay, setMealsPerDay] = useState('3')
  const [snacksPerDay, setSnacksPerDay] = useState('0')
  const [mealTimes, setMealTimes] = useState({
    breakfast: '08:00',
    lunch: '12:30',
    dinner: '19:00',
    snack: '15:00',
  })
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [weeklyAnalytics, setWeeklyAnalytics] = useState<WeeklyAnalytics | null>(null)
  const [mealPlans, setMealPlans] = useState<MealPlanListItem[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState<'daily' | 'weekly'>('daily')
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyAnalytics | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [trendDays, setTrendDays] = useState(30)
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [shoppingModalOpen, setShoppingModalOpen] = useState(false)
  const [recipeSearchOpen, setRecipeSearchOpen] = useState(false)
  const [insights, setInsights] = useState<NutritionInsights | null>(null)

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }),
    [accessToken],
  )

  const loadProfile = useCallback(async () => {
    const res = await fetch(`${apiBase}/nutrition/profile`, { headers })
    const body = (await res.json()) as CombinedProfile
    if (!res.ok) {
      setError('Failed to load nutrition profile')
      return
    }
    setProfile(body)
    const np = body.nutritionProfile
    if (Array.isArray(np?.cuisinePreferences)) setCuisines(np.cuisinePreferences.join(', '))
    if (Array.isArray(np?.dislikedIngredients)) setDisliked(np.dislikedIngredients.join(', '))
    if (np?.calorieTarget) setCalorieTarget(String(np.calorieTarget))
    else if (body.suggestedTargets?.calories) setCalorieTarget(String(body.suggestedTargets.calories))
    if (np?.mealsPerDay) setMealsPerDay(String(np.mealsPerDay))
    if (np?.snacksPerDay != null) setSnacksPerDay(String(np.snacksPerDay))
    const macros = np?.macroTargets
    if (macros?.protein != null) setMacroProtein(String(macros.protein))
    if (macros?.carbs != null) setMacroCarbs(String(macros.carbs))
    if (macros?.fats != null) setMacroFats(String(macros.fats))
    else if (body.suggestedTargets?.macros) {
      const s = body.suggestedTargets.macros
      if (s.protein != null) setMacroProtein(String(s.protein))
      if (s.carbs != null) setMacroCarbs(String(s.carbs))
      if (s.fats != null) setMacroFats(String(s.fats))
    }
    setMealTimes(parsePreferredMealTimes(np?.preferredMealTimes))
  }, [headers, setError])

  function nutritionPayload() {
    const macroTargets =
      macroProtein || macroCarbs || macroFats
        ? {
            protein: Number(macroProtein || 0),
            carbs: Number(macroCarbs || 0),
            fats: Number(macroFats || 0),
          }
        : undefined
    return {
      cuisinePreferences: cuisines.split(',').map((s) => s.trim()).filter(Boolean),
      dislikedIngredients: disliked.split(',').map((s) => s.trim()).filter(Boolean),
      calorieTarget: calorieTarget ? Number(calorieTarget) : undefined,
      calorieTargetSource: 'manual',
      macroTargets,
      mealsPerDay: Number(mealsPerDay),
      snacksPerDay: Number(snacksPerDay),
      preferredMealTimes: buildPreferredMealTimesPayload(mealTimes),
    }
  }

  const loadMealPlans = useCallback(async () => {
    const res = await fetch(`${apiBase}/meal-plans`, { headers })
    const body = await res.json()
    if (res.ok && Array.isArray(body)) {
      const list = body as MealPlanListItem[]
      setMealPlans(list)
      setSelectedPlanId((prev) => prev ?? list[0]?.id ?? null)
    }
  }, [headers])

  const loadDailyAnalytics = useCallback(async () => {
    const res = await fetch(`${apiBase}/nutrition-analytics/daily?date=${dailyDate}`, {
      headers,
    })
    if (res.ok) setDailyAnalytics((await res.json()) as DailyAnalytics)
  }, [headers, dailyDate])

  const loadWeeklyAnalytics = useCallback(async () => {
    const res = await fetch(`${apiBase}/nutrition-analytics/weekly?end=${dailyDate}`, {
      headers,
    })
    if (res.ok) setWeeklyAnalytics((await res.json()) as WeeklyAnalytics)
  }, [headers, dailyDate])

  const loadTrend = useCallback(async () => {
    const res = await fetch(`${apiBase}/nutrition-analytics/trend?days=${trendDays}`, { headers })
    if (res.ok) setTrend((await res.json()) as TrendPoint[])
  }, [headers, trendDays])

  const loadInsights = useCallback(async () => {
    const res = await fetch(`${apiBase}/nutrition-analytics/insights`, { headers })
    if (res.ok) setInsights((await res.json()) as NutritionInsights)
  }, [headers])

  const loadShoppingLists = useCallback(async () => {
    const res = await fetch(`${apiBase}/shopping-lists`, { headers })
    if (!res.ok) return
    const body = (await res.json()) as ShoppingList[]
    const list = Array.isArray(body) ? body : []
    setShoppingLists(list)
    setSelectedListId((prev) => {
      if (prev && list.some((l) => l.id === prev)) return prev
      return list[0]?.id ?? null
    })
  }, [headers])

  useEffect(() => {
    void loadProfile()
    void loadMealPlans()
    void loadInsights()
    void loadShoppingLists()
  }, [loadProfile, loadMealPlans, loadInsights, loadShoppingLists])

  useEffect(() => {
    if (!openShoppingListId) return
    setSelectedListId(openShoppingListId)
    setShoppingModalOpen(true)
    void loadShoppingLists().finally(() => onShoppingListOpened?.())
  }, [openShoppingListId, loadShoppingLists, onShoppingListOpened])

  useEffect(() => {
    void loadDailyAnalytics()
    void loadWeeklyAnalytics()
  }, [loadDailyAnalytics, loadWeeklyAnalytics])

  useEffect(() => {
    void loadTrend()
  }, [loadTrend])

  async function saveNutrition() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/nutrition/profile`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(nutritionPayload()),
      })
      if (!res.ok) throw new Error('Save failed')
      setMessage('Nutrition preferences saved')
      await loadProfile()
    } catch {
      setError('Could not save nutrition preferences')
    } finally {
      setBusy(false)
    }
  }

  async function applySuggested() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/nutrition/profile/apply-suggested-targets`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error('Apply failed')
      const body = await res.json()
      if (body.calorieTarget) setCalorieTarget(String(body.calorieTarget))
      if (body.macroTargets) {
        setMacroProtein(String(body.macroTargets.protein ?? ''))
        setMacroCarbs(String(body.macroTargets.carbs ?? ''))
        setMacroFats(String(body.macroTargets.fats ?? ''))
      }
      setMessage('Applied calorie and macro targets from your health profile')
      await loadProfile()
      await loadDailyAnalytics()
    } catch {
      setError('Could not apply suggested targets')
    } finally {
      setBusy(false)
    }
  }

  async function persistNutritionPrefs() {
    const res = await fetch(`${apiBase}/nutrition/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(nutritionPayload()),
    })
    if (!res.ok) throw new Error('Save nutrition preferences before generating')
  }

  async function generateMealPlan(
    regenerate = false,
    opts?: { startDate?: string; duration?: 'daily' | 'weekly' },
  ) {
    setBusy(true)
    setError('')
    const planDuration = opts?.duration ?? duration
    const planStart = opts?.startDate ?? startDate
    try {
      await persistNutritionPrefs()
      const res = await fetch(`${apiBase}/meal-plans/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ duration: planDuration, startDate: planStart, version: '1.0' }),
      })
      const body = await readApiJson<{ message?: string; mealPlan?: { id: string } }>(res)
      if (!res.ok) throw new Error(body.message ?? 'Generation failed')
      setMessage(
        regenerate
          ? `Meal plan regenerated (${planDuration})`
          : `Meal plan generated (${planDuration})`,
      )
      if (body.mealPlan?.id) setSelectedPlanId(body.mealPlan.id)
      await loadMealPlans()
      await loadDailyAnalytics()
      await loadTrend()
      await loadInsights()
      await loadWeeklyAnalytics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meal plan generation failed')
    } finally {
      setBusy(false)
    }
  }

  const healthPrefs = profile?.healthProfile?.dietaryPreferences ?? []
  const healthRestrictions = profile?.healthProfile?.dietaryRestrictions ?? []
  const profileRestrictionTags = useMemo(() => [...healthRestrictions], [healthRestrictions])

  const refreshAnalytics = async () => {
    await loadDailyAnalytics()
    await loadWeeklyAnalytics()
    await loadTrend()
    await loadInsights()
  }

  return (
    <div className="nutritionPanel">
      <NutritionCharts
        daily={dailyAnalytics}
        dailyDate={dailyDate}
        onDailyDateChange={setDailyDate}
        weekly={weeklyAnalytics}
        trend={trend}
        trendDays={trendDays}
        onTrendDaysChange={setTrendDays}
        busy={busy}
      />

      <MealPhotoLog
        accessToken={accessToken}
        busy={busy}
        setBusy={setBusy}
        setMessage={setMessage}
        setError={setError}
        onConfirmed={() => void refreshAnalytics()}
      />

      <section className="card cardWide">
        <h2>AI nutrition analysis</h2>
        <p className="hint">
          Nutrition-specific highlights below. For wellness and lifestyle insights, use the{' '}
          {onOpenWellnessInsights ? (
            <button type="button" className="linkButton" onClick={onOpenWellnessInsights}>
              Insights tab
            </button>
          ) : (
            'Insights tab'
          )}
          .
        </p>
        {!insights ? (
          <p className="hint">Generating insights from your latest nutrition data...</p>
        ) : (
          <div className="nutritionInsightsGrid">
            <div>
              <h3>Highlights</h3>
              {insights.achievements.length ? (
                <ul>
                  {insights.achievements.map((item) => (
                    <li key={`a-${item}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No highlights yet.</p>
              )}
            </div>
            <div>
              <h3>Potential concerns</h3>
              {insights.concerns.length ? (
                <ul>
                  {insights.concerns.map((item) => (
                    <li key={`c-${item}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No major concerns detected.</p>
              )}
            </div>
            <div>
              <h3>Macro balance</h3>
              <p>Protein: {insights.macroBalance.protein}</p>
              <p>Carbs: {insights.macroBalance.carbs}</p>
              <p>Fats: {insights.macroBalance.fats}</p>
            </div>
            <div>
              <h3>Improvement suggestions</h3>
              {insights.suggestions.length ? (
                <ul>
                  {insights.suggestions.map((item) => (
                    <li key={`s-${item}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No suggestions right now.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="card cardWide">
        <h2>Nutrition preferences</h2>
        <p className="hint">
          Dietary preferences and restrictions from your health profile are reused — add or update
          nutrition-specific details below, then save.
        </p>
        <div className="nutritionReuse">
          <p>
            <strong>Preferences:</strong> {healthPrefs.length ? healthPrefs.join(', ') : '—'}
          </p>
          <p>
            <strong>Restrictions:</strong> {healthRestrictions.length ? healthRestrictions.join(', ') : '—'}
          </p>
        </div>
        <div className="formGrid">
          <label>
            Cuisine preferences
            <input value={cuisines} onChange={(e) => setCuisines(e.target.value)} disabled={busy} />
          </label>
          <label>
            Disliked ingredients
            <input value={disliked} onChange={(e) => setDisliked(e.target.value)} disabled={busy} />
          </label>
          <label>
            Daily calorie target (kcal)
            <input type="number" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} disabled={busy} />
          </label>
          <label>
            Meals per day
            <input type="number" min={1} max={6} value={mealsPerDay} onChange={(e) => setMealsPerDay(e.target.value)} disabled={busy} />
          </label>
          <label>
            Snacks per day
            <input type="number" min={0} max={4} value={snacksPerDay} onChange={(e) => setSnacksPerDay(e.target.value)} disabled={busy} />
          </label>
          <label>
            Protein target (g/day)
            <input type="number" min={0} value={macroProtein} onChange={(e) => setMacroProtein(e.target.value)} disabled={busy} />
          </label>
          <label>
            Carbs target (g/day)
            <input type="number" min={0} value={macroCarbs} onChange={(e) => setMacroCarbs(e.target.value)} disabled={busy} />
          </label>
          <label>
            Fats target (g/day)
            <input type="number" min={0} value={macroFats} onChange={(e) => setMacroFats(e.target.value)} disabled={busy} />
          </label>
        </div>
        <fieldset className="profileSection mealTimesFieldset">
          <legend>Preferred meal times (UTC)</legend>
          <div className="formGrid">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((slot) => (
              <label key={slot}>
                {slot}
                <input
                  type="time"
                  value={mealTimes[slot]}
                  disabled={busy}
                  onChange={(e) =>
                    setMealTimes((prev) => ({ ...prev, [slot]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <button type="button" className="secondary" onClick={() => void applySuggested()} disabled={busy}>
            Use suggested targets
          </button>
          <button type="button" onClick={() => void saveNutrition()} disabled={busy}>
            Save preferences
          </button>
        </div>
      </section>

      <section className="card cardWide">
        <h2>Generate meal plan</h2>
        <div className="row">
          <label>
            Start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy} />
          </label>
          <label>
            Duration
            <select value={duration} onChange={(e) => setDuration(e.target.value as 'daily' | 'weekly')} disabled={busy}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <button type="button" onClick={() => void generateMealPlan(false)} disabled={busy}>
            Generate
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void generateMealPlan(true)}
            disabled={busy || !selectedPlanId}
            title="Create a new plan version using current preferences"
          >
            Regenerate plan
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setShoppingModalOpen(true)}
            disabled={!shoppingLists.length}
          >
            View shopping lists
          </button>
        </div>
      </section>

      <MealPlanDetail
        accessToken={accessToken}
        planId={selectedPlanId}
        plans={mealPlans}
        busy={busy}
        setBusy={setBusy}
        setMessage={setMessage}
        setError={setError}
        onPlanChange={setSelectedPlanId}
        onRefreshPlans={loadMealPlans}
        onRefreshAnalytics={refreshAnalytics}
        onRegeneratePlan={(planStart, planDuration) =>
          void generateMealPlan(true, { startDate: planStart, duration: planDuration })
        }
        onShoppingListCreated={(listId) => {
          setSelectedListId(listId)
          setShoppingModalOpen(true)
          void loadShoppingLists()
        }}
      />

      <section className="card cardWide">
        <h2>Recipe catalog</h2>
        <p className="hint">
          Search the seeded recipe database by name, cuisine, meal type, ingredients, prep time,
          calories, macros, and dietary tags. Open any result for full details, serving scale, and AI
          substitution suggestions.
        </p>
        <button type="button" className="secondary" onClick={() => setRecipeSearchOpen(true)}>
          Search recipes
        </button>
      </section>

      <ShoppingListPanel
        accessToken={accessToken}
        lists={shoppingLists}
        selectedListId={selectedListId}
        onSelectList={setSelectedListId}
        onRefreshLists={loadShoppingLists}
        isOpen={shoppingModalOpen}
        onClose={() => setShoppingModalOpen(false)}
        busy={busy}
        setBusy={setBusy}
        setMessage={setMessage}
        setError={setError}
      />

      <RecipeSearchModal
        accessToken={accessToken}
        isOpen={recipeSearchOpen}
        onClose={() => setRecipeSearchOpen(false)}
        profileRestrictions={profileRestrictionTags}
        setError={setError}
      />
    </div>
  )
}
