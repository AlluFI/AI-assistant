import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDietaryTags, formatPreparationStep } from './recipeDisplay'

const apiBase = import.meta.env.VITE_API_BASE ?? '/api'
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
}

type RecipeDetail = RecipeSummary & {
  ingredients: Array<{ id: string; name: string; quantity: number }>
  preparation: unknown
  dietary_tags?: string[]
  source?: string
  img?: string
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
  const [dietaryTags, setDietaryTags] = useState('')
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

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }),
    [accessToken],
  )

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
      for (const tag of dietaryTags.split(',').map((t) => t.trim()).filter(Boolean)) {
        params.append('dietaryTags', tag)
      }
      params.set('limit', '25')
      if (applyProfileFilters) {
        for (const tag of profileRestrictions) {
          if (tag.trim()) params.append('allergies', tag.trim())
        }
      }
      const res = await fetch(`${apiBase}/recipes?${params.toString()}`, { headers })
      const body = await res.json().catch(() => [])
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Recipe search failed')
      }
      let rows = Array.isArray(body) ? (body as RecipeSummary[]) : []
      const tagFilters = dietaryTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
      if (tagFilters.length && !q) {
        rows = rows.filter((row) => {
          const tags = (row.dietary_tags ?? []).map((t) => t.toLowerCase())
          return tagFilters.every((t) => tags.includes(t))
        })
      }
      setResults(rows)
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
      const res = await fetch(`${apiBase}/recipes/${recipeId}`, { headers })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Could not load recipe')
      }
      const data = body as RecipeDetail
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
      const res = await fetch(`${apiBase}/recipes/scale`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipeId, servings: nextServings }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Could not scale recipe')
      }
      setScaleData(body as RecipeScaleData)
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
      const res = await fetch(`${apiBase}/recipes/${recipe.id}/substitute-ingredient`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ingredient: substituteIngredient.trim(),
          reason: substituteReason.trim() || undefined,
          limit: 3,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Substitution failed')
      }
      setSubstituteResult(body as SubstituteResult)
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
                Dietary tags
                <input
                  value={dietaryTags}
                  onChange={(e) => setDietaryTags(e.target.value)}
                  placeholder="e.g. vegetarian, high-protein"
                  list="recipe-dietary-tags"
                />
                <datalist id="recipe-dietary-tags">
                  {DIETARY_TAGS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
            </div>
            <label className="toggleLabel recipeSearchProfileToggle">
              <input
                type="checkbox"
                checked={applyProfileFilters}
                onChange={(e) => setApplyProfileFilters(e.target.checked)}
              />
              Exclude recipes with ingredients matching my dietary restrictions
            </label>
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
                    <p>
                      <strong>Total ({scaleData.servings} servings):</strong>{' '}
                      {Math.round(scaleData.nutrition.calories)} kcal · P{' '}
                      {Math.round(scaleData.nutrition.protein)}g · C{' '}
                      {Math.round(scaleData.nutrition.carbs)}g · F{' '}
                      {Math.round(scaleData.nutrition.fats)}g
                    </p>
                    <p>
                      <strong>Per serving:</strong>{' '}
                      {Math.round(scaleData.perServing.calories)} kcal · P{' '}
                      {Math.round(scaleData.perServing.protein)}g · C{' '}
                      {Math.round(scaleData.perServing.carbs)}g · F{' '}
                      {Math.round(scaleData.perServing.fats)}g
                    </p>
                  </>
                ) : recipe.nutrition ? (
                  <p>
                    <strong>Per serving:</strong>{' '}
                    {Math.round(recipe.nutrition.calories ?? 0)} kcal
                  </p>
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
