import type { NutritionInsights } from './types'

type Props = {
  insights: NutritionInsights | null
  loading?: boolean
  compact?: boolean
}

export function NutritionInsightsSection({ insights, loading, compact }: Props) {
  if (loading && !insights) {
    return <p className="hint loadingPulse">Loading nutrition insights…</p>
  }
  if (!insights) {
    return (
      <p className="hint">
        Open this tab after logging meals or generating a meal plan to load nutrition analysis.
      </p>
    )
  }

  const gridClass = compact ? 'nutritionInsightsGrid compact' : 'nutritionInsightsGrid'

  return (
    <div className={gridClass}>
      <div>
        <h3>{compact ? 'Highlights' : 'Achievements'}</h3>
        {insights.achievements.length ? (
          <ul>
            {insights.achievements.map((item) => (
              <li key={`a-${item}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="hint">No highlights yet.</p>
        )}
      </div>
      <div>
        <h3>Potential concerns</h3>
        {insights.concerns.length ? (
          <ul>
            {insights.concerns.map((item) => (
              <li key={`c-${item}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="hint">No major concerns detected.</p>
        )}
      </div>
      <div>
        <h3>Macro balance</h3>
        <p>Protein: {insights.macroBalance.protein}</p>
        <p>Carbs: {insights.macroBalance.carbs}</p>
        <p>Fats: {insights.macroBalance.fats}</p>
      </div>
      <div>
        <h3>Improvement suggestions</h3>
        {insights.suggestions.length ? (
          <ul>
            {insights.suggestions.map((item) => (
              <li key={`s-${item}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="hint">No suggestions right now.</p>
        )}
      </div>
      {insights.usedFallback ? (
        <p className="hint">Generated using deterministic fallback (AI unavailable).</p>
      ) : null}
    </div>
  )
}
