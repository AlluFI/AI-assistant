import { useMemo, useState } from 'react'
import { activityLabel, ACTIVITY_TYPES, type ActivityTypeOption } from '../activityCatalog'
import { fmtDate, fmtDateFull, todayInputValue } from './dashboardUtils'

const LOG_RANGES = [30, 90, 180, 365] as const
const HISTORY_VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'weight', label: 'Weight' },
  { id: 'activities', label: 'Activities' },
] as const

export type HistoryView = (typeof HISTORY_VIEWS)[number]['id']

export type MetricEntry = {
  id: string
  recordedAt: string
  weightKg: number | null
  heightCm?: number | null
  source?: string
}

export type ActivityEntry = {
  id: string
  activityType: string
  activityTypeLabel?: string
  activityAt: string
  durationMinutes: number
  notes?: string | null
}

type HistoryRow =
  | { kind: 'weight'; at: string; id: string; weightKg: number; source?: string }
  | {
      kind: 'activity'
      at: string
      id: string
      activityType: string
      activityTypeLabel: string
      durationMinutes: number
      notes?: string | null
    }

type Props = {
  busy: boolean
  activityTypes: ActivityTypeOption[]
  logDays: number
  onLogDaysChange: (days: number) => void
  weightKg: string
  onWeightKgChange: (v: string) => void
  weightDate: string
  onWeightDateChange: (v: string) => void
  onSaveWeight: () => void
  onCancelWeightEdit: () => void
  editingWeightId: string | null
  activityType: string
  onActivityTypeChange: (v: string) => void
  activityDate: string
  onActivityDateChange: (v: string) => void
  durationMinutes: string
  onDurationMinutesChange: (v: string) => void
  activityNotes: string
  onActivityNotesChange: (v: string) => void
  onSaveActivity: () => void
  onCancelActivityEdit: () => void
  editingActivityId: string | null
  metrics: MetricEntry[]
  activities: ActivityEntry[]
  onEditWeight: (entry: MetricEntry) => void
  onEditActivity: (entry: ActivityEntry) => void
  onDeleteWeight: (id: string) => void
  onDeleteActivity: (id: string) => void
}

