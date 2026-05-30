import { parseRecommendations, sortByPriority, contextualTips } from './dashboardUtils'

type Props = {
  insights: Array<Record<string, unknown>>
  nutritionPreview?: string | null
  bmiClass: string | null
  wellnessScore: number | null
  weeklyDays: number | null
  targetDays: number | null
  onViewAll: () => void
}

export function InsightsHighlight({
  insights,
  nutritionPreview,
  bmiClass,
  wellnessScore,
  weeklyDays,
  targetDays,
  onViewAll,
}: Props) {
  const latest = insights[0]
  const recs = latest ? sortByPriority(parseRecommendations(latest.recommendations)) : []
  const topRecs = recs.slice(0, 3)
  const tips = contextualTips({
    bmiClass,
    wellnessScore,
    weeklyDays,
    targetDays,
  })

  return (
    <section className="vizBlock insightsHighlight">
      <div className="vizBlockHead">
        <h3>Latest wellness insights</h3>
        <button type="button" className="secondary" onClick={onViewAll}>
          All insights
        </button>
      </div>
      {nutritionPreview ? (
        <p className="hint nutritionInsightTeaser">
          <strong>Nutrition:</strong> {nutritionPreview}
        </p>
      ) : null}
      {!latest ? (
        <p className="hint">
          Generate or load insights on the Insights tab for wellness and nutrition analysis.
        </p>
      ) : (
        <>
          <p className="insightSummary insightLead">{String(latest.summary ?? '')}</p>
          {topRecs.length ? (
            <div className="recommendationList">
              {topRecs.map((rec, i) => (
                <details key={i} className="recommendationItem" open={rec.priority === 'high'}>
                  <summary>
                    <span className={`priorityBadge ${rec.priority}`}>{rec.priority}</span>
                    <span>{rec.title}</span>
                  </summary>
                  <p>{rec.detail}</p>
                </details>
              ))}
            </div>
          ) : null}
        </>
      )}
      <div className="quickTips">
        <p className="statLabel">Quick tips</p>
        <ul>
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
