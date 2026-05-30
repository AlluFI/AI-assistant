import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DIETARY_RESTRICTION_OPTIONS } from '../profileFormModel'
import { EnhancedRecipePanel } from './EnhancedNutritionPanels'
import { RecipeCommunityFeedback } from './RecipeCommunityFeedback'
import { RecipeNutritionViz } from './RecipeNutritionViz'
import type { EnhancedRecipeNutrition } from './types'
import { formatDietaryTags, formatPreparationStep } from './recipeDisplay'
import { apiGet, apiPost } from '../lib/apiClient'
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const CUISINES = [
  'Italian',
  'Mexican',
  'Indian',
  'Chinese',
  'Japanese',
  'Thai',
  'Mediterranean',
  'American',
  'French',
  'Middle Eastern',
  'Korean',
  'Vietnamese',
] as const
const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'high-protein',
  'low-carb',
  'balanced',
] as const

type RecipeSummary = {
  id: string
  title: string
  cuisine: string
  meal: string
  servings: number
  summary: string
  time: number
  difficulty_level: string
  relevanceScore?: number
  dietary_tags?: string[]
  nutrition?: { calories?: number; protein?: number; carbs?: number; fats?: number }
  verified?: boolean
  community_score?: number | null
  community_rating_count?: number
}

type RecipeDetail = RecipeSummary & {
  ingredients: Array<{ id: string; name: string; quantity: number }>
  preparation: unknown
  dietary_tags?: string[]
  source?: string
  img?: string
  enhanced_nutrition?: EnhancedRecipeNutrition
}

type RecipeScaleData = {
  servings: number
  scaledIngredients: Array<{ id?: string; name: string; quantity: number; unit?: string }>
  nutrition: { calories: number; protein: number; carbs: number; fats: number }
  perServing: { calories: number; protein: number; carbs: number; fats: number }
}

type SubstituteResult = {
  sourceIngredient: string
  usedFallback: boolean
  alternatives: Array<{
    ingredient: string
    reason: string
    quantity?: number
    unit?: string
  }>
}

type Props = {
  accessToken: string
  isOpen: boolean
  onClose: () => void
  profileRestrictions?: string[]
  setError: (v: string) => void
}

