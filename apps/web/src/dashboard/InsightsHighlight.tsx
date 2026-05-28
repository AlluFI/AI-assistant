import { parseRecommendations, sortByPriority, contextualTips } from './dashboardUtils'

type Props = {
  insights: Array<Record<string, unknown>>
  bmiClass: string | null
  wellnessScore: number | null
  weeklyDays: number | null
  targetDays: number | null
  onViewAll: () => void
}

export function InsightsHighlight({
  insights,
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
        <h3>Latest AI insights</h3>
        <button type="button" className="secondary" onClick={onViewAll}>
          View all
        </button>
      </div>
      {!latest ? (
        <p className="hint">Generate or load insights to see personalized recommendations here.</p>
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
