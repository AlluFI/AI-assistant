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

  return (
    <section className="card todayCheckIn">
      <h2>Daily check-in</h2>
      <p className="hint">
        Sleep, water, and mood feed your wellness score (about 12.5% from your 7-day
        check-in average). Optional steps appear on Today and in Wingman.
      </p>
      <div className="formGrid">
        <label>
          Sleep (hours)
          <input
            type="number"
            min={0}
            max={16}
            step={0.5}
            value={sleepHours}
            disabled={disabled}
            onChange={(e) => setSleepHours(e.target.value)}
          />
        </label>
        <label>
          Water (glasses)
          <input
            type="number"
            min={0}
            max={20}
            value={waterGlasses}
            disabled={disabled}
            onChange={(e) => setWaterGlasses(e.target.value)}
          />
        </label>
        <label>
          Mood (1–5)
          <input
            type="number"
            min={1}
            max={5}
            value={mood}
            disabled={disabled}
            onChange={(e) => setMood(e.target.value)}
          />
        </label>
        <label>
          Steps (optional)
          <input
            type="number"
            min={0}
            max={100000}
            step={1}
            placeholder="e.g. 8500"
            value={steps}
            disabled={disabled}
            onChange={(e) => setSteps(e.target.value)}
          />
        </label>
      </div>
      {checkIn?.source === 'wearable_demo' && checkIn.steps != null ? (
        <p className="hint">
          Steps were last imported from demo wearable data — save above to record your own
          count.
        </p>
      ) : null}
      <div className="row">
        <button type="button" onClick={() => void saveCheckIn()} disabled={disabled}>
          Save check-in
        </button>
      </div>

      <details className="wearableDemoDetails">
        <summary>Import demo wearable data</summary>
        <p className="hint">
          Simulates Apple Health / Google Fit sync for reviewers (steps + sleep).
        </p>
        <div className="formGrid">
          <label>
            Steps
            <input
              type="number"
              min={0}
              value={demoSteps}
              disabled={disabled}
              onChange={(e) => setDemoSteps(e.target.value)}
            />
          </label>
          <label>
            Sleep (hours)
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
        <button type="button" className="secondary" onClick={() => void syncWearableDemo()} disabled={disabled}>
          Import wearable demo
        </button>
      </details>
    </section>
  )
}
