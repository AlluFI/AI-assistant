import { useCallback, useEffect, useMemo, useState } from 'react'
import { NutritionCharts } from './NutritionCharts'
import { MealPhotoLog } from './MealPhotoLog'
import { NutritionInsightsSection } from './NutritionInsightsSection'
import { MealPlanDetail } from './MealPlanDetail'
import { PastMealPlansModal } from './PastMealPlansModal'
import { RecipeCommunityPanel } from './RecipeCommunityPanel'
import { RecipeSearchModal } from './RecipeSearchModal'
import { ShoppingListPanel } from './ShoppingListPanel'
import {
  buildPreferredMealTimesPayload,
  formatMealTimeSlotLabel,
  mergeMealTimesForSnackCount,
  parsePreferredMealTimes,
  preferredMealTimeSlots,
} from './nutritionFormUtils'
import type {
  DailyAnalytics,
  MealPlanListItem,
  NutritionInsights,
  ShoppingList,
  TrendPoint,
  WeeklyAnalytics,
} from './types'
import { apiGet, apiPatch, apiPost } from '../lib/apiClient'
import './nutrition.css'

type NutritionPanelProps = {
  accessToken: string
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
  onOpenWellnessInsights?: () => void
  moderationInAdminTab?: boolean
  onOpenAdmin?: () => void
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
  moderationInAdminTab,
  onOpenAdmin,
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
  const [mealTimes, setMealTimes] = useState<Record<string, string>>(() =>
    parsePreferredMealTimes(null, 0),
  )
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [weeklyAnalytics, setWeeklyAnalytics] = useState<WeeklyAnalytics | null>(null)
  const [mealPlans, setMealPlans] = useState<MealPlanListItem[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [mealPlanRefreshKey, setMealPlanRefreshKey] = useState(0)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState<'daily' | 'weekly'>('daily')
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyAnalytics | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [trendDays, setTrendDays] = useState(30)
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [shoppingModalOpen, setShoppingModalOpen] = useState(false)
  const [recipeSearchOpen, setRecipeSearchOpen] = useState(false)
  const [pastPlansModalOpen, setPastPlansModalOpen] = useState(false)
  const [insights, setInsights] = useState<NutritionInsights | null>(null)
  const [targetRationale, setTargetRationale] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      const body = await apiGet<CombinedProfile>('/nutrition/profile', accessToken)
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
      setMealTimes(
        parsePreferredMealTimes(np?.preferredMealTimes, np?.snacksPerDay ?? 0),
      )
    } catch {
      setError('Failed to load nutrition profile')
    }
  }, [accessToken, setError])

  function nutritionPayload() {
    const meals = Math.round(Number(mealsPerDay))
    const snacks = Math.round(Number(snacksPerDay))
    const calRaw = calorieTarget.trim()
    const cal = calRaw ? Math.round(Number(calRaw)) : NaN

    const pRaw = macroProtein.trim()
    const cRaw = macroCarbs.trim()
    const fRaw = macroFats.trim()
    const p = pRaw ? Math.round(Number(pRaw)) : undefined
    const c = cRaw ? Math.round(Number(cRaw)) : undefined
    const f = fRaw ? Math.round(Number(fRaw)) : undefined

    const payload: Record<string, unknown> = {
      cuisinePreferences: cuisines.split(',').map((s) => s.trim()).filter(Boolean),
      dislikedIngredients: disliked.split(',').map((s) => s.trim()).filter(Boolean),
      mealsPerDay: Number.isFinite(meals) ? Math.min(6, Math.max(1, meals)) : 3,
      snacksPerDay: Number.isFinite(snacks) ? Math.min(4, Math.max(0, snacks)) : 0,
      preferredMealTimes: buildPreferredMealTimesPayload(
        mealTimes,
        Number.isFinite(snacks) ? Math.min(4, Math.max(0, snacks)) : 0,
      ),
    }

    if (Number.isFinite(cal) && cal >= 800 && cal <= 6000) {
      payload.calorieTarget = cal
      payload.calorieTargetSource = 'manual'
    }

    if (p != null || c != null || f != null) {
      payload.macroTargets = {
        protein: p ?? 0,
        carbs: c ?? 0,
        fats: f ?? 0,
      }
    }

    return payload
  }

  const loadMealPlans = useCallback(async () => {
    try {
      const body = await apiGet<MealPlanListItem[]>('/meal-plans', accessToken)
      if (Array.isArray(body)) {
        setMealPlans(body)
        const activeToday = body.filter((p) => p.coversToday)
        setSelectedPlanId((prev) => {
          if (prev && activeToday.some((p) => p.id === prev)) return prev
          return activeToday[0]?.id ?? null
        })
      }
    } catch {
      /* keep previous list */
    }
  }, [accessToken])

  const loadDailyAnalytics = useCallback(async () => {
    try {
      setDailyAnalytics(
        await apiGet<DailyAnalytics>(`/nutrition-analytics/daily?date=${dailyDate}`, accessToken),
      )
    } catch {
      /* optional refresh */
    }
  }, [accessToken, dailyDate])

  const loadWeeklyAnalytics = useCallback(async () => {
    try {
      setWeeklyAnalytics(
        await apiGet<WeeklyAnalytics>(
          `/nutrition-analytics/weekly?end=${dailyDate}`,
          accessToken,
        ),
      )
    } catch {
      /* optional refresh */
    }
  }, [accessToken, dailyDate])

  const loadTrend = useCallback(async () => {
    try {
      setTrend(
        await apiGet<TrendPoint[]>(`/nutrition-analytics/trend?days=${trendDays}`, accessToken),
      )
    } catch {
      /* optional refresh */
    }
  }, [accessToken, trendDays])

  const loadInsights = useCallback(async () => {
    try {
      setInsights(await apiGet<NutritionInsights>('/nutrition-analytics/insights', accessToken))
    } catch {
      /* optional refresh */
    }
  }, [accessToken])

  const loadShoppingLists = useCallback(async () => {
    try {
      const body = await apiGet<ShoppingList[]>('/shopping-lists', accessToken)
      const list = Array.isArray(body) ? body : []
      setShoppingLists(list)
      setSelectedListId((prev) => {
        if (prev && list.some((l) => l.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch {
      /* keep previous lists */
    }
  }, [accessToken])

  useEffect(() => {
    void loadProfile()
    void loadMealPlans()
    void loadInsights()
    void loadShoppingLists()
  }, [loadProfile, loadMealPlans, loadInsights, loadShoppingLists])

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
      const calRaw = calorieTarget.trim()
      if (calRaw) {
        const cal = Math.round(Number(calRaw))
        if (!Number.isFinite(cal) || cal < 800 || cal > 6000) {
          setError('Daily calorie target must be between 800 and 6000 kcal.')
          return
        }
      }
      await apiPatch('/nutrition/profile', accessToken, nutritionPayload())
      setMessage('Nutrition preferences saved')
      await loadProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save nutrition preferences')
    } finally {
      setBusy(false)
    }
  }

  async function applySuggested() {
    setBusy(true)
    setError('')
    try {
      const body = await apiPost<{
        calorieTarget?: number
        macroTargets?: { protein?: number; carbs?: number; fats?: number }
        recommendationRationale?: string | null
      }>('/nutrition/profile/apply-suggested-targets', accessToken)
      if (body.calorieTarget) setCalorieTarget(String(body.calorieTarget))
      if (body.macroTargets) {
        setMacroProtein(String(body.macroTargets.protein ?? ''))
        setMacroCarbs(String(body.macroTargets.carbs ?? ''))
        setMacroFats(String(body.macroTargets.fats ?? ''))
      }
      setTargetRationale(body.recommendationRationale?.trim() || null)
      setMessage('Applied calorie and macro targets from your health profile')
      await loadProfile()
      await loadDailyAnalytics()
    } catch {
      setError('Could not apply suggested targets')
    } finally {
      setBusy(false)
    }
  }

  async function applyAiRecommended() {
    setBusy(true)
    setError('')
    try {
      const body = await apiPost<{
        calorieTarget?: number
        macroTargets?: { protein?: number; carbs?: number; fats?: number }
        calorieTargetSource?: string
        recommendationRationale?: string | null
      }>('/nutrition/profile/apply-ai-targets', accessToken)
      if (body.calorieTarget) setCalorieTarget(String(body.calorieTarget))
      if (body.macroTargets) {
        setMacroProtein(String(body.macroTargets.protein ?? ''))
        setMacroCarbs(String(body.macroTargets.carbs ?? ''))
        setMacroFats(String(body.macroTargets.fats ?? ''))
      }
      setTargetRationale(body.recommendationRationale?.trim() || null)
      const source = body.calorieTargetSource === 'ai_suggested' ? 'AI' : 'formula'
      setMessage(`Applied ${source} calorie and macro recommendations from your health profile`)
      await loadProfile()
      await loadDailyAnalytics()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not apply AI recommendations',
      )
    } finally {
      setBusy(false)
    }
  }

  const snackCount = useMemo(() => {
    const n = Math.round(Number(snacksPerDay))
    return Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0
  }, [snacksPerDay])

  const mealTimeSlots = useMemo(
    () => preferredMealTimeSlots(snackCount),
    [snackCount],
  )

  useEffect(() => {
    setMealTimes((prev) => mergeMealTimesForSnackCount(prev, snackCount))
  }, [snackCount])

  async function persistNutritionPrefs() {
    const calRaw = calorieTarget.trim()
    if (calRaw) {
      const cal = Math.round(Number(calRaw))
      if (!Number.isFinite(cal) || cal < 800 || cal > 6000) {
        throw new Error('Set a daily calorie target between 800 and 6000 kcal, or clear the field.')
      }
    }
    await apiPatch('/nutrition/profile', accessToken, nutritionPayload())
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
      const body = await apiPost<{ message?: string; mealPlan?: { id: string } }>(
        '/meal-plans/generate',
        accessToken,
        { duration: planDuration, startDate: planStart, version: '1.0' },
      )
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

  const activePlansToday = useMemo(
    () => mealPlans.filter((p) => p.coversToday),
    [mealPlans],
  )

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
        accessToken={accessToken}
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
          Preview below. Wellness and nutrition insights are grouped on the{' '}
          {onOpenWellnessInsights ? (
            <button type="button" className="linkButton" onClick={onOpenWellnessInsights}>
              Insights tab
            </button>
          ) : (
            'Insights tab'
          )}
          .
        </p>
        <NutritionInsightsSection insights={insights} loading={!insights} compact />
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
            {mealTimeSlots.map((slot) => (
              <label key={slot}>
                {formatMealTimeSlotLabel(slot)}
                <input
                  type="time"
                  value={mealTimes[slot] ?? ''}
                  disabled={busy}
                  onChange={(e) =>
                    setMealTimes((prev) => ({ ...prev, [slot]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row nutritionTargetActions">
          <button type="button" className="secondary" onClick={() => void applySuggested()} disabled={busy}>
            Use formula targets
          </button>
          <button type="button" className="secondary" onClick={() => void applyAiRecommended()} disabled={busy}>
            AI recommend targets
          </button>
          <button type="button" className="secondary" onClick={() => void saveNutrition()} disabled={busy}>
            Save preferences
          </button>
        </div>
        {targetRationale ? (
          <p className="hint nutritionTargetRationale" role="status">
            {targetRationale}
          </p>
        ) : null}
      </section>

      <section className="card cardWide">
        <h2>Generate meal plan</h2>
        {activePlansToday.length === 0 ? (
          <p className="hint mealPlanTodayEmpty">
            No meal plan for today. Generate a new plan below, or browse past plans in{' '}
            <strong>Meal plan detail</strong> to re-apply an older one.
          </p>
        ) : (
          <p className="hint">
            Active for today:{' '}
            {activePlansToday.map((p) => `${p.duration} (${p.startDate})`).join(', ')}
          </p>
        )}
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
            disabled={busy || !selectedPlanId || !activePlansToday.some((p) => p.id === selectedPlanId)}
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
        plans={activePlansToday}
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
        onOpenPastPlans={() => setPastPlansModalOpen(true)}
        refreshKey={mealPlanRefreshKey}
      />

      <RecipeCommunityPanel
        accessToken={accessToken}
        busy={busy}
        setBusy={setBusy}
        setMessage={setMessage}
        setError={setError}
        moderationInAdminTab={moderationInAdminTab}
        onOpenAdmin={onOpenAdmin}
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
        activePlanId={activePlansToday[0]?.id ?? selectedPlanId}
        onMealPlanChanged={() => {
          void loadMealPlans()
          void refreshAnalytics()
          setMealPlanRefreshKey((k) => k + 1)
        }}
        profileRestrictions={profileRestrictionTags}
        setMessage={setMessage}
        setError={setError}
      />

      <PastMealPlansModal
        accessToken={accessToken}
        isOpen={pastPlansModalOpen}
        onClose={() => setPastPlansModalOpen(false)}
        onReapplied={(planId) => {
          setSelectedPlanId(planId)
          void loadMealPlans()
          void refreshAnalytics()
          setMealPlanRefreshKey((k) => k + 1)
        }}
        setMessage={setMessage}
        setError={setError}
        setBusy={setBusy}
        busy={busy}
      />
    </div>
  )
}
