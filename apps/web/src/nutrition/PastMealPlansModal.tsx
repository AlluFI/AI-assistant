import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/apiClient'
import type { MealPlanListItem } from './types'

type Props = {
  accessToken: string
  isOpen: boolean
  onClose: () => void
  onReapplied: (planId: string) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
  setBusy: (v: boolean) => void
  busy: boolean
}

function formatPlanLabel(plan: MealPlanListItem) {
  const end = plan.endDate ?? plan.startDate
  if (plan.duration === 'weekly') {
    return `Weekly · ${plan.startDate} – ${end}`
  }
  return `Daily · ${plan.startDate}`
}

export function PastMealPlansModal({
  accessToken,
  isOpen,
  onClose,
  onReapplied,
  setMessage,
  setError,
  setBusy,
  busy,
}: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [plans, setPlans] = useState<MealPlanListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [reapplyStartDate, setReapplyStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const loadHistory = useCallback(async () => {
    if (!isOpen) return
    setLoading(true)
    try {
      const params = debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : ''
      const body = await apiGet<MealPlanListItem[]>(
        `/meal-plans/history${params}`,
        accessToken,
      )
      setPlans(Array.isArray(body) ? body : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load past meal plans')
    } finally {
      setLoading(false)
    }
  }, [accessToken, debouncedQuery, isOpen, setError])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setDebouncedQuery('')
      setSelectedPlanId(null)
      setReapplyStartDate(new Date().toISOString().slice(0, 10))
    }
  }, [isOpen])

  async function reapplyPlan(planId: string) {
    setBusy(true)
    setError('')
    try {
      await apiPost(`/meal-plans/${planId}/reapply`, accessToken, {
        startDate: reapplyStartDate,
      })
      setMessage('Past meal plan re-applied for the selected start date')
      onReapplied(planId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not re-apply meal plan')
    } finally {
      setBusy(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="consentModalBackdrop shoppingListBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="past-meal-plans-title"
      onClick={onClose}
    >
      <section
        className="card cardWide shoppingListModalCard pastMealPlansModal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="secondary shoppingModalCloseIcon"
          onClick={onClose}
          aria-label="Close past meal plans"
        >
          ×
        </button>
        <div className="shoppingListHead">
          <h2 id="past-meal-plans-title">Past meal plans</h2>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="hint">
          Search expired plans by date or duration. Re-applying restores the latest version of that
          plan with a new start date (usually today).
        </p>
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 2026-06-01 or weekly"
            disabled={busy}
          />
        </label>
        {loading ? (
          <p className="hint loadingPulse">Loading past plans…</p>
        ) : plans.length === 0 ? (
          <p className="hint">No past meal plans found.</p>
        ) : (
          <ul className="pastMealPlansList">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className={`pastMealPlanRow${selectedPlanId === plan.id ? ' selected' : ''}`}
              >
                <button
                  type="button"
                  className="pastMealPlanSelect"
                  disabled={busy}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <strong>{formatPlanLabel(plan)}</strong>
                  {plan.updatedAt ? (
                    <span className="hint">Updated {plan.updatedAt.slice(0, 10)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedPlanId ? (
          <div className="pastMealPlanReapply">
            <label>
              Re-apply starting
              <input
                type="date"
                value={reapplyStartDate}
                onChange={(e) => setReapplyStartDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void reapplyPlan(selectedPlanId)}
            >
              Re-apply plan
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
