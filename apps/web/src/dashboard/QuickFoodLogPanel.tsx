import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/apiClient'

type RecipeHit = {
  id: string
  title: string
  meal: string
  nutrition?: { calories?: number; protein?: number }
}

type RecentLog = {
  id: string
  title: string
  date: string
  nutrition: { calories?: number; protein?: number }
}

type Props = {
  accessToken: string
  busy?: boolean
  onLogged: () => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

export function QuickFoodLogPanel({
  accessToken,
  busy,
  onLogged,
  setMessage,
  setError,
}: Props) {
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [recipeId, setRecipeId] = useState('')
  const [servings, setServings] = useState('1')
  const [mealType, setMealType] = useState('snack')
  const [ingredientName, setIngredientName] = useState('')
  const [ingredientQty, setIngredientQty] = useState('100')
  const [mode, setMode] = useState<'recipe' | 'ingredient'>('recipe')
  const [hits, setHits] = useState<RecipeHit[]>([])
  const [recent, setRecent] = useState<RecentLog[]>([])
  const [saving, setSaving] = useState(false)

  const loadRecent = useCallback(async () => {
    try {
      const body = await apiGet<RecentLog[]>('/food-log/recent?limit=6', accessToken)
      if (Array.isArray(body)) setRecent(body)
    } catch {
      /* optional */
    }
  }, [accessToken])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (mode !== 'recipe' || query.trim().length < 2) {
      setHits([])
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const body = await apiGet<RecipeHit[]>(
            `/recipes?q=${encodeURIComponent(query.trim())}&limit=8`,
            accessToken,
          )
          if (Array.isArray(body)) setHits(body)
        } catch {
          setHits([])
        }
      })()
    }, 300)
    return () => window.clearTimeout(t)
  }, [query, mode, accessToken])

  function selectRecipe(r: RecipeHit) {
    setRecipeId(r.id)
    setTitle(r.title)
    setQuery(r.title)
    setHits([])
  }

  async function submitLog(payload: Record<string, unknown>) {
    setSaving(true)
    setError('')
    try {
      await apiPost('/food-log/quick', accessToken, payload)
      setMessage('Food logged to today’s intake')
      setTitle('')
      setQuery('')
      setRecipeId('')
      setIngredientName('')
      onLogged()
      await loadRecent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log food')
    } finally {
      setSaving(false)
    }
  }

  async function logManual() {
    const label = title.trim() || (mode === 'recipe' ? query.trim() : ingredientName.trim())
    if (!label) {
      setError('Enter a title or pick a recipe')
      return
    }
    if (mode === 'recipe') {
      if (!recipeId) {
        setError('Select a recipe from search results')
        return
      }
      await submitLog({
        title: label,
        mealType,
        recipeId,
        servings: Number(servings) || 1,
      })
      return
    }
    const qty = Number(ingredientQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a valid ingredient amount in grams')
      return
    }
    await submitLog({
      title: label,
      mealType,
      servings: 1,
      ingredients: [{ name: ingredientName.trim(), quantity: qty, unit: 'gram' }],
    })
  }

  const disabled = busy || saving

  return (
    <section className="card quickFoodLog">
      <h2>Quick food log</h2>
      <p className="hint">Log food outside your meal plan — macros come from the nutrition database.</p>

      <div className="chipRow">
        <button
          type="button"
          className={mode === 'recipe' ? '' : 'secondary'}
          onClick={() => setMode('recipe')}
          disabled={disabled}
        >
          From recipe
        </button>
        <button
          type="button"
          className={mode === 'ingredient' ? '' : 'secondary'}
          onClick={() => setMode('ingredient')}
          disabled={disabled}
        >
          Single ingredient
        </button>
      </div>

      <div className="formGrid">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} />
        </label>
        <label>
          Meal type
          <select value={mealType} onChange={(e) => setMealType(e.target.value)} disabled={disabled}>
            <option value="breakfast">breakfast</option>
            <option value="lunch">lunch</option>
            <option value="dinner">dinner</option>
            <option value="snack">snack</option>
          </select>
        </label>
      </div>

      {mode === 'recipe' ? (
        <>
          <label>
            Search recipes
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setRecipeId('')
              }}
              disabled={disabled}
              placeholder="e.g. chicken salad"
            />
          </label>
          {hits.length > 0 ? (
            <ul className="quickLogHits">
              {hits.map((r) => (
                <li key={r.id}>
                  <button type="button" className="secondary" onClick={() => selectRecipe(r)}>
                    {r.title}
                    {r.nutrition?.calories != null ? ` · ${r.nutrition.calories} kcal` : ''}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label>
            Servings
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              disabled={disabled}
            />
          </label>
        </>
      ) : (
        <div className="formGrid">
          <label>
            Ingredient
            <input
              value={ingredientName}
              onChange={(e) => setIngredientName(e.target.value)}
              disabled={disabled}
              placeholder="e.g. banana"
            />
          </label>
          <label>
            Amount (g)
            <input
              type="number"
              min={1}
              value={ingredientQty}
              onChange={(e) => setIngredientQty(e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      )}

      <div className="row">
        <button type="button" onClick={() => void logManual()} disabled={disabled}>
          Log food
        </button>
      </div>

      {recent.length > 0 ? (
        <>
          <h3 className="quickLogRecentTitle">Recent logs</h3>
          <ul className="quickLogHits">
            {recent.map((r) => (
              <li key={r.id}>
                <span>
                  {r.title}
                  {r.nutrition?.calories != null ? ` · ${r.nutrition.calories} kcal` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
