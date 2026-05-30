import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiGet } from '../lib/apiClient'

export type MicronutrientReport = {
  start: string
  end: string
  days: number
  daysWithIntake: number
  targets: Record<string, number>
  labels: Record<string, string>
  units: Record<string, string>
  avgDaily: Record<string, number>
  percentOfTarget: Record<string, number>
  deficiencies: string[]
  excesses: string[]
  suggestions: string[]
  foodsByNutrient: Record<string, string[]>
}

type Props = {
  accessToken: string
  isOpen: boolean
  onClose: () => void
  endDate: string
  days?: number
}

const MICRO_ORDER = [
  'vitamin_d',
  'vitamin_b12',
  'iron',
  'calcium',
  'magnesium',
  'fiber',
  'sodium',
] as const

function barColor(key: string, pct: number): string {
  if (key === 'sodium') {
    if (pct > 115) return '#dc2626'
    if (pct > 90) return '#f59e0b'
    return '#16a34a'
  }
  if (pct < 70) return '#dc2626'
  if (pct < 90) return '#f59e0b'
  return '#16a34a'
}

export function MicronutrientsModal({
  accessToken,
  isOpen,
  onClose,
  endDate,
  days = 7,
}: Props) {
  const [report, setReport] = useState<MicronutrientReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await apiGet<MicronutrientReport>(
        `/nutrition-analytics/micronutrients?end=${encodeURIComponent(endDate)}&days=${days}`,
        accessToken,
      )
      setReport(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load micronutrients')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken, endDate, days])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  if (!isOpen) return null

  const chartData = report
    ? MICRO_ORDER.map((key) => ({
        key,
        name: report.labels[key] ?? key,
        pct: Math.min(150, report.percentOfTarget[key] ?? 0),
        intake: report.avgDaily[key] ?? 0,
        target: report.targets[key] ?? 0,
        unit: report.units[key] ?? '',
      }))
    : []

  return (
    <div
      className="consentModalBackdrop shoppingListBackdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <section
        className="card cardWide shoppingListModalCard micronutrientsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="micronutrients-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chartPanelHead">
          <h2 id="micronutrients-title">Micronutrients</h2>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="hint">
          Average daily intake vs reference values
          {report
            ? ` (${report.start} → ${report.end}, ${report.daysWithIntake} day(s) logged).`
            : '.'}
        </p>

        {loading ? <p className="hint loadingPulse">Loading micronutrient analysis…</p> : null}
        {error ? <p className="err">{error}</p> : null}

        {!loading && report ? (
          <>
            {chartData.length ? (
              <div className="micronutrientChartWrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" domain={[0, 150]} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v, _n, item) => {
                        const row = item?.payload as (typeof chartData)[number]
                        return [
                          `${v}% of RDA (${row.intake} ${row.unit} avg / ${row.target} ${row.unit})`,
                          row.name,
                        ]
                      }}
                    />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={14}>
                      {chartData.map((row) => (
                        <Cell key={row.key} fill={barColor(row.key, row.pct)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="hint chartFootnote">
                  Sodium uses an upper limit (100% = daily max). Other nutrients use recommended
                  daily intake.
                </p>
              </div>
            ) : null}

            {report.deficiencies.length ? (
              <div className="micronutrientBlock">
                <h3>Potential deficiencies</h3>
                <ul>
                  {report.deficiencies.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="hint">No major micronutrient deficiencies detected this period.</p>
            )}

            {report.excesses.length ? (
              <div className="micronutrientBlock">
                <h3>Potential excess</h3>
                <ul>
                  {report.excesses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.suggestions.length ? (
              <div className="micronutrientBlock">
                <h3>Suggestions</h3>
                <ul>
                  {report.suggestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="micronutrientBlock">
              <h3>Foods to improve specific nutrients</h3>
              <dl className="micronutrientFoodList">
                {MICRO_ORDER.map((key) => (
                  <div key={key}>
                    <dt>{report.labels[key]}</dt>
                    <dd>{(report.foodsByNutrient[key] ?? []).join(', ')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
