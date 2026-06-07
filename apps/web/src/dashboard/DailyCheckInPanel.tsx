import { useEffect, useState } from 'react'
import { apiPost, apiPut } from '../lib/apiClient'

type CheckIn = {
  sleepHours: number | null
  waterGlasses: number | null
  mood: number | null
  steps: number | null
  source?: string
} | null

type Props = {
  accessToken: string
  date: string
  checkIn: CheckIn
  busy?: boolean
  onSaved: () => void
  setMessage: (v: string) => void
  setError: (v: string) => void
}

const MOOD_LABELS = ['', 'Low', 'Meh', 'OK', 'Good', 'Great'] as const

export function DailyCheckInPanel({
  accessToken,
  date,
  checkIn,
  busy,
  onSaved,
  setMessage,
  setError,
}: Props) {
  const [sleepHours, setSleepHours] = useState('')
  const [waterGlasses, setWaterGlasses] = useState('')
  const [mood, setMood] = useState('')
  const [steps, setSteps] = useState('')
  const [demoSteps, setDemoSteps] = useState('8500')
  const [demoSleep, setDemoSleep] = useState('7.5')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSleepHours(checkIn?.sleepHours != null ? String(checkIn.sleepHours) : '')
    setWaterGlasses(checkIn?.waterGlasses != null ? String(checkIn.waterGlasses) : '')
    setMood(checkIn?.mood != null ? String(checkIn.mood) : '')
    setSteps(checkIn?.steps != null ? String(checkIn.steps) : '')
  }, [checkIn, date])

  async function saveCheckIn() {
    setSaving(true)
    setError('')
    try {
      await apiPut('/daily-check-in', accessToken, {
        date,
        sleepHours: sleepHours.trim() ? Number(sleepHours) : undefined,
        waterGlasses: waterGlasses.trim() ? Math.round(Number(waterGlasses)) : undefined,
        mood: mood.trim() ? Math.round(Number(mood)) : undefined,
        steps: steps.trim() ? Math.round(Number(steps)) : undefined,
      })
      setMessage('Daily check-in saved')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save check-in')
    } finally {
      setSaving(false)
    }
  }

  async function syncWearableDemo() {
    setSaving(true)
    setError('')
    try {
      await apiPost('/daily-check-in/wearable-demo', accessToken, {
        date,
        steps: Math.round(Number(demoSteps)),
        sleepHours: Number(demoSleep),
      })
      setMessage('Imported demo wearable data (steps & sleep)')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wearable sync failed')
    } finally {
      setSaving(false)
    }
  }

  const disabled = busy || saving
  const moodNum = mood.trim() ? Math.round(Number(mood)) : 0

  return (
    <section className="card todayActionCard todayCheckIn">
      <header className="todayActionHead">
        <h2>Daily check-in</h2>
        <p className="hint">
          Sleep, water, and mood feed your wellness score (about 12.5% from your 7-day
          check-in average). Optional steps appear on Today and in Wingman.
        </p>
      </header>

      <div className="todayActionForm">
        <div className="todayMetricGrid">
          <label className="todayMetricField">
            <span className="todayMetricLabel">Sleep</span>
            <span className="todayMetricUnit">hours</span>
            <input
              type="number"
              min={0}
              max={16}
              step={0.5}
              value={sleepHours}
              disabled={disabled}
              placeholder="7.5"
              onChange={(e) => setSleepHours(e.target.value)}
            />
          </label>
          <label className="todayMetricField">
            <span className="todayMetricLabel">Water</span>
            <span className="todayMetricUnit">glasses</span>
            <input
              type="number"
              min={0}
              max={20}
              value={waterGlasses}
              disabled={disabled}
              placeholder="8"
              onChange={(e) => setWaterGlasses(e.target.value)}
            />
          </label>
          <div className="todayMetricField todayMetricFieldMood">
            <span className="todayMetricLabel">Mood</span>
            <span className="todayMetricUnit">1–5</span>
            <div className="todayMoodRow" role="group" aria-label="Mood rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={moodNum === n ? 'active' : ''}
                  disabled={disabled}
                  title={MOOD_LABELS[n]}
                  aria-pressed={moodNum === n}
                  onClick={() => setMood(String(n))}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="todayMetricField">
            <span className="todayMetricLabel">Steps</span>
            <span className="todayMetricUnit">optional</span>
            <input
              type="number"
              min={0}
              max={100000}
              step={1}
              placeholder="8500"
              value={steps}
              disabled={disabled}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
        </div>

        {checkIn?.source === 'wearable_demo' && checkIn.steps != null ? (
          <p className="todayActionNote hint">
            Steps were last imported from demo wearable data — save above to record your own
            count.
          </p>
        ) : null}

        <div className="todayActionFooter">
          <button type="button" onClick={() => void saveCheckIn()} disabled={disabled}>
            Save check-in
          </button>
        </div>

        <details className="todayCollapsible">
          <summary>Import demo wearable data</summary>
          <div className="todayCollapsibleBody">
            <p className="hint">
              Simulates Apple Health / Google Fit sync for reviewers (steps + sleep).
            </p>
            <div className="todayFieldRow">
              <label className="todayField">
                <span className="todayFieldLabel">Steps</span>
                <input
                  type="number"
                  min={0}
                  value={demoSteps}
                  disabled={disabled}
                  onChange={(e) => setDemoSteps(e.target.value)}
                />
              </label>
              <label className="todayField">
                <span className="todayFieldLabel">Sleep (hours)</span>
                <input
                  type="number"
                  min={0}
                  max={16}
                  step={0.5}
                  value={demoSleep}
                  disabled={disabled}
                  onChange={(e) => setDemoSleep(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => void syncWearableDemo()}
              disabled={disabled}
            >
              Import wearable demo
            </button>
          </div>
        </details>
      </div>
    </section>
  )
}
