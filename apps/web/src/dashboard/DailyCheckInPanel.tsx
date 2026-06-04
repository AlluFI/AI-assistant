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
  const [demoSteps, setDemoSteps] = useState('8500')
  const [demoSleep, setDemoSleep] = useState('7.5')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSleepHours(checkIn?.sleepHours != null ? String(checkIn.sleepHours) : '')
    setWaterGlasses(checkIn?.waterGlasses != null ? String(checkIn.waterGlasses) : '')
    setMood(checkIn?.mood != null ? String(checkIn.mood) : '')
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
      <p className="hint">Track sleep, hydration, and mood — used for wellness coaching.</p>
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
      </div>
      {checkIn?.steps != null ? (
        <p className="hint">
          Wearable steps today: <strong>{checkIn.steps.toLocaleString()}</strong>
          {checkIn.source === 'wearable_demo' ? ' (demo import)' : ''}
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
