import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { HealthOverview } from './dashboard/HealthOverview'
import {
  RecordMetricsPanel,
  type ActivityEntry,
  type MetricEntry,
} from './dashboard/RecordMetricsPanel'
import { ACTIVITY_TYPES, type ActivityTypeOption } from './activityCatalog'
import { HealthProfileForm } from './HealthProfileForm'
import { NutritionPanel } from './nutrition/NutritionPanel'
import type { TrendPoint } from './nutrition/types'
import { emptyProfileForm, profileFromApi, profileToPayload } from './profileFormModel'
import {
  type PrivacySettingsForm,
  privacyFromApi,
  privacyToPayload,
} from './privacySettings'
import {
  dateInputFromIso,
  fmtDateTime,
  parseRecommendations,
} from './dashboard/dashboardUtils'
import { devToolsEnabled } from './devTools'
import { WingmanChat } from './wingman/WingmanChat'
import {
  clearLoginGreetingTemplate,
  formatLoginGreeting,
  pickLoginGreetingTemplate,
  readLoginGreetingTemplate,
  storeLoginGreetingTemplate,
} from './loginGreeting'

const apiBase = import.meta.env.VITE_API_BASE ?? '/api'
const SUCCESS_MESSAGE_AUTO_DISMISS_MS = 4500

function todayDateInput() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const ALL_CONSENT_TYPES = [
  'data_collection',
  'ai_processing',
  'analytics',
  'marketing_email',
] as const

type AllConsentType = (typeof ALL_CONSENT_TYPES)[number]

const CONSENT_ONBOARDING_COPY: Record<
  AllConsentType,
  { title: string; description: string }
> = {
  data_collection: {
    title: 'Health and profile data',
    description:
      'Allows the app to store and use your demographics, measurements, activity, goals, and related inputs so you can use profiles, metrics, and analytics.',
  },
  ai_processing: {
    title: 'AI-powered insights',
    description:
      'Allows optional use of your anonymized context to generate wellness insights and recommendations.',
  },
  analytics: {
    title: 'Product analytics',
    description:
      'Allows aggregated or anonymized usage analytics to help improve the service.',
  },
  marketing_email: {
    title: 'Product and tips email',
    description:
      'Allows occasional non-transactional emails about the product or wellness tips. You can change this later.',
  },
}

type FetchConsentRecordsResult =
  | { ok: true; records: Array<Record<string, unknown>> }
  | { ok: false; status: number }

