import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../lib/apiClient'

type PendingRow = {
  id: string
  recipeId: string
  rating: number
  reviewText: string | null
  recipeTitle: string
  authorEmail: string
}

type Props = {
  accessToken: string
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

export function RecipeModerationSection({
  accessToken,
  busy,
  setBusy,
  setMessage,
  setError,
}: Props) {
  const [pending, setPending] = useState<PendingRow[]>([])

  const load = useCallback(async () => {
    try {
      const pendBody = await apiGet<PendingRow[]>('/recipe-feedback/pending', accessToken)
      setPending(Array.isArray(pendBody) ? pendBody : [])
    } catch {
      setPending([])
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  async function moderate(id: string, status: 'approved' | 'rejected') {
    setBusy(true)
    setError('')
    try {
      const body = await apiPatch<{ message?: string }>(
        `/recipe-feedback/${id}/moderate`,
        accessToken,
        { status },
      )
      setMessage(body.message ?? `Review ${status}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Moderation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card cardWide adminSection">
      <h2>Recipe review moderation</h2>
      <p className="hint">
        Approve or reject community reviews with text. Star-only ratings do not appear here.
      </p>
      {pending.length === 0 ? (
        <p className="hint">No pending reviews.</p>
      ) : (
        <ul className="moderationList">
          {pending.map((row) => (
            <li key={row.id} className="moderationItem">
              <p>
                <strong>{row.recipeTitle}</strong> · ★{row.rating} · {row.authorEmail}
              </p>
              {row.reviewText ? <p className="hint">{row.reviewText}</p> : null}
              <div className="row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void moderate(row.id, 'approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void moderate(row.id, 'rejected')}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