export function RecipeSearchModal({
  accessToken,
  isOpen,
  onClose,
  profileRestrictions = [],
  setError,
}: Props) {
  const [view, setView] = useState<'search' | 'detail'>('search')
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [meal, setMeal] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [maxPrepMinutes, setMaxPrepMinutes] = useState('')
  const [maxCalories, setMaxCalories] = useState('')
  const [minProtein, setMinProtein] = useState('')
  const [minCarbs, setMinCarbs] = useState('')
  const [minFats, setMinFats] = useState('')
  const [minIron, setMinIron] = useState('')
  const [minFiber, setMinFiber] = useState('')
  const [minVitaminD, setMinVitaminD] = useState('')
  const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([])
  const [searchRestrictions, setSearchRestrictions] = useState<string[]>([])
  const [applyProfileFilters, setApplyProfileFilters] = useState(true)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<RecipeSummary[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const [detailLoading, setDetailLoading] = useState(false)
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
  const [servings, setServings] = useState(1)
  const [scaleLoading, setScaleLoading] = useState(false)
  const [scaleData, setScaleData] = useState<RecipeScaleData | null>(null)

  const [substituteIngredient, setSubstituteIngredient] = useState('')
  const [substituteReason, setSubstituteReason] = useState('')
  const [substituteLoading, setSubstituteLoading] = useState(false)
  const [substituteResult, setSubstituteResult] = useState<SubstituteResult | null>(null)
  const modalRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const resetDetail = useCallback(() => {
    setRecipe(null)
    setScaleData(null)
    setSubstituteIngredient('')
    setSubstituteReason('')
    setSubstituteResult(null)
  }, [])

  const close = useCallback(() => {
    setView('search')
    resetDetail()
    onClose()
  }, [onClose, resetDetail])

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (view === 'detail') {
          setView('search')
          resetDetail()
        } else {
          close()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [isOpen, view, close, resetDetail])

  const normalizedProfileRestrictions = useMemo(() => {
    if (Array.isArray(profileRestrictions)) {
      return profileRestrictions.filter((t) => typeof t === 'string' && t.trim())
    }
    return []
  }, [profileRestrictions])

  const toggleSearchRestriction = useCallback((value: string, checked: boolean) => {
    setSearchRestrictions((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    )
  }, [])

  const toggleDietaryTag = useCallback((value: string, checked: boolean) => {
    setSelectedDietaryTags((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    )
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setSearchRestrictions((prev) => {
      if (prev.length) return prev
      return applyProfileFilters ? [...normalizedProfileRestrictions] : []
    })
  }, [isOpen, applyProfileFilters, normalizedProfileRestrictions])

  async function runSearch() {
    setSearching(true)
    setError('')
    try {
      const params = new URLSearchParams()
      const q = query.trim()
      if (q) params.set('q', q)
      if (cuisine.trim()) params.set('cuisine', cuisine.trim())
      if (meal) params.set('meal', meal)
      if (ingredient.trim()) params.set('ingredient', ingredient.trim())
      if (maxPrepMinutes) params.set('maxPrepMinutes', maxPrepMinutes)
      if (maxCalories) params.set('maxCalories', maxCalories)
      if (minProtein) params.set('minProtein', minProtein)
      if (minCarbs) params.set('minCarbs', minCarbs)
      if (minFats) params.set('minFats', minFats)
      if (minIron) params.set('minIron', minIron)
      if (minFiber) params.set('minFiber', minFiber)
      if (minVitaminD) params.set('minVitaminD', minVitaminD)
      for (const tag of selectedDietaryTags) {
        if (tag.trim()) params.append('dietaryTags', tag.trim())
      }
      params.set('limit', '25')
      const allergyTerms = new Set<string>()
      for (const tag of searchRestrictions) {
        if (tag.trim()) allergyTerms.add(tag.trim())
      }
      if (applyProfileFilters) {
        for (const tag of normalizedProfileRestrictions) {
          if (tag.trim()) allergyTerms.add(tag.trim())
        }
      }
      for (const tag of allergyTerms) {
        params.append('allergies', tag)
      }
      const body = await apiGet<RecipeSummary[]>(`/recipes?${params.toString()}`, accessToken)
      setResults(Array.isArray(body) ? body : [])
      setHasSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recipe search failed')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function openRecipe(recipeId: string) {
    setView('detail')
    setDetailLoading(true)
    setError('')
    resetDetail()
    try {
      const data = await apiGet<RecipeDetail>(`/recipes/${recipeId}`, accessToken)
      setRecipe(data)
      const initial = Math.max(1, data.servings)
      setServings(initial)
      void loadScale(data.id, initial)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load recipe')
      setView('search')
    } finally {
      setDetailLoading(false)
    }
  }

  async function loadScale(recipeId: string, nextServings: number) {
    setScaleLoading(true)
    try {
      const body = await apiPost<RecipeScaleData>('/recipes/scale', accessToken, {
        recipeId,
        servings: nextServings,
      })
      setScaleData(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not scale recipe')
      setScaleData(null)
    } finally {
      setScaleLoading(false)
    }
  }

  async function requestSubstitution() {
    if (!recipe || !substituteIngredient.trim()) return
    setSubstituteLoading(true)
    setSubstituteResult(null)
    setError('')
    try {
      const body = await apiPost<SubstituteResult>(
        `/recipes/${recipe.id}/substitute-ingredient`,
        accessToken,
        {
          ingredient: substituteIngredient.trim(),
          reason: substituteReason.trim() || undefined,
          limit: 3,
        },
      )
      setSubstituteResult(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Substitution failed')
    } finally {
      setSubstituteLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="consentModalBackdrop shoppingListBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-search-title"
      onClick={() => close()}
    >
      <section
        ref={modalRef}
        className="card cardWide shoppingListModalCard recipeSearchModalCard"
        onClick={(e) => e.stopPropagation()}
        aria-describedby="recipe-search-desc"
      >
        <p id="recipe-search-desc" className="srOnly">
          Search and filter recipes from the catalog. Select a recipe to view full details,
          scale servings, or request AI ingredient substitutions.
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          className="secondary shoppingModalCloseIcon"
          aria-label="Close recipe search"
          onClick={() => close()}
        >
          ×
        </button>

        {view === 'search' ? (
          <>
            <div className="shoppingListHead">
              <h2 id="recipe-search-title">Search recipes</h2>
            </div>
            <div className="formGrid recipeSearchFilters">
              <label>
                Search
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. high protein lunch"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch()
                  }}
                />
              </label>
              <label>
                Cuisine
                <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
                  <option value="">Any</option>
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Meal
                <select value={meal} onChange={(e) => setMeal(e.target.value)}>
                  <option value="">Any</option>
                  {MEALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="profileSection recipeSearchDietaryTags">
              <legend>Dietary tags (match all selected)</legend>
              <p className="hint">
                Tap one or more tags. Only recipes that include every selected tag are shown.
              </p>
              <div className="recipeSearchTagChips" role="group" aria-label="Dietary tags">
                {DIETARY_TAGS.map((tag) => {
                  const selected = selectedDietaryTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`recipeSearchChip${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => toggleDietaryTag(tag, !selected)}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <fieldset className="profileSection recipeSearchRestrictions">
              <legend>Exclude recipes containing (dietary restrictions)</legend>
              <p className="hint">
                Tap restrictions to exclude recipes with matching ingredients.
              </p>
              <div className="recipeSearchTagChips" role="group" aria-label="Dietary restrictions">
                {DIETARY_RESTRICTION_OPTIONS.map((o) => {
                  const selected = searchRestrictions.includes(o.value)
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={`recipeSearchChip${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => toggleSearchRestriction(o.value, !selected)}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <label className="toggleLabel recipeSearchProfileToggle">
              <input
                type="checkbox"
                checked={applyProfileFilters}
                onChange={(e) => setApplyProfileFilters(e.target.checked)}
              />
              Also apply dietary restrictions from my health profile
              {normalizedProfileRestrictions.length
                ? ` (${normalizedProfileRestrictions.join(', ')})`
                : ''}
            </label>
            <details className="recipeSearchMoreFilters">
              <summary>More filters (ingredient, prep time, macros, micronutrients)</summary>
              <div className="formGrid recipeSearchFilters">
              <label>
                Ingredient
                <input
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  placeholder="e.g. salmon"
                />
              </label>
              <label>
                Max prep (min)
                <input
                  type="number"
                  min={1}
                  value={maxPrepMinutes}
                  onChange={(e) => setMaxPrepMinutes(e.target.value)}
                />
              </label>
              <label>
                Max calories / serving
                <input
                  type="number"
                  min={1}
                  value={maxCalories}
                  onChange={(e) => setMaxCalories(e.target.value)}
                />
              </label>
              <label>
                Min protein / serving (g)
                <input
                  type="number"
                  min={0}
                  value={minProtein}
                  onChange={(e) => setMinProtein(e.target.value)}
                />
              </label>
              <label>
                Min carbs / serving (g)
                <input
                  type="number"
                  min={0}
                  value={minCarbs}
                  onChange={(e) => setMinCarbs(e.target.value)}
                />
              </label>
              <label>
                Min fats / serving (g)
                <input
                  type="number"
                  min={0}
                  value={minFats}
                  onChange={(e) => setMinFats(e.target.value)}
                />
              </label>
              <label>
                Min iron / serving (mg, estimated)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={minIron}
                  onChange={(e) => setMinIron(e.target.value)}
                />
              </label>
              <label>
                Min fiber / serving (g, estimated)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={minFiber}
                  onChange={(e) => setMinFiber(e.target.value)}
                />
              </label>
              <label>
                Min vitamin D / serving (mcg, estimated)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={minVitaminD}
                  onChange={(e) => setMinVitaminD(e.target.value)}
                />
              </label>
              </div>
            </details>
            <div className="row">
              <button type="button" onClick={() => void runSearch()} disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            {hasSearched && !searching && results.length === 0 ? (
              <p className="hint">No recipes matched. Try a broader search or fewer filters.</p>
            ) : null}
            <ul className="recipeSearchResults">
              {results.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="recipeSearchResultBtn"
                    onClick={() => void openRecipe(row.id)}
                  >
                    <span className="recipeSearchResultTitle">{row.title}</span>
                    <span className="hint">
                      {row.cuisine} · {row.meal} · {row.time} min
                      {formatDietaryTags(row.dietary_tags)
                        ? ` · ${formatDietaryTags(row.dietary_tags)}`
                        : ''}
                      {row.nutrition?.calories != null
                        ? ` · ${Math.round(row.nutrition.calories)} kcal/serving`
                        : ''}
                      {row.verified ? ' · Verified' : ''}
                      {row.community_score != null
                        ? ` · ★${row.community_score}`
                        : ''}
                      {row.relevanceScore != null
                        ? ` · match ${Math.round(row.relevanceScore * 100)}%`
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setView('search')
                  resetDetail()
                }}
              >
                ← Back to results
              </button>
              <h2 id="recipe-search-title" style={{ margin: 0 }}>
                {recipe?.title ?? 'Recipe'}
              </h2>
            </div>
            {detailLoading ? (
              <p className="hint loadingPulse">Loading recipe…</p>
            ) : recipe ? (
              <>
                <div className="row">
                  <label>
                    Servings
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={servings}
                      onChange={(e) => {
                        const next = Math.max(1, Number(e.target.value || 1))
                        setServings(next)
                        void loadScale(recipe.id, next)
                      }}
                    />
                  </label>
                </div>
                <p className="hint">
                  {recipe.cuisine} · {recipe.meal} · {recipe.time} min · base serves{' '}
                  {recipe.servings}
                </p>
                {recipe.summary ? <p className="hint">{recipe.summary}</p> : null}
                {formatDietaryTags(recipe.dietary_tags) ? (
                  <p className="hint">
                    <strong>Tags:</strong> {formatDietaryTags(recipe.dietary_tags)}
                  </p>
                ) : null}
                {recipe.source ? (
                  <p className="hint">
                    <strong>Source:</strong> {recipe.source}
                  </p>
                ) : null}
                {recipe.difficulty_level ? (
                  <p className="hint">
                    <strong>Difficulty:</strong> {recipe.difficulty_level}
                  </p>
                ) : null}
                {recipe.img ? (
                  <p className="hint recipeDetailImage">
                    <img src={recipe.img} alt="" loading="lazy" />
                  </p>
                ) : null}
                {scaleLoading ? (
                  <p className="hint loadingPulse">Scaling nutrition…</p>
                ) : scaleData ? (
                  <>
                    {scaleData.servings > 1 ? (
                      <RecipeNutritionViz
                        title={`Total nutrition (${scaleData.servings} servings)`}
                        nutrition={scaleData.nutrition}
                        footnote="Summed from scaled ingredient quantities."
                      />
                    ) : null}
                    <RecipeNutritionViz
                      title="Nutrition per serving"
                      nutrition={scaleData.perServing}
                      footnote="Calculated from recipe ingredients (function-calling nutrition path)."
                    />
                  </>
                ) : recipe.nutrition ? (
                  <RecipeNutritionViz
                    title="Nutrition per serving"
                    nutrition={{
                      calories: recipe.nutrition.calories ?? 0,
                      protein: recipe.nutrition.protein ?? 0,
                      carbs: recipe.nutrition.carbs ?? 0,
                      fats: recipe.nutrition.fats ?? 0,
                    }}
                    footnote="Calculated from recipe ingredients."
                  />
                ) : null}

                {recipe.enhanced_nutrition ? (
                  <EnhancedRecipePanel data={recipe.enhanced_nutrition} />
                ) : null}

                <h3>Ingredients</h3>
                <ul>
                  {(scaleData?.scaledIngredients ?? recipe.ingredients).map((item) => (
                    <li key={`${item.id}-${item.name}`}>
                      {item.name} — {Math.round(item.quantity)}{' '}
                      {'unit' in item && item.unit === 'milliliter' ? 'ml' : 'g'}
                    </li>
                  ))}
                </ul>

                <h3>Preparation</h3>
                {Array.isArray(recipe.preparation) && recipe.preparation.length ? (
                  <ol>
                    {recipe.preparation.map((step, idx) => (
                      <li key={`prep-${idx}`}>{formatPreparationStep(step, idx)}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="hint">No preparation steps available.</p>
                )}

                <RecipeCommunityFeedback
                  accessToken={accessToken}
                  recipeId={recipe.id}
                  setError={setError}
                  recipeVerified={recipe.verified}
                  communityScore={recipe.community_score}
                  communityRatingCount={recipe.community_rating_count}
                />

                <div className="card recipeSubstituteBlock">
                  <h3 style={{ marginTop: 0 }}>Ingredient substitution</h3>
                  <p className="hint">
                    AI suggests replacements based on your restrictions, dislikes, and a pool of
                    ingredients from the database. Results are suggestions only — they do not
                    modify this recipe automatically.
                  </p>
                  <div className="row">
                    <label>
                      Ingredient to replace
                      <select
                        value={substituteIngredient}
                        onChange={(e) => {
                          setSubstituteIngredient(e.target.value)
                          setSubstituteResult(null)
                        }}
                      >
                        <option value="">Select…</option>
                        {recipe.ingredients.map((ing) => (
                          <option key={ing.id} value={ing.name}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reason (optional)
                      <input
                        value={substituteReason}
                        onChange={(e) => setSubstituteReason(e.target.value)}
                        placeholder="e.g. availability, allergy"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      disabled={substituteLoading || !substituteIngredient}
                      onClick={() => void requestSubstitution()}
                    >
                      {substituteLoading ? 'Suggesting…' : 'Suggest substitutes'}
                    </button>
                  </div>
                  {substituteResult ? (
                    <div className="recipeSubstituteResults">
                      <p className="hint">
                        Alternatives for <strong>{substituteResult.sourceIngredient}</strong>
                        {substituteResult.usedFallback ? ' (deterministic fallback)' : ' (AI)'}:
                      </p>
                      <ul>
                        {substituteResult.alternatives.map((alt) => (
                          <li key={alt.ingredient}>
                            <strong>{alt.ingredient}</strong>
                            {alt.quantity != null
                              ? ` — ${Math.round(alt.quantity)}${alt.unit === 'milliliter' ? ' ml' : ' g'}`
                              : ''}
                            <br />
                            <span className="hint">{alt.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="hint">Recipe not available.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