async function fetchConsentRecords(token: string): Promise<FetchConsentRecordsResult> {
  const res = await fetch(`${apiBase}/profile/consents?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  const records = Array.isArray(body.records) ? body.records : []
  if (!res.ok) {
    return { ok: false, status: res.status }
  }
  return { ok: true, records }
}

function needsConsentOnboarding(records: Array<Record<string, unknown>>): boolean {
  const present = new Set<string>()
  for (const r of records) {
    const t = r.consentType
    if (typeof t === 'string') present.add(t)
  }
  return ALL_CONSENT_TYPES.some((k) => !present.has(k))
}

type Point = {
  t: string
  weightKg?: number | null
  wellnessScore?: number | null
  bmi?: number | null
  isBaseline?: boolean
}
type ActivityPoint = {
  t: string
  weeklyActivityDays: number | null
  isBaseline?: boolean
}

function targetDaysFromActivityLevel(level: string | null | undefined): number | null {
  if (!level) return null
  const map: Record<string, number> = {
    sedentary: 1,
    light: 2,
    moderate: 4,
    active: 5,
    very_active: 7,
  }
  return map[level] ?? null
}
type ProgressSummary = {
  entries: number
  from: string | null
  to: string | null
  weightDeltaKg: number | null
  wellnessDelta: number | null
}

function pathHas(segment: string) {
  return window.location.pathname.includes(segment)
}

function readOAuthHash() {
  const h = window.location.hash.replace(/^#/, '')
  if (!h) return null
  const p = new URLSearchParams(h)
  const access = p.get('access_token')
  const refresh = p.get('refresh_token')
  if (access) return { access, refresh: refresh ?? null }
  return null
}

function getCookieValue(name: string) {
  const source = document.cookie
  if (!source) return null
  const item = source
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
  if (!item) return null
  return decodeURIComponent(item.slice(name.length + 1))
}

export default function App() {
  const [health, setHealth] = useState<string>('…')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBackup, setMfaBackup] = useState('')
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    sessionStorage.getItem('accessToken'),
  )
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    sessionStorage.getItem('refreshToken'),
  )
  const [me, setMe] = useState<object | null>(null)
  const [summary, setSummary] = useState<object | null>(null)
  const [progressSummary, setProgressSummary] = useState<{
    weekly: ProgressSummary
    monthly: ProgressSummary
  } | null>(null)
  const [weightSeries, setWeightSeries] = useState<Point[]>([])
  const [wellnessSeries, setWellnessSeries] = useState<Point[]>([])
  const [activitySeries, setActivitySeries] = useState<ActivityPoint[]>([])
  const [desiredActivityTargetDays, setDesiredActivityTargetDays] = useState<number | null>(null)
  const [chartDays, setChartDays] = useState(90)
  const [nutritionTrend, setNutritionTrend] = useState<TrendPoint[]>([])
  const [loginGreetingTemplate, setLoginGreetingTemplate] = useState<string | null>(() =>
    readLoginGreetingTemplate(),
  )
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([])
  const [insightCadence, setInsightCadence] = useState<'off' | 'daily' | 'weekly'>('off')
  const [weightReminderEnabled, setWeightReminderEnabled] = useState(true)
  const [activityReminderCadence, setActivityReminderCadence] = useState<'off' | 'daily' | 'weekly'>('daily')
  const [reminderChannel, setReminderChannel] = useState<'email' | 'in_app'>('in_app')
  const [weightReminderDue, setWeightReminderDue] = useState(false)
  const [activityReminderDue, setActivityReminderDue] = useState(false)
  const [privacy, setPrivacy] = useState<PrivacySettingsForm | null>(null)
  const [consents, setConsents] = useState<Array<Record<string, unknown>>>([])
  const [showConsentOnboarding, setShowConsentOnboarding] = useState(false)
  const [onboardingGrants, setOnboardingGrants] = useState<Record<AllConsentType, boolean>>(() => ({
    data_collection: false,
    ai_processing: false,
    analytics: false,
    marketing_email: false,
  }))
  const [exportEvents, setExportEvents] = useState<Array<Record<string, unknown>>>([])
  const [deletionRequest, setDeletionRequest] = useState<Record<string, unknown> | null>(null)
  const [deletionReason, setDeletionReason] = useState('')
  const [accountDisplayName, setAccountDisplayName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null)
  const [profileTimezone, setProfileTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )

  function applyProfileChartTargets(profile: Record<string, unknown> | null | undefined) {
    const p = profile ?? {}
    setTargetWeightKg(typeof p.targetWeightKg === 'number' ? p.targetWeightKg : null)
    setDesiredActivityTargetDays(
      targetDaysFromActivityLevel(
        typeof p.desiredActivityLevel === 'string' ? p.desiredActivityLevel : null,
      ),
    )
  }
  const [profileForm, setProfileForm] = useState(emptyProfileForm)
  const [hasStartingWeight, setHasStartingWeight] = useState(false)
  const [changingStartingWeight, setChangingStartingWeight] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [verifyEmailSuccess, setVerifyEmailSuccess] = useState<string | null>(null)
  const [resetFlowSuccess, setResetFlowSuccess] = useState<string | null>(null)
  const [emailChangeFlowSuccess, setEmailChangeFlowSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [authAccordion, setAuthAccordion] = useState<
    'email' | 'google' | 'github' | 'register' | null
  >('email')
  const [emailAuthMode, setEmailAuthMode] = useState<'login' | 'forgot'>('login')
  const [nutritionShoppingListId, setNutritionShoppingListId] = useState<string | null>(
    null,
  )
  const [dashboardView, setDashboardView] = useState<
    'overview' | 'record' | 'insights' | 'nutrition' | 'profile' | 'account'
  >(
    'overview',
  )
  const [logDays, setLogDays] = useState(90)
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([])
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityTypeOption[]>(ACTIVITY_TYPES)
  const [recordWeightKg, setRecordWeightKg] = useState('')
  const [recordWeightDate, setRecordWeightDate] = useState(todayDateInput)
  const [recordActivityType, setRecordActivityType] = useState('running')
  const [recordActivityDate, setRecordActivityDate] = useState(todayDateInput)
  const [recordDuration, setRecordDuration] = useState('')
  const [recordActivityNotes, setRecordActivityNotes] = useState('')
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme')
    return stored === 'dark' ? 'dark' : 'light'
  })
  const [resetToken] = useState<string | null>(() => {
    if (!pathHas('reset-password')) return null
    return new URLSearchParams(window.location.search).get('token')
  })
  const [emailChangeToken] = useState<string | null>(() => {
    if (!pathHas('confirm-email-change')) return null
    return new URLSearchParams(window.location.search).get('token')
  })
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [totpQrPayload, setTotpQrPayload] = useState<{
    qrDataUrl: string
    otpauthUrl: string
    secret: string
    expiresInSec: number
  } | null>(null)
  const [totpSetupCode, setTotpSetupCode] = useState('')
  const [totpShownBackups, setTotpShownBackups] = useState<string[] | null>(null)
  const [totpDisablePwd, setTotpDisablePwd] = useState('')
  const [totpRegenPwd, setTotpRegenPwd] = useState('')
  const autoInsightTriggeredForCurrentView = useRef(false)

  const saveTokens = useCallback((access: string, refresh: string | null) => {
    sessionStorage.setItem('accessToken', access)
    if (refresh) {
      sessionStorage.setItem('refreshToken', refresh)
    } else {
      sessionStorage.removeItem('refreshToken')
    }
    setAccessToken(access)
    setRefreshToken(refresh)
  }, [])

  const clearTokens = useCallback(() => {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')
    clearLoginGreetingTemplate()
    setAccessToken(null)
    setRefreshToken(null)
    setLoginGreetingTemplate(null)
    setShowConsentOnboarding(false)
  }, [])

  const rotateLoginGreeting = useCallback(() => {
    const template = pickLoginGreetingTemplate()
    storeLoginGreetingTemplate(template)
    setLoginGreetingTemplate(template)
  }, [])

  const syncMeFromToken = useCallback(async (token: string) => {
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setMe(body)
      setAccountDisplayName(typeof body.displayName === 'string' ? body.displayName : '')
    }
  }, [])

  useEffect(() => {
    const t = sessionStorage.getItem('accessToken')
    if (t) void syncMeFromToken(t)
  }, [syncMeFromToken])

  useEffect(() => {
    if (!accessToken) return
    if (!readLoginGreetingTemplate()) rotateLoginGreeting()
  }, [accessToken, rotateLoginGreeting])

  useEffect(() => {
    if (!accessToken) {
      setShowConsentOnboarding(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const result = await fetchConsentRecords(accessToken)
        if (cancelled) return
        if (!result.ok) {
          if (result.status === 401) {
            setError('Your session no longer matches this server (for example after a database reset). Please sign in again.')
            clearTokens()
          }
          return
        }
        setConsents(result.records)
        setShowConsentOnboarding(needsConsentOnboarding(result.records))
      } catch {
        if (!cancelled) setShowConsentOnboarding(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, clearTokens])

  const overviewChartsLoaded = useRef(false)
  const trendsLoadSeq = useRef(0)

  useEffect(() => {
    if (!showConsentOnboarding) return
    setError(null)
    setOnboardingGrants({
      data_collection: false,
      ai_processing: false,
      analytics: false,
      marketing_email: false,
    })
  }, [showConsentOnboarding])

  useEffect(() => {
    if (!devToolsEnabled) return
    fetch(`${apiBase}/health`)
      .then((r) => r.json())
      .then((j) => setHealth(JSON.stringify(j)))
      .catch(() => setHealth('unreachable'))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (authAccordion !== 'email') setEmailAuthMode('login')
  }, [authAccordion])

  useEffect(() => {
    if (!message || mfaToken) return
    const id = window.setTimeout(() => setMessage(null), SUCCESS_MESSAGE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [message, mfaToken])

  useEffect(() => {
    if (!verifyEmailSuccess) return
    const id = window.setTimeout(() => setVerifyEmailSuccess(null), SUCCESS_MESSAGE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [verifyEmailSuccess])

  useEffect(() => {
    if (!resetFlowSuccess) return
    const id = window.setTimeout(() => setResetFlowSuccess(null), SUCCESS_MESSAGE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [resetFlowSuccess])

  useEffect(() => {
    if (!emailChangeFlowSuccess) return
    const id = window.setTimeout(
      () => setEmailChangeFlowSuccess(null),
      SUCCESS_MESSAGE_AUTO_DISMISS_MS,
    )
    return () => window.clearTimeout(id)
  }, [emailChangeFlowSuccess])

  useEffect(() => {
    if (window.location.pathname.includes('oauth/callback')) {
      const o = readOAuthHash()
      if (o) {
        saveTokens(o.access, o.refresh)
        rotateLoginGreeting()
        setMessage('Signed in with OAuth.')
        window.history.replaceState({}, '', '/')
        void fetch(`${apiBase}/auth/csrf`, {
          headers: { Authorization: `Bearer ${o.access}` },
        })
        void syncMeFromToken(o.access)
      }
    }
  }, [rotateLoginGreeting, saveTokens, syncMeFromToken])

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      let res = await fetch(`${apiBase}${path}`, { ...init, headers })
      if (res.status === 401 && (refreshToken || getCookieValue('csrf_token'))) {
        const csrfToken = getCookieValue('csrf_token')
        const r2 = await fetch(`${apiBase}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        })
        const b2 = await r2.json().catch(() => ({}))
        if (r2.ok && b2.accessToken && b2.refreshToken) {
          saveTokens(b2.accessToken, b2.refreshToken)
          const h2 = new Headers(init.headers)
          h2.set('Authorization', `Bearer ${b2.accessToken}`)
          res = await fetch(`${apiBase}${path}`, { ...init, headers: h2 })
        }
      }
      return res
    },
    [accessToken, refreshToken, saveTokens],
  )

  const loadTrends = useCallback(
    async (days: number) => {
      const loadId = ++trendsLoadSeq.current
      setBusy(true)
      setError(null)
      try {
        const [wRes, wsRes, actRes, nutRes] = await Promise.all([
          authFetch(`/analytics/series/weight?days=${days}`),
          authFetch(`/analytics/series/wellness?days=${days}`),
          authFetch(`/analytics/series/activity?days=${days}`),
          authFetch(`/nutrition-analytics/trend?days=${days}`),
        ])
        if (loadId !== trendsLoadSeq.current) return
        const wBody = await wRes.json().catch(() => [])
        const wsBody = await wsRes.json().catch(() => [])
        const actBody = await actRes.json().catch(() => [])
        const nutBody = await nutRes.json().catch(() => [])
        if (loadId !== trendsLoadSeq.current) return
        if (!wRes.ok) {
          setError(fmtErr(wBody, wRes))
          return
        }
        if (!wsRes.ok) {
          setError(fmtErr(wsBody, wsRes))
          return
        }
        if (!actRes.ok) {
          setError(fmtErr(actBody, actRes))
          return
        }
        setWeightSeries(Array.isArray(wBody) ? wBody : [])
        setWellnessSeries(Array.isArray(wsBody) ? wsBody : [])
        setActivitySeries(Array.isArray(actBody) ? actBody : [])
        if (nutRes.ok) setNutritionTrend(Array.isArray(nutBody) ? (nutBody as TrendPoint[]) : [])
      } finally {
        if (loadId === trendsLoadSeq.current) setBusy(false)
      }
    },
    [authFetch],
  )

  useEffect(() => {
    if (!accessToken || dashboardView !== 'overview') return
    if (overviewChartsLoaded.current) return
    overviewChartsLoaded.current = true
    void loadSummary()
    void loadProfile()
    void loadInsights()
  }, [accessToken, dashboardView])

  useEffect(() => {
    autoInsightTriggeredForCurrentView.current = false
  }, [dashboardView, insightCadence, accessToken])

  useEffect(() => {
    if (!accessToken) overviewChartsLoaded.current = false
  }, [accessToken])

  useEffect(() => {
    if (dashboardView !== 'overview') overviewChartsLoaded.current = false
  }, [dashboardView])

  useEffect(() => {
    if (!accessToken || dashboardView !== 'overview') return
    void loadTrends(chartDays)
  }, [accessToken, dashboardView, chartDays, loadTrends])

  useEffect(() => {
    if (accessToken) void loadActivityCatalog()
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    if (dashboardView === 'insights') void loadInsights()
    if (dashboardView === 'insights') void loadPrivacy()
    if (dashboardView === 'profile') {
      void loadProfile()
    }
    if (dashboardView === 'account') {
      void loadMe()
      void loadNutritionSettings()
      void loadPrivacy()
      void loadConsents()
      void loadExportEvents()
      void loadDeletionStatus()
    }
    if (dashboardView === 'record') void loadRecordData(logDays)
  }, [accessToken, dashboardView, logDays])

  useEffect(() => {
    if (!accessToken || dashboardView !== 'overview') return
    void refreshReminderStatus()
  }, [accessToken, dashboardView, logDays, activityReminderCadence])

  useEffect(() => {
    if (!accessToken) return
    if (dashboardView !== 'insights' && dashboardView !== 'overview') return
    if (insightCadence === 'off') return
    if (autoInsightTriggeredForCurrentView.current) return
    const { due, historyDays } = shouldAutoGenerateInsight()
    if (!due) return
    autoInsightTriggeredForCurrentView.current = true
    void generateInsight(historyDays)
  }, [accessToken, dashboardView, insightCadence, insights])

  async function loadActivityCatalog() {
    try {
      const res = await authFetch('/profile/activities/catalog')
      const body = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(body.activities) && body.activities.length) {
        setActivityTypes(body.activities as ActivityTypeOption[])
      }
    } catch {
      /* use bundled fallback */
    }
  }

  async function loadRecordData(days: number) {
    setBusy(true)
    setError(null)
    try {
      const [mRes, aRes] = await Promise.all([
        authFetch(`/profile/metrics?days=${days}&limit=200`),
        authFetch(`/profile/activities?days=${days}&limit=200`),
      ])
      const mBody = await mRes.json().catch(() => [])
      const aBody = await aRes.json().catch(() => [])
      if (!mRes.ok) {
        setError(fmtErr(mBody, mRes))
        return
      }
      if (!aRes.ok) {
        setError(fmtErr(aBody, aRes))
        return
      }
      setMetricEntries(Array.isArray(mBody) ? mBody : [])
      setActivityEntries(Array.isArray(aBody) ? aBody : [])
    } finally {
      setBusy(false)
    }
  }

  function resetRecordWeightForm() {
    setEditingMetricId(null)
    setRecordWeightKg('')
    setRecordWeightDate(todayDateInput())
  }

  function resetRecordActivityForm() {
    setEditingActivityId(null)
    setRecordActivityType('running')
    setRecordActivityDate(todayDateInput())
    setRecordDuration('')
    setRecordActivityNotes('')
  }

  function startEditWeight(entry: MetricEntry) {
    setEditingActivityId(null)
    resetRecordActivityForm()
    setEditingMetricId(entry.id)
    setRecordWeightKg(String(entry.weightKg ?? ''))
    setRecordWeightDate(dateInputFromIso(entry.recordedAt))
  }

  function startEditActivity(entry: ActivityEntry) {
    setEditingMetricId(null)
    resetRecordWeightForm()
    setEditingActivityId(entry.id)
    setRecordActivityType(entry.activityType)
    setRecordActivityDate(dateInputFromIso(entry.activityAt))
    setRecordDuration(String(entry.durationMinutes))
    setRecordActivityNotes(entry.notes ?? '')
  }

  async function saveRecordedWeight() {
    const w = Number(recordWeightKg)
    if (!Number.isFinite(w) || w < 20 || w > 400) {
      setError('Enter a valid weight between 20 and 400 kg.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = { weightKg: w, recordedAt: recordWeightDate }
      const res = editingMetricId
        ? await authFetch(`/profile/metrics/${editingMetricId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await authFetch('/profile/metrics', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(editingMetricId ? 'Weight entry updated.' : 'Weight recorded.')
      resetRecordWeightForm()
      await loadRecordData(logDays)
      await Promise.all([loadSummary(), loadTrends(chartDays)])
    } finally {
      setBusy(false)
    }
  }

  async function saveRecordedActivity() {
    const duration = Number(recordDuration)
    if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
      setError('Enter duration between 1 and 600 minutes.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = {
        activityType: recordActivityType,
        activityAt: recordActivityDate,
        durationMinutes: duration,
        notes: recordActivityNotes.trim() || undefined,
      }
      const res = editingActivityId
        ? await authFetch(`/profile/activities/${editingActivityId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await authFetch('/profile/activities', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(editingActivityId ? 'Activity updated.' : 'Activity logged.')
      resetRecordActivityForm()
      await loadRecordData(logDays)
      await Promise.all([loadSummary(), loadTrends(chartDays)])
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecordedWeight(id: string) {
    if (!window.confirm('Remove this weight entry?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch(`/profile/metrics/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      if (editingMetricId === id) resetRecordWeightForm()
      setMessage('Weight entry removed.')
      await loadRecordData(logDays)
      await Promise.all([loadSummary(), loadTrends(chartDays)])
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecordedActivity(id: string) {
    if (!window.confirm('Remove this activity?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch(`/profile/activities/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      if (editingActivityId === id) resetRecordActivityForm()
      setMessage('Activity removed.')
      await loadRecordData(logDays)
      await loadTrends(chartDays)
      await loadSummary()
    } finally {
      setBusy(false)
    }
  }

  const verify = useCallback(
    async (token: string) => {
      setBusy(true)
      setError(null)
      setMessage(null)
      setVerifyEmailSuccess(null)
      try {
        const res = await fetch(`${apiBase}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(fmtErr(body, res))
          return
        }
        setVerifyEmailSuccess(body.message ?? 'Verified.')
        window.history.replaceState({}, '', window.location.pathname)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    if (t && pathHas('verify-email')) void verify(t)
  }, [verify])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    setMe(null)
    setMfaToken(null)
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      if (body.mfaRequired && body.mfaToken) {
        setMfaToken(body.mfaToken)
        setMessage('Enter your authenticator code.')
        return
      }
      if (body.accessToken && body.refreshToken) {
        saveTokens(body.accessToken, body.refreshToken)
        rotateLoginGreeting()
        setMessage('Signed in.')
        setLoginPassword('')
        await fetch(`${apiBase}/auth/csrf`, {
          headers: { Authorization: `Bearer ${body.accessToken}` },
        })
        void syncMeFromToken(body.accessToken)
      }
    } finally {
      setBusy(false)
    }
  }

  async function completeMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaToken) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/auth/mfa/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaToken,
          totpCode: mfaCode || undefined,
          backupCode: mfaBackup || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      if (body.accessToken && body.refreshToken) {
        saveTokens(body.accessToken, body.refreshToken)
        rotateLoginGreeting()
        setMfaToken(null)
        setMfaCode('')
        setMfaBackup('')
        setMessage('Signed in.')
        setLoginPassword('')
        await fetch(`${apiBase}/auth/csrf`, {
          headers: { Authorization: `Bearer ${body.accessToken}` },
        })
        void syncMeFromToken(body.accessToken)
      }
    } finally {
      setBusy(false)
    }
  }

  async function manualRefresh() {
    setBusy(true)
    setError(null)
    try {
      const csrfToken = getCookieValue('csrf_token')
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      if (body.accessToken && body.refreshToken) {
        saveTokens(body.accessToken, body.refreshToken)
        setMessage('Session refreshed.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function loadMe() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/auth/me')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMe(body)
      setAccountDisplayName(typeof body.displayName === 'string' ? body.displayName : '')
    } finally {
      setBusy(false)
    }
  }

  async function saveAccountSettings(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/auth/account', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: accountDisplayName }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const tzRes = await authFetch('/nutrition/profile', {
        method: 'PATCH',
        body: JSON.stringify({ timezone: profileTimezone }),
      })
      if (!tzRes.ok) {
        const tzBody = await tzRes.json().catch(() => ({}))
        setError(fmtErr(tzBody, tzRes))
        return
      }
      setMe(body.user ?? me)
      setMessage('Account settings updated.')
    } finally {
      setBusy(false)
    }
  }

  function clearTotpSetupUi() {
    setTotpQrPayload(null)
    setTotpSetupCode('')
  }

  async function startTotpSetup() {
    setBusy(true)
    setError(null)
    setTotpShownBackups(null)
    try {
      const res = await authFetch('/auth/totp/setup')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      if (typeof body.qrDataUrl === 'string' && typeof body.secret === 'string') {
        setTotpQrPayload({
          qrDataUrl: body.qrDataUrl,
          otpauthUrl: typeof body.otpauthUrl === 'string' ? body.otpauthUrl : '',
          secret: body.secret,
          expiresInSec: typeof body.expiresInSec === 'number' ? body.expiresInSec : 600,
        })
        setTotpSetupCode('')
        setMessage(
          'Scan the QR code with your authenticator app, then enter a 6-digit code to confirm.',
        )
      } else {
        setError('Unexpected response from server.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmTotpSetup(e: React.FormEvent) {
    e.preventDefault()
    if (totpSetupCode.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/auth/totp/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: totpSetupCode }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      clearTotpSetupUi()
      if (Array.isArray(body.backupCodes)) {
        setTotpShownBackups(
          body.backupCodes.filter((c: unknown): c is string => typeof c === 'string'),
        )
      }
      setMe((prev) =>
        prev && typeof prev === 'object'
          ? { ...prev, totpEnabled: true }
          : prev,
      )
      setMessage(
        (typeof body.message === 'string' ? body.message : null) ??
          'Two-factor authentication enabled. Other sessions were signed out; sign in again on other devices.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/auth/totp/disable', {
        method: 'POST',
        body: JSON.stringify({ password: totpDisablePwd }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setTotpDisablePwd('')
      setTotpShownBackups(null)
      clearTotpSetupUi()
      setMe((prev) =>
        prev && typeof prev === 'object'
          ? { ...prev, totpEnabled: false }
          : prev,
      )
      setMessage(
        (typeof body.message === 'string' ? body.message : null) ??
          'Two-factor authentication disabled.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function regenerateTotpBackups(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/auth/totp/backup-codes/regenerate', {
        method: 'POST',
        body: JSON.stringify({ password: totpRegenPwd }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setTotpRegenPwd('')
      if (Array.isArray(body.backupCodes)) {
        setTotpShownBackups(
          body.backupCodes.filter((c: unknown): c is string => typeof c === 'string'),
        )
      }
      setMessage('New backup codes generated. Save them in a safe place; old codes no longer work.')
    } finally {
      setBusy(false)
    }
  }

  async function requestEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/auth/change-email/request', {
        method: 'POST',
        body: JSON.stringify({ newEmail }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(body.message ?? 'Email change link sent.')
      setNewEmail('')
    } finally {
      setBusy(false)
    }
  }

  async function loadSummary() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/analytics/summary')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setSummary(body)
      const prRes = await authFetch('/analytics/summaries/progress')
      const prBody = await prRes.json().catch(() => ({}))
      if (prRes.ok) {
        setProgressSummary(prBody as { weekly: ProgressSummary; monthly: ProgressSummary })
      }
    } finally {
      setBusy(false)
    }
  }

  async function loadInsights() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/insights?limit=10')
      const body = await res.json().catch(() => [])
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setInsights(Array.isArray(body) ? body : [])
    } finally {
      setBusy(false)
    }
  }

  async function generateInsight(historyDays = 30) {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/insights/generate', {
        method: 'POST',
        body: JSON.stringify({ historyDays }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const mode = body?.fallback ? 'fallback' : 'AI'
      setMessage(`Generated ${mode} insight.`)
      await loadInsights()
    } finally {
      setBusy(false)
    }
  }

  function parseIsoDateSafe(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  function shouldAutoGenerateInsight(): { due: boolean; historyDays: number } {
    if (insightCadence === 'off') return { due: false, historyDays: 30 }
    const newest = insights[0]
    const createdAt = parseIsoDateSafe(newest?.createdAt)
    if (!createdAt) {
      return { due: true, historyDays: insightCadence === 'daily' ? 7 : 30 }
    }
    const elapsedMs = Date.now() - createdAt.getTime()
    const cadenceMs =
      insightCadence === 'daily'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000
    return {
      due: elapsedMs >= cadenceMs,
      historyDays: insightCadence === 'daily' ? 7 : 30,
    }
  }

  async function refreshReminderStatus() {
    if (!accessToken) return
    try {
      const [weightRes, activityRes] = await Promise.all([
        authFetch('/profile/metrics?days=30&limit=1'),
        authFetch('/profile/activities?days=7&limit=1'),
      ])
      const [weightBody, activityBody] = await Promise.all([
        weightRes.json().catch(() => []),
        activityRes.json().catch(() => []),
      ])
      const latestWeight = Array.isArray(weightBody) ? weightBody[0] : null
      const latestActivity = Array.isArray(activityBody) ? activityBody[0] : null
      const weightAt = parseIsoDateSafe(latestWeight?.recordedAt)
      const activityAt = parseIsoDateSafe(latestActivity?.activityAt)
      setWeightReminderDue(
        !weightAt || Date.now() - weightAt.getTime() >= 7 * 24 * 60 * 60 * 1000,
      )
      const activityMs =
        activityReminderCadence === 'weekly'
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000
      setActivityReminderDue(
        activityReminderCadence !== 'off' &&
          (!activityAt || Date.now() - activityAt.getTime() >= activityMs),
      )
    } catch {
      /* non-blocking reminders */
    }
  }

  async function loadProfile() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const profile = (body.profile ?? {}) as Record<string, unknown>
      setHasStartingWeight(Boolean(body.hasStartingWeight))
      setChangingStartingWeight(false)
      setProfileForm(
        profileFromApi(profile, {
          startingWeightKg:
            typeof body.startingWeightKg === 'number' ? body.startingWeightKg : null,
          hasStartingWeight: Boolean(body.hasStartingWeight),
        }),
      )
      applyProfileChartTargets(profile)
    } finally {
      setBusy(false)
    }
  }

  async function loadNutritionSettings() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/nutrition/profile')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const tz =
        typeof body?.nutritionProfile?.timezone === 'string'
          ? body.nutritionProfile.timezone
          : null
      if (tz) setProfileTimezone(tz)
    } finally {
      setBusy(false)
    }
  }

  async function loadPrivacy() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/privacy')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const parsed = privacyFromApi(body.settings)
      setPrivacy(parsed)
      if (parsed) {
        setInsightCadence(parsed.insightCadence)
        setWeightReminderEnabled(parsed.weightReminderEnabled)
        setActivityReminderCadence(parsed.activityReminderCadence)
        setReminderChannel(parsed.reminderChannel)
      }
    } finally {
      setBusy(false)
    }
  }

  async function savePrivacy() {
    if (!privacy) return
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/privacy', {
        method: 'PATCH',
        body: JSON.stringify(privacyToPayload(privacy)),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setPrivacy(privacyFromApi(body.settings) ?? privacy)
      setMessage('Privacy settings saved.')
    } finally {
      setBusy(false)
    }
  }

  async function saveInsightAutomationPrefs(
    next: Partial<{
      insightCadence: 'off' | 'daily' | 'weekly'
      weightReminderEnabled: boolean
      activityReminderCadence: 'off' | 'daily' | 'weekly'
      reminderChannel: 'email' | 'in_app'
    }>,
  ) {
    if (!privacy) return
    const merged = {
      insightCadence,
      weightReminderEnabled,
      activityReminderCadence,
      reminderChannel,
      ...next,
    }
    setInsightCadence(merged.insightCadence)
    setWeightReminderEnabled(merged.weightReminderEnabled)
    setActivityReminderCadence(merged.activityReminderCadence)
    setReminderChannel(merged.reminderChannel)
    try {
      const res = await authFetch('/profile/privacy', {
        method: 'PATCH',
        body: JSON.stringify(merged),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const parsed = privacyFromApi(body.settings)
      if (parsed) setPrivacy(parsed)
    } catch {
      setError('Could not save insight automation preferences')
    }
  }

  async function submitConsentOnboarding(e: React.FormEvent) {
    e.preventDefault()
    if (!onboardingGrants.data_collection) {
      setError(
        'Data collection consent is required to use profiles and health data in this app.',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      for (const ct of ALL_CONSENT_TYPES) {
        const res = await authFetch('/profile/consents', {
          method: 'POST',
          body: JSON.stringify({
            consentType: ct,
            granted: onboardingGrants[ct],
            source: 'initial_login',
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) clearTokens()
          setError(
            res.status === 401
              ? 'Your session is no longer valid. Please sign in again.'
              : fmtErr(body, res),
          )
          return
        }
      }
      if (!accessToken) return
      const result = await fetchConsentRecords(accessToken)
      if (!result.ok) {
        if (result.status === 401) clearTokens()
        setError(
          result.status === 401
            ? 'Your session is no longer valid. Please sign in again.'
            : 'Could not reload consent history.',
        )
        setShowConsentOnboarding(false)
        return
      }
      setConsents(result.records)
      setShowConsentOnboarding(false)
      setMessage('Your consent choices have been saved.')
    } finally {
      setBusy(false)
    }
  }

  async function loadConsents() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/consents?limit=10')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setConsents(Array.isArray(body.records) ? body.records : [])
    } finally {
      setBusy(false)
    }
  }

  async function exportData() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/export')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'numbers-dont-lie-export.json'
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Data export downloaded.')
    } finally {
      setBusy(false)
    }
  }

  async function loadExportEvents() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/export/events?limit=10')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setExportEvents(Array.isArray(body.events) ? body.events : [])
    } finally {
      setBusy(false)
    }
  }

  async function loadDeletionStatus() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/deletion-request')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setDeletionRequest(body.request ?? null)
    } finally {
      setBusy(false)
    }
  }

  async function loadDemoOverview() {
    setBusy(true)
    setError(null)
    try {
      const [
        meRes,
        summaryRes,
        progressRes,
        weightRes,
        wellnessRes,
        activityRes,
        insightsRes,
        profileRes,
        privacyRes,
        consentsRes,
        exportEventsRes,
        deletionRes,
      ] = await Promise.all([
        authFetch('/auth/me'),
        authFetch('/analytics/summary'),
        authFetch('/analytics/summaries/progress'),
        authFetch(`/analytics/series/weight?days=${chartDays}`),
        authFetch(`/analytics/series/wellness?days=${chartDays}`),
        authFetch(`/analytics/series/activity?days=${chartDays}`),
        authFetch('/insights?limit=10'),
        authFetch('/profile'),
        authFetch('/profile/privacy'),
        authFetch('/profile/consents?limit=10'),
        authFetch('/profile/export/events?limit=10'),
        authFetch('/profile/deletion-request'),
      ])

      const parse = async (res: Response) => res.json().catch(() => ({}))
      const [
        meBody,
        summaryBody,
        progressBody,
        weightBody,
        wellnessBody,
        activityBody,
        insightsBody,
        profileBody,
        privacyBody,
        consentsBody,
        exportEventsBody,
        deletionBody,
      ] = await Promise.all([
        parse(meRes),
        parse(summaryRes),
        parse(progressRes),
        parse(weightRes),
        parse(wellnessRes),
        parse(activityRes),
        parse(insightsRes),
        parse(profileRes),
        parse(privacyRes),
        parse(consentsRes),
        parse(exportEventsRes),
        parse(deletionRes),
      ])

      if (!meRes.ok) return void setError(fmtErr(meBody, meRes))
      if (!summaryRes.ok) return void setError(fmtErr(summaryBody, summaryRes))
      if (!progressRes.ok) return void setError(fmtErr(progressBody, progressRes))
      if (!weightRes.ok) return void setError(fmtErr(weightBody, weightRes))
      if (!wellnessRes.ok) return void setError(fmtErr(wellnessBody, wellnessRes))
      if (!activityRes.ok) return void setError(fmtErr(activityBody, activityRes))
      if (!insightsRes.ok) return void setError(fmtErr(insightsBody, insightsRes))
      if (!profileRes.ok) return void setError(fmtErr(profileBody, profileRes))
      if (!privacyRes.ok) return void setError(fmtErr(privacyBody, privacyRes))
      if (!consentsRes.ok) return void setError(fmtErr(consentsBody, consentsRes))
      if (!exportEventsRes.ok) return void setError(fmtErr(exportEventsBody, exportEventsRes))
      if (!deletionRes.ok) return void setError(fmtErr(deletionBody, deletionRes))

      setMe(meBody)
      setAccountDisplayName(typeof meBody?.displayName === 'string' ? meBody.displayName : '')
      setSummary(summaryBody)
      setProgressSummary(progressBody as { weekly: ProgressSummary; monthly: ProgressSummary })
      setWeightSeries(Array.isArray(weightBody) ? weightBody : [])
      setWellnessSeries(Array.isArray(wellnessBody) ? wellnessBody : [])
      setActivitySeries(Array.isArray(activityBody) ? activityBody : [])
      setInsights(Array.isArray(insightsBody) ? insightsBody : [])
      const demoProfile = (profileBody.profile ?? {}) as Record<string, unknown>
      setProfileForm(profileFromApi(demoProfile))
      applyProfileChartTargets(demoProfile)
      setPrivacy(privacyFromApi(privacyBody.settings))
      setConsents(Array.isArray(consentsBody.records) ? consentsBody.records : [])
      setExportEvents(Array.isArray(exportEventsBody.events) ? exportEventsBody.events : [])
      setDeletionRequest(deletionBody.request ?? null)
      setMessage('Demo overview loaded.')
    } finally {
      setBusy(false)
    }
  }

  async function requestDeletion(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/deletion-request', {
        method: 'POST',
        body: JSON.stringify({
          reason: deletionReason || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setDeletionRequest(body.request ?? null)
      setMessage('Deletion request submitted.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelDeletionRequest() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/deletion-request/cancel', {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setDeletionRequest(body.request ?? null)
      setMessage('Deletion request cancelled.')
    } finally {
      setBusy(false)
    }
  }

  function requestChangeStartingWeight() {
    const ok = window.confirm(
      'Change starting weight?\n\n' +
        'This will permanently delete all weight entries, wellness history points, and activity logs. ' +
        'Your progress charts and goal tracking will restart from the new starting weight.\n\n' +
        'This cannot be undone.',
    )
    if (!ok) return
    setChangingStartingWeight(true)
    setMessage(null)
  }

  async function applyNewStartingWeight() {
    const startingWeightKg = Number.parseFloat(profileForm.startingWeightKg.trim())
    if (!Number.isFinite(startingWeightKg) || startingWeightKg < 20 || startingWeightKg > 400) {
      setError('Enter a valid starting weight between 20 and 400 kg.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/profile/reset-starting-weight', {
        method: 'POST',
        body: JSON.stringify({ startingWeightKg }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(
        `Starting weight updated to ${startingWeightKg} kg. Historical metrics and activities were cleared.`,
      )
      setHasStartingWeight(true)
      setChangingStartingWeight(false)
      const saved = (body.profile ?? {}) as Record<string, unknown>
      setProfileForm(
        profileFromApi(saved, {
          startingWeightKg:
            typeof body.startingWeightKg === 'number' ? body.startingWeightKg : startingWeightKg,
          hasStartingWeight: true,
        }),
      )
      applyProfileChartTargets(saved)
      await Promise.all([loadSummary(), loadTrends(chartDays), loadRecordData(logDays)])
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (changingStartingWeight) {
      setError('Apply the new starting weight or cancel by reloading the profile.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = profileToPayload(profileForm, {
        includeStartingWeight: !hasStartingWeight,
      })
      const res = await authFetch('/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage('Profile saved.')
      setHasStartingWeight(Boolean(body.hasStartingWeight))
      const saved = (body.profile ?? {}) as Record<string, unknown>
      setProfileForm(
        profileFromApi(saved, {
          startingWeightKg:
            typeof body.startingWeightKg === 'number' ? body.startingWeightKg : null,
          hasStartingWeight: Boolean(body.hasStartingWeight),
        }),
      )
      applyProfileChartTargets(saved)
      if (dashboardView === 'overview') {
        await Promise.all([loadSummary(), loadTrends(chartDays)])
      }
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (refreshToken) {
      try {
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        /* ignore */
      }
    }
    clearTokens()
    setMe(null)
    setSummary(null)
    setTotpShownBackups(null)
    setTotpDisablePwd('')
    setTotpRegenPwd('')
    setTotpQrPayload(null)
    setTotpSetupCode('')
    setMessage('Signed out.')
  }

  async function logoutAll() {
    setBusy(true)
    try {
      await authFetch('/auth/logout-all', { method: 'POST' })
      clearTokens()
      setMe(null)
      setSummary(null)
      setTotpShownBackups(null)
      setTotpDisablePwd('')
      setTotpRegenPwd('')
      setTotpQrPayload(null)
      setTotpSetupCode('')
      setMessage('All sessions revoked.')
    } finally {
      setBusy(false)
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (password !== registerPasswordConfirm) {
        setError('Passwords do not match.')
        return
      }
      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(body.message ?? 'Registered.')
      setPassword('')
      setRegisterPasswordConfirm('')
    } finally {
      setBusy(false)
    }
  }

  async function forgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(body.message ?? 'Check your email.')
    } finally {
      setBusy(false)
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetToken) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (resetPassword !== resetPasswordConfirm) {
        setError('Passwords do not match.')
        return
      }
      const res = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(fmtErr(body, res))
        return
      }
      setMessage(null)
      setResetFlowSuccess(body.message ?? 'Password updated.')
      setResetPassword('')
      setResetPasswordConfirm('')
      window.history.replaceState({}, '', '/')
    } finally {
      setBusy(false)
    }
  }

  const confirmEmailChange = useCallback(
    async (token: string) => {
      setBusy(true)
      setError(null)
      setMessage(null)
      try {
        const res = await fetch(`${apiBase}/auth/change-email/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(fmtErr(body, res))
          return
        }
        setMessage(null)
        setEmailChangeFlowSuccess(body.message ?? 'Email updated.')
        window.history.replaceState({}, '', '/')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (emailChangeToken && pathHas('confirm-email-change')) {
      void confirmEmailChange(emailChangeToken)
    }
  }, [confirmEmailChange, emailChangeToken])

  const resetPath =
    window.location.pathname.includes('reset-password') || resetToken
  const emailChangePath =
    window.location.pathname.includes('confirm-email-change') || emailChangeToken
  const meObj = me as { email?: string; displayName?: string; totpEnabled?: boolean } | null
  const dashboardGreeting =
    accessToken && loginGreetingTemplate
      ? formatLoginGreeting(
          loginGreetingTemplate,
          accountDisplayName || meObj?.displayName,
          meObj?.email,
        )
      : null
  const summaryForViz = summary as {
    wellnessScore?: number
    bmi?: number | null
    bmiClassification?: string | null
    components?: {
      bmi: number
      activity: number
      progress: number
      habits: number
    } | null
  } | null

  return (
    <div className="page">
      <header className="header">
        <h1>My Health App</h1>
        <div className="headerRow">
          {devToolsEnabled ? <p className="muted">API health: {health}</p> : null}
          <button
            type="button"
            className="secondary themeToggle"
            onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>

      <main className="main">
        {pathHas('verify-email') ? (
          <section className="card">
            <h2>Email verification</h2>
            {busy && <p>Verifying…</p>}
            {!busy && verifyEmailSuccess && <p className="ok">{verifyEmailSuccess}</p>}
            {!busy && error && <p className="err">{error}</p>}
          </section>
        ) : null}

        {resetPath ? (
          <section className="card">
            <h2>Reset password</h2>
            <form onSubmit={submitReset} className="form">
              <label>
                New password (min 10)
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={10}
                  required
                />
              </label>
              <label>
                Re-enter new password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  minLength={10}
                  required
                />
              </label>
              <button type="submit" disabled={busy}>
                Update password
              </button>
            </form>
            {resetFlowSuccess ? <p className="ok">{resetFlowSuccess}</p> : null}
            {error ? <p className="err">{error}</p> : null}
          </section>
        ) : null}

        {emailChangePath ? (
          <section className="card">
            <h2>Email change confirmation</h2>
            {busy && <p>Confirming…</p>}
            {!busy && emailChangeFlowSuccess && <p className="ok">{emailChangeFlowSuccess}</p>}
            {!busy && error && <p className="err">{error}</p>}
          </section>
        ) : null}

        {!accessToken ? (
          <section className="card">
            <div className="authPanel">
              {mfaToken ? (
                <form onSubmit={completeMfa} className="form">
                  <label>
                    Authenticator code (6 digits)
                    <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maxLength={6} />
                  </label>
                  <label>
                    Or backup code
                    <input value={mfaBackup} onChange={(e) => setMfaBackup(e.target.value)} />
                  </label>
                  <button type="submit" disabled={busy}>
                    Complete sign-in
                  </button>
                </form>
              ) : (
                <div className="authAccordion">
                  <div className={`authAccordionItem${authAccordion === 'email' ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="authAccordionHead"
                      aria-expanded={authAccordion === 'email'}
                      onClick={() =>
                        setAuthAccordion((p) => {
                          const next = p === 'email' ? null : 'email'
                          return next
                        })
                      }
                    >
                      <span>Email</span>
                      <span className="authAccordionChevron" aria-hidden>
                        {authAccordion === 'email' ? '▼' : '▶'}
                      </span>
                    </button>
                    {authAccordion === 'email' ? (
                      <div className="authAccordionBody">
                        {emailAuthMode === 'login' ? (
                          <form onSubmit={login} className="form">
                            <label>
                              Email
                              <input
                                type="email"
                                autoComplete="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                required
                              />
                            </label>
                            <label>
                              Password
                              <input
                                type="password"
                                autoComplete="current-password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                required
                              />
                            </label>
                            <button type="submit" disabled={busy}>
                              Sign in
                            </button>
                            <div className="signInFooter">
                              <button
                                type="button"
                                className="linkLike"
                                onClick={() => setEmailAuthMode('forgot')}
                              >
                                Forgot password?
                              </button>
                            </div>
                          </form>
                        ) : (
                          <form onSubmit={forgotPassword} className="form">
                            <label>
                              Email
                              <input
                                type="email"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                required
                              />
                            </label>
                            <button type="submit" disabled={busy}>
                              Send reset link
                            </button>
                            <div className="signInFooter">
                              <button
                                type="button"
                                className="linkLike"
                                onClick={() => setEmailAuthMode('login')}
                              >
                                Back to sign in
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className={`authAccordionItem${authAccordion === 'google' ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="authAccordionHead"
                      aria-expanded={authAccordion === 'google'}
                      onClick={() =>
                        setAuthAccordion((p) => (p === 'google' ? null : 'google'))
                      }
                    >
                      <span>Google</span>
                      <span className="authAccordionChevron" aria-hidden>
                        {authAccordion === 'google' ? '▼' : '▶'}
                      </span>
                    </button>
                    {authAccordion === 'google' ? (
                      <div className="authAccordionBody">
                        <p className="hint oauthAccordionHint">
                          Continue in your browser. You will return here after signing in with Google.
                        </p>
                        <a className="oauthContinue" href={`${apiBase}/auth/google`}>
                          Continue with Google
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div className={`authAccordionItem${authAccordion === 'github' ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="authAccordionHead"
                      aria-expanded={authAccordion === 'github'}
                      onClick={() =>
                        setAuthAccordion((p) => (p === 'github' ? null : 'github'))
                      }
                    >
                      <span>GitHub</span>
                      <span className="authAccordionChevron" aria-hidden>
                        {authAccordion === 'github' ? '▼' : '▶'}
                      </span>
                    </button>
                    {authAccordion === 'github' ? (
                      <div className="authAccordionBody">
                        <p className="hint oauthAccordionHint">
                          Continue in your browser. You will return here after signing in with GitHub.
                        </p>
                        <a className="oauthContinue" href={`${apiBase}/auth/github`}>
                          Continue with GitHub
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div className={`authAccordionItem${authAccordion === 'register' ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="authAccordionHead"
                      aria-expanded={authAccordion === 'register'}
                      onClick={() =>
                        setAuthAccordion((p) => (p === 'register' ? null : 'register'))
                      }
                    >
                      <span>Create account</span>
                      <span className="authAccordionChevron" aria-hidden>
                        {authAccordion === 'register' ? '▼' : '▶'}
                      </span>
                    </button>
                    {authAccordion === 'register' ? (
                      <div className="authAccordionBody">
                        <form onSubmit={register} className="form">
                          <label>
                            Email
                            <input
                              type="email"
                              autoComplete="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </label>
                          <label>
                            Password (min 10 characters)
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              minLength={10}
                              required
                            />
                          </label>
                          <label>
                            Re-enter password
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={registerPasswordConfirm}
                              onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                              minLength={10}
                              required
                            />
                          </label>
                          <button type="submit" disabled={busy}>
                            Register
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {accessToken ? (
          <>
            {showConsentOnboarding ? (
              <div
                className="consentModalBackdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="consent-onboarding-title"
              >
                <div className="consentModalCard card">
                  <h2 id="consent-onboarding-title">Review your consents</h2>
                  <p className="hint">
                    Before you continue, please confirm how we may use your information. You can update
                    these choices later under Privacy.
                  </p>
                  {error ? <p className="err">{error}</p> : null}
                  <form onSubmit={submitConsentOnboarding} className="form consentOnboardingForm">
                    {ALL_CONSENT_TYPES.map((ct) => (
                      <div key={ct} className="consentOnboardingBlock">
                        <label className="consentOnboardingLabel">
                          <input
                            type="checkbox"
                            checked={onboardingGrants[ct]}
                            onChange={(e) =>
                              setOnboardingGrants((g) => ({ ...g, [ct]: e.target.checked }))
                            }
                          />
                          <span>
                            <strong>{CONSENT_ONBOARDING_COPY[ct].title}</strong>
                            <span className="consentOnboardingDesc">
                              {CONSENT_ONBOARDING_COPY[ct].description}
                            </span>
                          </span>
                        </label>
                      </div>
                    ))}
                    <div className="row consentOnboardingActions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          setOnboardingGrants({
                            data_collection: true,
                            ai_processing: true,
                            analytics: true,
                            marketing_email: true,
                          })
                        }
                      >
                        Grant all
                      </button>
                      <button type="submit" disabled={busy}>
                        Save choices
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            <section className="card dashboardTop">
              {dashboardGreeting ? (
                <p className="dashboardGreeting">{dashboardGreeting}</p>
              ) : null}
              <div>
                <h2>Dashboard</h2>
                {reminderChannel === 'in_app' &&
                  ((weightReminderEnabled && weightReminderDue) ||
                    (activityReminderCadence !== 'off' && activityReminderDue)) && (
                  <p className="hint">
                    {weightReminderEnabled && weightReminderDue
                      ? 'Weekly reminder: record your weight. '
                      : ''}
                    {activityReminderCadence !== 'off' && activityReminderDue
                      ? `${
                          activityReminderCadence === 'weekly' ? 'Weekly' : 'Daily'
                        } reminder: log an activity${activityReminderCadence === 'daily' ? ' today' : ''}.`
                      : ''}
                  </p>
                )}
              </div>
              {devToolsEnabled ? (
                <div className="chipRow">
                  <span className="chip">{summary ? 'Summary loaded' : 'Summary pending'}</span>
                  <span className="chip">
                    {weightSeries.length ? `Weight points: ${weightSeries.length}` : 'Weight points: 0'}
                  </span>
                  <span className="chip">
                    {wellnessSeries.length
                      ? `Wellness points: ${wellnessSeries.length}`
                      : 'Wellness points: 0'}
                  </span>
                  <span className="chip">
                    {activitySeries.length
                      ? `Activity points: ${activitySeries.length}`
                      : 'Activity points: 0'}
                  </span>
                  <span className="chip">
                    {insights.length ? `Insights: ${insights.length}` : 'Insights: 0'}
                  </span>
                </div>
              ) : null}
              <div className="dashboardTabs">
                <button
                  type="button"
                  className={`secondary${dashboardView === 'overview' ? ' active' : ''}`}
                  onClick={() => setDashboardView('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`secondary${dashboardView === 'record' ? ' active' : ''}`}
                  onClick={() => setDashboardView('record')}
                >
                  Record
                </button>
                <button
                  type="button"
                  className={`secondary${dashboardView === 'insights' ? ' active' : ''}`}
                  onClick={() => setDashboardView('insights')}
                >
                  Insights
                </button>
                <button
                  type="button"
                  className={`secondary${dashboardView === 'nutrition' ? ' active' : ''}`}
                  onClick={() => setDashboardView('nutrition')}
                >
                  Nutrition
                </button>
                <button
                  type="button"
                  className={`secondary${dashboardView === 'profile' ? ' active' : ''}`}
                  onClick={() => setDashboardView('profile')}
                >
                  Health profile
                </button>
                <button
                  type="button"
                  className={`secondary${dashboardView === 'account' ? ' active' : ''}`}
                  onClick={() => setDashboardView('account')}
                >
                  Profile
                </button>
              </div>
            </section>

            {dashboardView === 'overview' ? (
              <HealthOverview
                busy={busy}
                loadError={error}
                summary={summaryForViz}
                progressSummary={progressSummary}
                chartDays={chartDays}
                onChartDaysChange={setChartDays}
                weightSeries={weightSeries}
                wellnessSeries={wellnessSeries}
                activitySeries={activitySeries}
                insights={insights}
                targetWeightKg={targetWeightKg}
                desiredActivityTargetDays={desiredActivityTargetDays}
                fitnessGoalPrimary={profileForm.fitnessGoalPrimary || null}
                nutritionTrend={nutritionTrend}
                onViewInsights={() => setDashboardView('insights')}
                quickActions={
                  devToolsEnabled ? (
                  <section className="card cardSpan2">
                    <h2>Quick actions</h2>
                    <label className="toggleLabel">
                      <input
                        type="checkbox"
                        checked={showJson}
                        onChange={(e) => setShowJson(e.target.checked)}
                      />
                      Show raw JSON panels
                    </label>
                    <div className="row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadDemoOverview()}
                        disabled={busy}
                      >
                        Load demo overview
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadSummary()}
                        disabled={busy}
                      >
                        Refresh summary
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadTrends(chartDays)}
                        disabled={busy}
                      >
                        Refresh charts
                      </button>
                    </div>
                    {summary && showJson ? (
                      <pre className="pre">{JSON.stringify(summary, null, 2)}</pre>
                    ) : null}
                  </section>
                  ) : null
                }
              />
            ) : null}

            {dashboardView === 'record' ? (
              <RecordMetricsPanel
                busy={busy}
                activityTypes={activityTypes}
                logDays={logDays}
                onLogDaysChange={setLogDays}
                weightKg={recordWeightKg}
                onWeightKgChange={setRecordWeightKg}
                weightDate={recordWeightDate}
                onWeightDateChange={setRecordWeightDate}
                onSaveWeight={() => void saveRecordedWeight()}
                onCancelWeightEdit={resetRecordWeightForm}
                editingWeightId={editingMetricId}
                activityType={recordActivityType}
                onActivityTypeChange={setRecordActivityType}
                activityDate={recordActivityDate}
                onActivityDateChange={setRecordActivityDate}
                durationMinutes={recordDuration}
                onDurationMinutesChange={setRecordDuration}
                activityNotes={recordActivityNotes}
                onActivityNotesChange={setRecordActivityNotes}
                onSaveActivity={() => void saveRecordedActivity()}
                onCancelActivityEdit={resetRecordActivityForm}
                editingActivityId={editingActivityId}
                metrics={metricEntries}
                activities={activityEntries}
                onEditWeight={startEditWeight}
                onEditActivity={startEditActivity}
                onDeleteWeight={(id) => void deleteRecordedWeight(id)}
                onDeleteActivity={(id) => void deleteRecordedActivity(id)}
              />
            ) : null}

            {dashboardView === 'insights' ? (
              <section className="card cardWide">
                <h2>AI insights</h2>
                <p className="hint">
                  Auto insights cadence
                  <select
                    value={insightCadence}
                    onChange={(e) =>
                      void saveInsightAutomationPrefs({
                        insightCadence: e.target.value as 'off' | 'daily' | 'weekly',
                      })
                    }
                    disabled={busy}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    <option value="off">Off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void generateInsight(insightCadence === 'daily' ? 7 : 30)
                    }
                    disabled={busy}
                  >
                    Generate insight
                  </button>
                  {devToolsEnabled ? (
                    <button type="button" className="secondary" onClick={() => void loadInsights()} disabled={busy}>
                      Load recent insights
                    </button>
                  ) : null}
                </div>
                {insights.length ? (
                  <div className="insights">
                    {insights.map((item, idx) => (
                      <div className="insight" key={String(item.id ?? idx)}>
                        <p className="insightMeta">
                          {item.createdAt ? fmtDateTime(item.createdAt) : '—'} · {String(item.model ?? '')}
                          {item.degraded ? ' · fallback' : ''}
                        </p>
                        <p className="insightSummary">{String(item.summary ?? '')}</p>
                        {parseRecommendations(item.recommendations).length ? (
                          <div className="recommendationList">
                            {parseRecommendations(item.recommendations).map((rec, rIdx) => (
                              <details key={`${String(item.id ?? idx)}-${rIdx}`} className="recommendationItem">
                                <summary>
                                  <span className={`priorityBadge ${rec.priority}`}>{rec.priority}</span>
                                  <span>{rec.title}</span>
                                </summary>
                                <p>{rec.detail}</p>
                              </details>
                            ))}
                          </div>
                        ) : null}
                        {devToolsEnabled && showJson ? (
                          <pre className="pre">{JSON.stringify(item.recommendations ?? [], null, 2)}</pre>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint">No insights loaded yet.</p>
                )}
              </section>
            ) : null}

            {dashboardView === 'nutrition' && accessToken ? (
              <NutritionPanel
                accessToken={accessToken}
                busy={busy}
                setBusy={setBusy}
                setMessage={setMessage}
                setError={setError}
                onOpenWellnessInsights={() => setDashboardView('insights')}
                openShoppingListId={nutritionShoppingListId}
                onShoppingListOpened={() => setNutritionShoppingListId(null)}
              />
            ) : null}

            {dashboardView === 'profile' ? (
              <div className="dashboardGrid">
                <section className="card cardSpan2">
                  <h2>Health profile</h2>
                  <p className="hint">
                    Complete your profile so analytics and AI insights can use your demographics, goals, and
                    fitness assessment. Data collection consent is required before saving.
                  </p>
                  <form onSubmit={saveProfile} className="form">
                    <HealthProfileForm
                      value={profileForm}
                      onChange={setProfileForm}
                      disabled={busy}
                      hasStartingWeight={hasStartingWeight}
                      changingStartingWeight={changingStartingWeight}
                      onRequestChangeStartingWeight={requestChangeStartingWeight}
                      onApplyNewStartingWeight={() => void applyNewStartingWeight()}
                      onCancelChangeStartingWeight={() => {
                        setChangingStartingWeight(false)
                        void loadProfile()
                      }}
                    />
                    <div className="row">
                      {devToolsEnabled ? (
                        <button type="button" className="secondary" onClick={() => void loadProfile()} disabled={busy}>
                          Load profile
                        </button>
                      ) : null}
                      <button type="submit" disabled={busy}>
                        Save profile
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            ) : null}

            {dashboardView === 'account' ? (
              <div className="dashboardGrid">
                <section className="card">
                  <h2>Profile</h2>
                  <p className="hint">Customize how your account appears across the app.</p>
                  <div className="row">
                    {devToolsEnabled ? (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void loadMe()}
                          disabled={busy}
                        >
                          Load account data
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void manualRefresh()}
                          disabled={busy}
                        >
                          Refresh session
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="secondary" onClick={() => void logout()}>
                      Sign out
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void logoutAll()}
                      disabled={busy}
                    >
                      Sign out all devices
                    </button>
                  </div>
                  {devToolsEnabled && me && showJson ? (
                    <pre className="pre">{JSON.stringify(me, null, 2)}</pre>
                  ) : null}
                  <form onSubmit={saveAccountSettings} className="form">
                    <label>
                      Timezone
                      <input
                        value={profileTimezone}
                        onChange={(e) => setProfileTimezone(e.target.value)}
                        disabled={busy}
                        placeholder="e.g. Europe/Helsinki"
                      />
                    </label>
                    <label>
                      Display name
                      <input
                        value={accountDisplayName}
                        onChange={(e) => setAccountDisplayName(e.target.value)}
                        placeholder="Your display name"
                        maxLength={80}
                      />
                    </label>
                    <button type="submit" disabled={busy}>
                      Save account settings
                    </button>
                  </form>
                </section>

                <section className="card cardSpan2">
                  <h2>Privacy and export</h2>
                  <p className="hint">
                    Consent records: {consents.length} · Export events: {exportEvents.length}
                  </p>
                  <div className="row">
                    {devToolsEnabled ? (
                      <>
                        <button type="button" className="secondary" onClick={() => void loadPrivacy()} disabled={busy}>
                          Load privacy settings
                        </button>
                        <button type="button" className="secondary" onClick={() => void loadConsents()} disabled={busy}>
                          Load consent history
                        </button>
                        <button type="button" className="secondary" onClick={() => void loadExportEvents()} disabled={busy}>
                          Load export history
                        </button>
                        <button type="button" className="secondary" onClick={() => void loadNutritionSettings()} disabled={busy}>
                          Load timezone
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="secondary" onClick={() => void exportData()} disabled={busy}>
                      Export my data (JSON)
                    </button>
                  </div>
                  {privacy ? (
                    <>
                      <div className="privacyGrid">
                      <label><input type="checkbox" checked={privacy.allowAiProcessing} onChange={(e) => setPrivacy({ ...privacy, allowAiProcessing: e.target.checked })} />Allow AI processing</label>
                      <label><input type="checkbox" checked={privacy.publicProfileVisible} onChange={(e) => setPrivacy({ ...privacy, publicProfileVisible: e.target.checked })} />Public profile visible</label>
                      <label><input type="checkbox" checked={privacy.shareAnonymizedData} onChange={(e) => setPrivacy({ ...privacy, shareAnonymizedData: e.target.checked })} />Share anonymized analytics data</label>
                      <label><input type="checkbox" checked={privacy.emailNotifications} onChange={(e) => setPrivacy({ ...privacy, emailNotifications: e.target.checked })} />Email notifications</label>
                      </div>
                      <div className="privacyGrid" style={{ marginTop: '0.75rem' }}>
                        <label>
                          Reminder channel
                          <select
                            value={reminderChannel}
                            onChange={(e) =>
                              void saveInsightAutomationPrefs({
                                reminderChannel: e.target.value as 'email' | 'in_app',
                              })
                            }
                            disabled={busy}
                          >
                            <option value="in_app">In app</option>
                            <option value="email">Email</option>
                          </select>
                        </label>
                        <label>
                          Weekly weight-in reminders
                          <input
                            type="checkbox"
                            checked={weightReminderEnabled}
                            onChange={(e) =>
                              void saveInsightAutomationPrefs({
                                weightReminderEnabled: e.target.checked,
                              })
                            }
                            disabled={busy}
                          />
                        </label>
                        <label>
                          Activity reminder cadence
                          <select
                            value={activityReminderCadence}
                            onChange={(e) =>
                              void saveInsightAutomationPrefs({
                                activityReminderCadence: e.target.value as
                                  | 'off'
                                  | 'daily'
                                  | 'weekly',
                              })
                            }
                            disabled={busy}
                          >
                            <option value="off">Off</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </label>
                      </div>
                    </>
                  ) : busy ? (
                    <p className="hint loadingPulse">Loading privacy settings…</p>
                  ) : (
                    <p className="hint">Privacy settings could not be loaded.</p>
                  )}
                  <div className="row">
                    <button type="button" className="secondary" onClick={() => void savePrivacy()} disabled={busy || !privacy}>
                      Save privacy settings
                    </button>
                  </div>
                </section>

                <section className="card">
                  <h2>Two-factor authentication</h2>
                  <p className="hint">
                    Use an authenticator app (Google Authenticator, Authy, etc.). Backup codes are shown only once;
                    store them safely.
                  </p>
                  <p className="hint">
                    Status:{' '}
                    <strong>{meObj?.totpEnabled ? 'enabled' : 'not enabled'}</strong>
                    {meObj?.totpEnabled
                      ? ' — you will enter a code when signing in.'
                      : ' — recommended if you use a password on this account.'}
                  </p>

                  {totpShownBackups?.length ? (
                    <div className="totpBackupBanner">
                      <p>
                        <strong>Save these backup codes now.</strong> Each code works once if you lose your
                        authenticator. They will not be shown again.
                      </p>
                      <ul className="totpBackupList">
                        {totpShownBackups.map((c) => (
                          <li key={c}>
                            <code>{c}</code>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className="secondary" onClick={() => setTotpShownBackups(null)}>
                        I have saved my backup codes
                      </button>
                    </div>
                  ) : null}

                  {!meObj?.totpEnabled && !totpQrPayload ? (
                    <div className="row">
                      <button type="button" className="secondary" onClick={() => void startTotpSetup()} disabled={busy}>
                        Set up authenticator
                      </button>
                    </div>
                  ) : null}

                  {!meObj?.totpEnabled && totpQrPayload ? (
                    <form onSubmit={confirmTotpSetup} className="form">
                      <p className="hint">
                        Setup expires in about {totpQrPayload.expiresInSec} seconds. Scan the QR code or enter the secret
                        manually in your app.
                      </p>
                      <div className="totpQrWrap">
                        <img src={totpQrPayload.qrDataUrl} alt="Authenticator QR code" width={200} height={200} />
                      </div>
                      <details className="hint">
                        <summary>Manual setup</summary>
                        <p>
                          <code className="totpSecretMono">{totpQrPayload.secret}</code>
                        </p>
                        {totpQrPayload.otpauthUrl ? (
                          <p className="hint">
                            otpauth URI (advanced):{' '}
                            <code className="totpSecretMono totpOtpauth">{totpQrPayload.otpauthUrl}</code>
                          </p>
                        ) : null}
                      </details>
                      <label>
                        6-digit code from the app
                        <input
                          value={totpSetupCode}
                          onChange={(e) => setTotpSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                        />
                      </label>
                      <div className="row">
                        <button type="submit" disabled={busy || totpSetupCode.length !== 6}>
                          Confirm and enable 2FA
                        </button>
                        <button type="button" className="secondary" onClick={clearTotpSetupUi} disabled={busy}>
                          Cancel setup
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {meObj?.totpEnabled ? (
                    <>
                      <form onSubmit={regenerateTotpBackups} className="form">
                        <h3 className="subheading">Regenerate backup codes</h3>
                        <p className="hint">Requires your account password (min. 10 characters). Invalidates previous backup codes.</p>
                        <label>
                          Password
                          <input
                            type="password"
                            value={totpRegenPwd}
                            onChange={(e) => setTotpRegenPwd(e.target.value)}
                            autoComplete="current-password"
                            minLength={10}
                          />
                        </label>
                        <button type="submit" disabled={busy || totpRegenPwd.length < 10}>
                          Generate new backup codes
                        </button>
                      </form>
                      <form onSubmit={disableTotp} className="form">
                        <h3 className="subheading">Turn off 2FA</h3>
                        <p className="hint">Requires your account password. Not available for OAuth-only accounts without a password.</p>
                        <label>
                          Password
                          <input
                            type="password"
                            value={totpDisablePwd}
                            onChange={(e) => setTotpDisablePwd(e.target.value)}
                            autoComplete="current-password"
                            minLength={10}
                          />
                        </label>
                        <button type="submit" className="danger" disabled={busy || totpDisablePwd.length < 10}>
                          Disable two-factor authentication
                        </button>
                      </form>
                    </>
                  ) : null}
                </section>

                <section className="card">
                  <h2>Change sign-in email</h2>
                  <p className="hint">We will send a verification link to your new email before switching it.</p>
                  <p className="hint">Current email: {meObj?.email ?? '-'}</p>
                  <form onSubmit={requestEmailChange} className="form">
                    <label>
                      New email
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                      />
                    </label>
                    <button type="submit" disabled={busy}>
                      Send verification link
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Deletion lifecycle</h2>
                  <p className="hint">Submit a deletion request to schedule account removal after the retention window.</p>
                  {devToolsEnabled ? (
                    <div className="row">
                      <button type="button" className="secondary" onClick={() => void loadDeletionStatus()} disabled={busy}>
                        Load deletion status
                      </button>
                    </div>
                  ) : null}
                  <form onSubmit={requestDeletion} className="form">
                    <label>
                      Reason (optional)
                      <input value={deletionReason} onChange={(e) => setDeletionReason(e.target.value)} maxLength={300} placeholder="Optional reason" />
                    </label>
                    <div className="row">
                      <button type="submit" disabled={busy}>
                        Request account deletion
                      </button>
                      <button type="button" className="secondary" onClick={() => void cancelDeletionRequest()} disabled={busy}>
                        Cancel deletion request
                      </button>
                    </div>
                  </form>
                  {deletionRequest ? (
                    devToolsEnabled && showJson ? (
                      <pre className="pre">{JSON.stringify(deletionRequest, null, 2)}</pre>
                    ) : (
                      <div className="deletionStatus">
                        <p>
                          <strong>Status:</strong> {String(deletionRequest.status ?? 'unknown')}
                        </p>
                        {deletionRequest.scheduledFor ? (
                          <p>
                            <strong>Scheduled for:</strong>{' '}
                            {fmtDateTime(String(deletionRequest.scheduledFor))}
                          </p>
                        ) : null}
                        {deletionRequest.reason ? (
                          <p>
                            <strong>Reason:</strong> {String(deletionRequest.reason)}
                          </p>
                        ) : null}
                      </div>
                    )
                  ) : (
                    <p className="hint">No active deletion request.</p>
                  )}
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {message && !pathHas('verify-email') && !resetPath && !emailChangePath ? (
          <p className="ok banner">{message}</p>
        ) : null}
        {error &&
        !pathHas('verify-email') &&
        !resetPath &&
        !emailChangePath &&
        !(accessToken && showConsentOnboarding) ? (
          <p className="err banner">{error}</p>
        ) : null}
      </main>

      {accessToken && !showConsentOnboarding ? (
        <WingmanChat
          authFetch={authFetch}
          showReminderDot={
            (weightReminderEnabled && weightReminderDue) ||
            (activityReminderCadence !== 'off' && activityReminderDue)
          }
          onOpenRecord={() => {
            setDashboardView('record')
          }}
          onOpenNutrition={(opts) => {
            setDashboardView('nutrition')
            if (opts?.shoppingListId) {
              setNutritionShoppingListId(opts.shoppingListId)
            }
          }}
          onOpenInsights={() => {
            setDashboardView('insights')
          }}
          onDataChanged={() => {
            void refreshReminderStatus()
            if (dashboardView === 'record') void loadRecordData(logDays)
          }}
        />
      ) : null}
    </div>
  )
}

function fmtErr(body: { message?: unknown }, res: Response) {
  const m = body.message
  if (Array.isArray(m)) return m.join(', ')
  if (typeof m === 'string') return m
  return res.statusText
}

