import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/apiClient'

export type RecipeCommunity = {
  communityScore: number | null
  communityRatingCount: number
  verified: boolean
  approvedReviews: Array<{
    id: string
    rating: number
    reviewText: string | null
    author: string
  }>
  myFeedback: {
    rating: number
    reviewText: string | null
    status: string
  } | null
}

type Props = {
  accessToken: string
  recipeId: string
  setError: (v: string) => void
  /** From GET /recipes/:id until community payload loads */
  recipeVerified?: boolean
  communityScore?: number | null
  communityRatingCount?: number
}

export function RecipeCommunityFeedback({
  accessToken,
  recipeId,
  setError,
  recipeVerified,
  communityScore,
  communityRatingCount,
}: Props) {
  const [community, setCommunity] = useState<RecipeCommunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const loadCommunity = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<RecipeCommunity>(
        `/recipe-feedback/recipe/${recipeId}`,
        accessToken,
      )
      setCommunity(data)
      if (data.myFeedback) {
        setFeedbackRating(data.myFeedback.rating)
        setFeedbackText(data.myFeedback.reviewText ?? '')
      } else {
        setFeedbackRating(5)
        setFeedbackText('')
      }
    } catch {
      setCommunity(null)
    } finally {
      setLoading(false)
    }
  }, [recipeId, accessToken])

  useEffect(() => {
    void loadCommunity()
  }, [loadCommunity])

  async function submitFeedback() {
    setFeedbackBusy(true)
    setFeedbackMessage(null)
    setError('')
    try {
      const body = await apiPost<{ message?: string }>('/recipe-feedback', accessToken, {
        recipeId,
        rating: feedbackRating,
        reviewText: feedbackText.trim() || undefined,
      })
      setFeedbackMessage(body.message ?? 'Feedback saved.')
      await loadCommunity()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit feedback')
    } finally {
      setFeedbackBusy(false)
    }
  }

  const verified = community?.verified ?? recipeVerified ?? false
  const score = community?.communityScore ?? communityScore ?? null
  const ratingCount = community?.communityRatingCount ?? communityRatingCount ?? 0

  return (
    <>
      {loading && !community ? (
        <p className="hint loadingPulse">Loading community ratings…</p>
      ) : null}
      {verified || score != null ? (
        <div className="recipeCommunityHeader">
          {verified ? (
            <p style={{ marginTop: 0 }}>
              <span className="verifiedBadge">Verified community recipe</span>
              {score != null ? (
                <span className="hint">
                  {' '}
                  · ★{score} ({ratingCount} ratings)
                </span>
              ) : null}
            </p>
          ) : score != null ? (
            <p className="hint" style={{ marginTop: 0 }}>
              Community ★{score} ({ratingCount} ratings)
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="card recipeFeedbackBlock">
        <h3 style={{ marginTop: 0 }}>Rate this recipe</h3>
        <p className="hint">
          Star ratings update RAG immediately. Written reviews are moderated before they enrich
          embeddings.
        </p>
        <div className="row recipeRatingRow">
          <label>
            Rating
            <select
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(Number(e.target.value))}
              disabled={feedbackBusy}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ★
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Review (optional)
          <textarea
            rows={3}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            disabled={feedbackBusy}
            placeholder="What worked well? Helps improve recommendations for everyone."
          />
        </label>
        {community?.myFeedback?.status === 'pending' ? (
          <p className="hint">Your written review is awaiting moderation.</p>
        ) : null}
        {feedbackMessage ? <p className="hint">{feedbackMessage}</p> : null}
        <button type="button" disabled={feedbackBusy} onClick={() => void submitFeedback()}>
          {feedbackBusy ? 'Saving…' : 'Submit feedback'}
        </button>
        {community?.approvedReviews?.length ? (
          <div className="recipeReviewList">
            <h4>Community reviews</h4>
            <ul>
              {community.approvedReviews.map((r) => (
                <li key={r.id}>
                  <strong>★{r.rating}</strong> — {r.author}
                  {r.reviewText ? `: ${r.reviewText}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  )
}
