export type SummaryComponents = {
  bmi: number
  activity: number
  progress: number
  habits: number
  checkIn?: number
}

export type BmiBand = {
  key: string
  label: string
  min: number
  max: number
  color: string
}

export const BMI_BANDS: BmiBand[] = [
  { key: 'underweight', label: 'Underweight', min: 15, max: 18.5, color: '#3b82f6' },
  { key: 'normal_weight', label: 'Healthy', min: 18.5, max: 25, color: '#22c55e' },
  { key: 'overweight', label: 'Overweight', min: 25, max: 30, color: '#eab308' },
  { key: 'obese', label: 'Obese', min: 30, max: 40, color: '#ef4444' },
]

export const BMI_SCALE_MIN = 15
export const BMI_SCALE_MAX = 40
/** Midpoint of healthy BMI range (18.5–24.9), used as chart target reference. */
export const BMI_HEALTHY_TARGET = 22
export const WELLNESS_TARGET = 100

export type CombinedMetricPoint = {
  t: string
  weightKg?: number | null
  wellnessScore?: number | null
  bmi?: number | null
  weeklyActivityDays?: number | null
  isBaseline?: boolean
}

export function mergeMetricSeries(
  weight: Array<{ t: string; weightKg?: number | null; isBaseline?: boolean }>,
  wellness: Array<{ t: string; wellnessScore?: number | null; bmi?: number | null; isBaseline?: boolean }>,
  activity: Array<{ t: string; weeklyActivityDays: number | null; isBaseline?: boolean }>,
): CombinedMetricPoint[] {
  const map = new Map<string, CombinedMetricPoint>()
  const merge = (t: string, partial: Partial<CombinedMetricPoint>, isBaseline?: boolean) => {
    const prev = map.get(t) ?? { t }
    map.set(t, {
      ...prev,
      ...partial,
      isBaseline: Boolean(prev.isBaseline || isBaseline),
    })
  }
  for (const p of weight) merge(p.t, { weightKg: p.weightKg ?? null }, p.isBaseline)
  for (const p of wellness) {
    merge(p.t, { wellnessScore: p.wellnessScore ?? null, bmi: p.bmi ?? null }, p.isBaseline)
  }
  for (const p of activity) merge(p.t, { weeklyActivityDays: p.weeklyActivityDays }, p.isBaseline)
  return [...map.values()].sort((a, b) => a.t.localeCompare(b.t))
}

export function simpleProgressPct(current: number | null, target: number | null): number | null {
  if (current == null || target == null || target <= 0) return null
  return clamp(Math.round((current / target) * 100), 0, 100)
}