export function RecordMetricsPanel({
  busy,
  activityTypes,
  logDays,
  onLogDaysChange,
  weightKg,
  onWeightKgChange,
  weightDate,
  onWeightDateChange,
  onSaveWeight,
  onCancelWeightEdit,
  editingWeightId,
  activityType,
  onActivityTypeChange,
  activityDate,
  onActivityDateChange,
  durationMinutes,
  onDurationMinutesChange,
  activityNotes,
  onActivityNotesChange,
  onSaveActivity,
  onCancelActivityEdit,
  editingActivityId,
  metrics,
  activities,
  onEditWeight,
  onEditActivity,
  onDeleteWeight,
  onDeleteActivity,
}: Props) {
  const catalog = activityTypes.length ? activityTypes : ACTIVITY_TYPES
  const [historyView, setHistoryView] = useState<HistoryView>('all')

  const weightRows = useMemo(
    () =>
      metrics
        .filter((m) => m.weightKg != null)
        .map(
          (m): HistoryRow => ({
            kind: 'weight',
            at: m.recordedAt,
            id: m.id,
            weightKg: m.weightKg!,
            source: m.source,
          }),
        ),
    [metrics],
  )

  const activityRows = useMemo(
    () =>
      activities.map(
        (a): HistoryRow => ({
          kind: 'activity',
          at: a.activityAt,
          id: a.id,
          activityType: a.activityType,
          activityTypeLabel:
            a.activityTypeLabel ?? activityLabel(a.activityType, catalog),
          durationMinutes: a.durationMinutes,
          notes: a.notes,
        }),
      ),
    [activities, catalog],
  )

  const filteredHistory = useMemo(() => {
    let rows: HistoryRow[] = []
    if (historyView === 'all') rows = [...weightRows, ...activityRows]
    else if (historyView === 'weight') rows = weightRows
    else rows = activityRows
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }, [historyView, weightRows, activityRows])

  const canDeleteWeight = (source?: string) => source !== 'profile_baseline'

  return (
    <div className="dashboardGrid recordMetrics">
      <section className="card cardSpan2">
        <h2>Record metrics</h2>
        <p className="hint">
          Log weigh-ins and workouts. Use Edit in the history table to correct a
          entry, or Remove to delete it.
        </p>

        <div className="recordFormsGrid">
          <form
            className="recordForm"
            onSubmit={(e) => {
              e.preventDefault()
              onSaveWeight()
            }}
          >
            <h3>Weight</h3>
            {editingWeightId ? (
              <p className="hint recordEditingHint">Editing an existing weigh-in</p>
            ) : null}
            <label>
              Weight (kg)
              <input
                type="number"
                step="0.1"
                min={20}
                max={400}
                value={weightKg}
                onChange={(e) => onWeightKgChange(e.target.value)}
                placeholder="e.g. 76.5"
                required
                disabled={busy}
              />
            </label>
            <label>
              Date measured
              <input
                type="date"
                value={weightDate}
                onChange={(e) => onWeightDateChange(e.target.value)}
                max={todayInputValue()}
                required
                disabled={busy}
              />
            </label>
            <div className="recordFormActions">
              <button type="submit" disabled={busy}>
                {editingWeightId ? 'Update weight' : 'Save weight'}
              </button>
              {editingWeightId ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={onCancelWeightEdit}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <form
            className="recordForm"
            onSubmit={(e) => {
              e.preventDefault()
              onSaveActivity()
            }}
          >
            <h3>Activity</h3>
            {editingActivityId ? (
              <p className="hint recordEditingHint">Editing an existing activity</p>
            ) : null}
            <label>
              Type
              <select
                value={activityType}
                onChange={(e) => onActivityTypeChange(e.target.value)}
                required
                disabled={busy}
              >
                {catalog.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={activityDate}
                onChange={(e) => onActivityDateChange(e.target.value)}
                max={todayInputValue()}
                required
                disabled={busy}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min={1}
                max={600}
                value={durationMinutes}
                onChange={(e) => onDurationMinutesChange(e.target.value)}
                placeholder="e.g. 45"
                required
                disabled={busy}
              />
            </label>
            <label>
              Notes (optional)
              <input
                type="text"
                value={activityNotes}
                onChange={(e) => onActivityNotesChange(e.target.value)}
                maxLength={500}
                disabled={busy}
              />
            </label>
            <div className="recordFormActions">
              <button type="submit" disabled={busy}>
                {editingActivityId ? 'Update activity' : 'Log activity'}
              </button>
              {editingActivityId ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={onCancelActivityEdit}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <section className="card cardSpan2">
        <div className="chartPanelHead recordHistoryHead">
          <h2>History</h2>
          <div className="recordHistoryFilters">
            <div className="dashboardTabs recordHistoryTabs" role="tablist">
              {HISTORY_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={historyView === v.id}
                  className={`secondary${historyView === v.id ? ' active' : ''}`}
                  onClick={() => setHistoryView(v.id)}
                  disabled={busy}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <label className="chartRangeLabel">
              Range
              <select
                value={logDays}
                onChange={(e) => onLogDaysChange(Number(e.target.value))}
                disabled={busy}
              >
                {LOG_RANGES.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {busy && !filteredHistory.length ? (
          <p className="hint loadingPulse">Loading entries…</p>
        ) : null}

        {!busy && !filteredHistory.length ? (
          <p className="hint vizEmpty">
            {historyView === 'all'
              ? 'No entries in this range yet.'
              : historyView === 'weight'
                ? 'No weight entries in this range.'
                : 'No activities in this range.'}
          </p>
        ) : null}

        {filteredHistory.length ? (
          <div className="recordTableWrap">
            <table className="recordTable">
              <thead>
                <tr>
                  <th>Date</th>
                  {historyView !== 'weight' ? <th>Type</th> : null}
                  {historyView !== 'activities' ? <th>Weight</th> : null}
                  {historyView !== 'weight' ? <th>Duration</th> : null}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className={
                      (row.kind === 'weight' && row.id === editingWeightId) ||
                      (row.kind === 'activity' && row.id === editingActivityId)
                        ? 'recordRowEditing'
                        : undefined
                    }
                  >
                    <td title={fmtDateFull(row.at)}>{fmtDate(row.at)}</td>
                    {historyView !== 'weight' ? (
                      <td>
                        {row.kind === 'activity' ? row.activityTypeLabel : '—'}
                      </td>
                    ) : null}
                    {historyView !== 'activities' ? (
                      <td>
                        {row.kind === 'weight' ? `${row.weightKg} kg` : '—'}
                      </td>
                    ) : null}
                    {historyView !== 'weight' ? (
                      <td>
                        {row.kind === 'activity' ? `${row.durationMinutes} min` : '—'}
                      </td>
                    ) : null}
                    <td className="recordTableActions">
                      {row.kind === 'weight' ? (
                        <>
                          <button
                            type="button"
                            className="secondary recordActionBtn"
                            disabled={busy}
                            onClick={() =>
                              onEditWeight(
                                metrics.find((m) => m.id === row.id) ?? {
                                  id: row.id,
                                  recordedAt: row.at,
                                  weightKg: row.weightKg,
                                },
                              )
                            }
                          >
                            Edit
                          </button>
                          {canDeleteWeight(row.source) ? (
                            <button
                              type="button"
                              className="secondary recordActionBtn"
                              disabled={busy}
                              onClick={() => onDeleteWeight(row.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="secondary recordActionBtn"
                            disabled={busy}
                            onClick={() =>
                              onEditActivity(
                                activities.find((a) => a.id === row.id) ?? {
                                  id: row.id,
                                  activityType: row.activityType,
                                  activityAt: row.at,
                                  durationMinutes: row.durationMinutes,
                                  notes: row.notes,
                                },
                              )
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="secondary recordActionBtn"
                            disabled={busy}
                            onClick={() => onDeleteActivity(row.id)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
