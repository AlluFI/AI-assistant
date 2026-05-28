import { useCallback, useRef, useState } from 'react'
import { readApiJson } from '../lib/apiJson'

const apiBase = import.meta.env.VITE_API_BASE ?? '/api'

type DetectedFood = {
  name: string
  quantityGrams: number
  confidence?: number
}

type ScanResult = {
  id: string
  status: string
  date: string
  mealType: string | null
  description: string | null
  foods: DetectedFood[]
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fats: number
  } | null
  unmatchedFoods: string[]
  matchedCount: number
  disclaimer: string
}

type Props = {
  accessToken: string
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
  onConfirmed: () => void
}

export function MealPhotoLog({
  accessToken,
  busy,
  setBusy,
  setMessage,
  setError,
  onConfirmed,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mealType, setMealType] = useState('lunch')
  const [preview, setPreview] = useState<string | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)

  const headers = { Authorization: `Bearer ${accessToken}` }

  const onPickFile = useCallback((file: File | null) => {
    setScan(null)
    setError('')
    if (!file) {
      setPreview(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose a JPEG, PNG, or WebP image')
      return
    }
    setPreview(URL.createObjectURL(file))
  }, [setError])

  const analyze = useCallback(async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose a photo first')
      return
    }
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      const q = new URLSearchParams({ date, mealType })
      const res = await fetch(`${apiBase}/meal-photos/analyze?${q}`, {
        method: 'POST',
        headers,
        body: form,
      })
      const body = await readApiJson<ScanResult>(res)
      if (!res.ok) {
        throw new Error(
          (body as unknown as { message?: string }).message ?? 'Analysis failed',
        )
      }
      setScan(body)
      setMessage('Photo analyzed — review and confirm to log calories')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setBusy(false)
    }
  }, [date, headers, mealType, setBusy, setError, setMessage])

  const confirm = useCallback(async () => {
    if (!scan?.id) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/meal-photos/${scan.id}/confirm`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
      const body = await readApiJson<{ message?: string }>(res)
      if (!res.ok) throw new Error('Could not confirm meal')
      setMessage(body.message ?? 'Meal logged from photo')
      setScan(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      onConfirmed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed')
    } finally {
      setBusy(false)
    }
  }, [headers, onConfirmed, scan?.id, setBusy, setError, setMessage])

  return (
    <section className="card mealPhotoCard">
      <h2>Log meal from photo</h2>
      <p className="hint">
        Gemini identifies foods in your photo; calories and macros come from the ingredient
        database after you confirm. The AI does not invent calorie numbers.
      </p>

      <div className="mealPhotoControls">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </label>
        <label>
          Meal
          <select value={mealType} onChange={(e) => setMealType(e.target.value)} disabled={busy}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </label>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
      />

      {preview ? (
        <img src={preview} alt="Meal preview" className="mealPhotoPreview" />
      ) : null}

      <div className="row">
        <button type="button" disabled={busy} onClick={() => void analyze()}>
          Analyze photo
        </button>
        {scan?.status === 'analyzed' ? (
          <button type="button" className="secondary" disabled={busy} onClick={() => void confirm()}>
            Confirm & log intake
          </button>
        ) : null}
      </div>

      {scan ? (
        <div className="mealPhotoResult">
          <p>
            <strong>{scan.description ?? 'Detected meal'}</strong>
          </p>
          <ul className="mealPhotoFoodList">
            {scan.foods.map((f) => (
              <li key={`${f.name}-${f.quantityGrams}`}>
                {f.name} — {f.quantityGrams} g
                {f.confidence != null ? ` (${Math.round(f.confidence * 100)}%)` : ''}
              </li>
            ))}
          </ul>
          {scan.unmatchedFoods.length ? (
            <p className="hint">
              Not in database (excluded from totals): {scan.unmatchedFoods.join(', ')}
            </p>
          ) : null}
          {scan.nutrition ? (
            <p>
              Estimated: <strong>{scan.nutrition.calories} kcal</strong> · P {scan.nutrition.protein}g ·
              C {scan.nutrition.carbs}g · F {scan.nutrition.fats}g
            </p>
          ) : (
            <p className="err">No nutrition could be calculated — try another photo.</p>
          )}
          <p className="hint">{scan.disclaimer}</p>
        </div>
      ) : null}
    </section>
  )
}