export function bmiProgressPct(current: number | null, target = BMI_HEALTHY_TARGET): number | null {
  if (current == null) return null
  const dist = Math.abs(current - target)
  const maxDist = 12
  return clamp(Math.round((1 - dist / maxDist) * 100), 0, 100)
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function parseDateInput(iso: unknown): Date | null {
  if (iso == null) return null
  const d = new Date(iso as string | number)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function todayInputValue() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function dateInputFromIso(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return todayInputValue()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fmtIsoDateFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fmtIsoTimeFromDate(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** ISO 8601 calendar date (YYYY-MM-DD) in local timezone. */
export function fmtDate(iso: unknown) {
  const d = parseDateInput(iso)
  if (!d) return typeof iso === 'string' ? iso : String(iso ?? '')
  return fmtIsoDateFromDate(d)
}

/** Full date label (same as fmtDate — year-month-day). */
export function fmtDateFull(iso: unknown) {
  return fmtDate(iso)
}

/** ISO 8601 date-time (YYYY-MM-DDTHH:mm:ss) in local timezone. */
export function fmtDateTime(iso: unknown) {
  const d = parseDateInput(iso)
  if (!d) return typeof iso === 'string' ? iso : String(iso ?? '')
  return `${fmtIsoDateFromDate(d)}T${fmtIsoTimeFromDate(d)}`
}

export function bmiMarkerPercent(bmi: number) {
  return clamp(((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100, 2, 98)
}

export function bmiBandForValue(bmi: number | null) {
  if (bmi == null) return null
  return BMI_BANDS.find((b) => bmi >= b.min && bmi < b.max) ?? BMI_BANDS[BMI_BANDS.length - 1]
}

export function formatBmiClass(key: string | null | undefined) {
  if (!key) return '—'
  return key.replace(/_/g, ' ')
}

export function wellnessScoreColor(score: number) {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#ca8a04'
  return '#ea580c'
}

export function wellnessGradient(score: number) {
  const c = wellnessScoreColor(score)
  return `conic-gradient(${c} ${score * 3.6}deg, var(--gauge-track) 0)`
}

export function parseRecommendations(
  input: unknown,
): Array<{ title: string; detail: string; priority: 'high' | 'medium' | 'low' }> {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      const rec = item as { title?: unknown; detail?: unknown; priority?: unknown }
      const priority: 'high' | 'medium' | 'low' =
        rec.priority === 'high' || rec.priority === 'medium' || rec.priority === 'low'
          ? rec.priority
          : 'medium'
      return {
        title: typeof rec.title === 'string' ? rec.title : 'Recommendation',
        detail: typeof rec.detail === 'string' ? rec.detail : '',
        priority,
      }
    })
    .filter((r) => r.detail)
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export function sortByPriority<T extends { priority: 'high' | 'medium' | 'low' }>(items: T[]) {
  return [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

export function weightProgressPct(
  current: number | null,
  start: number | null,
  target: number | null,
  goalPrimary: string | null,
): number | null {
  if (current == null || target == null || start == null) return null
  const goal = (goalPrimary ?? '').toLowerCase()
  if (goal.includes('loss') && start > target) {
    const total = start - target
    if (total <= 0) return 100
    return clamp(Math.round(((start - current) / total) * 100), 0, 100)
  }
  if (goal.includes('gain') && start < target) {
    const total = target - start
    if (total <= 0) return 100
    return clamp(Math.round(((current - start) / total) * 100), 0, 100)
  }
  if (Math.abs(current - target) < 0.5) return 100
  return null
}

export function weightMilestoneValues(
  start: number,
  target: number,
  goalPrimary: string | null,
): Array<{ pct: number; kg: number }> {
  const goal = (goalPrimary ?? '').toLowerCase()
  const out: Array<{ pct: number; kg: number }> = []
  for (let pct = 5; pct <= 100; pct += 5) {
    let kg: number
    if (goal.includes('gain') && start < target) {
      kg = start + ((target - start) * pct) / 100
    } else if (start > target) {
      kg = start - ((start - target) * pct) / 100
    } else {
      continue
    }
    out.push({ pct, kg: Number(kg.toFixed(1)) })
  }
  return out
}

export function projectedGoalDate(
  series: Array<{ t: string; weightKg?: number | null }>,
  targetKg: number | null,
): string | null {
  if (targetKg == null || series.length < 2) return null
  const pts = series
    .filter((p) => p.weightKg != null)
    .map((p) => ({ t: new Date(p.t).getTime(), w: p.weightKg as number }))
  if (pts.length < 2) return null
  const first = pts[0]
  const last = pts[pts.length - 1]
  const days = (last.t - first.t) / 86400000
  if (days < 1) return null
  const ratePerDay = (last.w - first.w) / days
  if (Math.abs(ratePerDay) < 0.001) return null
  const remaining = targetKg - last.w
  if (remaining * ratePerDay > 0) return null
  const daysToGo = Math.ceil(Math.abs(remaining / ratePerDay))
  if (daysToGo > 365 * 2) return null
  const projected = new Date(last.t + daysToGo * 86400000)
  return fmtDate(projected)
}

export type SignificantChange = { t: string; delta: number; label: string }

export function detectWellnessChanges(
  series: Array<{ t: string; wellnessScore?: number | null }>,
  threshold = 5,
): SignificantChange[] {
  const out: SignificantChange[] = []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]?.wellnessScore
    const cur = series[i]?.wellnessScore
    if (prev == null || cur == null) continue
    const delta = cur - prev
    if (Math.abs(delta) >= threshold) {
      out.push({
        t: series[i].t,
        delta,
        label: delta > 0 ? `+${delta}` : `${delta}`,
      })
    }
  }
  return out
}

export type HeatmapWeek = { weekLabel: string; days: number | null; intensity: number }

export function buildActivityHeatmap(
  series: Array<{ t: string; weeklyActivityDays: number | null }>,
  maxWeeks = 12,
): HeatmapWeek[] {
  if (!series.length) return []
  const byWeek = new Map<string, { days: number; t: number }>()
  for (const p of series) {
    if (p.weeklyActivityDays == null) continue
    const d = new Date(p.t)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)
    const existing = byWeek.get(key)
    if (!existing || d.getTime() >= existing.t) {
      byWeek.set(key, { days: p.weeklyActivityDays, t: d.getTime() })
    }
  }
  const sorted = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const tail = sorted.slice(-maxWeeks)
  return tail.map(([key, v]) => ({
    weekLabel: fmtDate(key),
    days: v.days,
    intensity: clamp(v.days / 7, 0, 1),
  }))
}

export function contextualTips(input: {
  bmiClass: string | null
  wellnessScore: number | null
  weeklyDays: number | null
  targetDays: number | null
}): string[] {
  const tips: string[] = []
  if (input.bmiClass === 'overweight' || input.bmiClass === 'obese') {
    tips.push('Pair gradual weight goals with consistent weekly activity for sustainable progress.')
  }
  if (input.bmiClass === 'underweight') {
    tips.push('Focus on balanced nutrition and strength work rather than large calorie deficits.')
  }
  if (input.wellnessScore != null && input.wellnessScore < 60) {
    tips.push('Small habit wins (one extra active day per week) can lift your wellness score quickly.')
  }
  if (
    input.weeklyDays != null &&
    input.targetDays != null &&
    input.weeklyDays < input.targetDays
  ) {
    tips.push(
      `You are ${input.targetDays - input.weeklyDays} day(s)/week below your desired activity level — try scheduling short sessions.`,
    )
  }
  if (!tips.length) {
    tips.push('Keep logging metrics weekly so trends and AI insights stay accurate.')
  }
  return tips.slice(0, 2)
}
