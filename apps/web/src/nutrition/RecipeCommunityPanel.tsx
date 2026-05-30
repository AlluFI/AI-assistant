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

type VerifiedRecipe = {
  id: string
  title: string
  cuisine: string
  communityScore: number | null
  communityRatingCount: number
  verified: boolean
}

type Props = {
  accessToken: string
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

export function RecipeCommunityPanel({
  accessToken,
  busy,
  setBusy,
  setMessage,
  setError,
}: Props) {
  const [isModerator, setIsModerator] = useState(false)
  const [pending, setPending] = useState<PendingRow[]>([])
  const [verified, setVerified] = useState<VerifiedRecipe[]>([])

  const load = useCallback(async () => {
    try {
      const modBody = await apiGet<{ isModerator?: boolean }>(
        '/recipe-feedback/moderator-status',
        accessToken,
      )
      const verifiedList = await apiGet<VerifiedRecipe[]>(
        '/recipe-feedback/verified?limit=8',
        accessToken,
      )
      setVerified(Array.isArray(verifiedList) ? verifiedList : [])

      if (modBody.isModerator) {
        setIsModerator(true)
        const pendBody = await apiGet<PendingRow[]>('/recipe-feedback/pending', accessToken)
        setPending(Array.isArray(pendBody) ? pendBody : [])
      } else {
        setIsModerator(false)
        setPending([])
      }
    } catch {
      setIsModerator(false)
      setPending([])
      setVerified([])
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
    <section className="card cardWide recipeCommunityPanel">
      <h2>Community recipes (RAG)</h2>
      <p className="hint">
        Rate recipes in <strong>Search recipes</strong> to improve retrieval. Reviews with text
        are moderated; star-only ratings apply immediately and refresh recipe embeddings.
      </p>

      {verified.length ? (
        <div className="verifiedRecipeList">
          <h3>Verified community picks</h3>
          <ul>
            {verified.map((r) => (
              <li key={r.id}>
                <span className="verifiedBadge">Verified</span>{' '}
                <strong>{r.title}</strong>
                <span className="hint">
                  {' '}
                  · {r.cuisine}
                  {r.communityScore != null
                    ? ` · ★${r.communityScore} (${r.communityRatingCount})`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hint">No verified recipes yet — submit ratings to build community scores.</p>
      )}

      {isModerator ? (
        <div className="moderationQueue">
          <h3>Moderation queue</h3>
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
        </div>
      ) : (
        <p className="hint">
          Moderation is available to accounts listed in <code>RECIPE_MODERATOR_EMAILS</code>{' '}
          (demo: <code>demo@numbers.local</code>).
        </p>
      )}
    </section>
  )
}
