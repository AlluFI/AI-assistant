import { buildActivityHeatmap } from './dashboardUtils'

type Props = {
  series: Array<{ t: string; weeklyActivityDays: number | null }>
}

export function ActivityHeatmap({ series }: Props) {
  const weeks = buildActivityHeatmap(series)

  if (!weeks.length) {
    return (
      <div className="chartBox">
        <p className="chartTitle">Weekly activity heatmap</p>
        <p className="hint">Activity snapshots will appear here as you log progress.</p>
      </div>
    )
  }

  return (
    <div className="chartBox activityHeatmap">
      <p className="chartTitle">Weekly activity heatmap</p>
      <p className="hint">Darker cells = more active days that week (0–7 scale).</p>
      <div className="heatmapGrid" role="list">
        {weeks.map((w) => (
          <div
            key={w.weekLabel}
            className="heatmapCell"
            role="listitem"
            style={{
              background: `color-mix(in srgb, #7c3aed ${Math.round(18 + w.intensity * 72)}%, var(--bg-soft))`,
              borderColor: `color-mix(in srgb, #7c3aed ${Math.round(30 + w.intensity * 50)}%, var(--border))`,
            }}
            title={`Week of ${w.weekLabel}: ${w.days ?? 0} days`}
          >
            <span className="heatmapValue">{w.days ?? '—'}</span>
            <span className="heatmapLabel">{w.weekLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
