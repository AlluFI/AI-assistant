import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/apiClient'

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
  /** When true, moderation queue lives on the Admin tab instead. */
  moderationInAdminTab?: boolean
  onOpenAdmin?: () => void
}

export function RecipeCommunityPanel({
  accessToken,
  moderationInAdminTab,
  onOpenAdmin,
}: Props) {
  const [isModerator, setIsModerator] = useState(false)
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
      setIsModerator(Boolean(modBody.isModerator))
    } catch {
      setIsModerator(false)
      setVerified([])
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

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

      {isModerator && moderationInAdminTab ? (
        <p className="hint">
          You are a recipe moderator — use the{' '}
          {onOpenAdmin ? (
            <button type="button" className="linkButton" onClick={onOpenAdmin}>
              Admin
            </button>
          ) : (
            'Admin'
          )}{' '}
          tab for the review queue.
        </p>
      ) : null}
    </section>
  )
}
