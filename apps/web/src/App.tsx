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
import { NutritionInsightsSection } from './nutrition/NutritionInsightsSection'
import type {
  DailyAnalytics,
  NutritionInsights,
  TrendPoint,
  WeeklyAnalytics,
} from './nutrition/types'
import { WingmanChat } from './wingman/WingmanChat'
import './nutrition/nutrition.css'
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
import {
  deviceTimezone,
  isListedTimezone,
  timezoneGroupsForSelect,
} from './timezoneOptions'
import { formatLoginGreeting } from './loginGreeting'
import { apiPublicJson, getCookieValue, publicErrorMessage } from './lib/authApiClient'
import { AuthPublicPages } from './auth/AuthPublicPages'
import { AuthSignInPanel } from './auth/AuthSignInPanel'
import { ConsentOnboardingModal } from './auth/ConsentOnboardingModal'
import { pathHas } from './auth/authPaths'
import { useAuthPublicFlows } from './auth/useAuthPublicFlows'
import { useAuthSession } from './auth/useAuthSession'
import { useSignInAuth } from './auth/useSignInAuth'
import { AppToast } from './ui/AppToast'

function todayDateInput() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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

export default function App() {
  const [health, setHealth] = useState<string>('…')
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
  const [nutritionDaily, setNutritionDaily] = useState<DailyAnalytics | null>(null)
  const [nutritionWeekly, setNutritionWeekly] = useState<WeeklyAnalytics | null>(null)
  const [nutritionInsights, setNutritionInsights] = useState<NutritionInsights | null>(null)
  const [nutritionInsightsLoading, setNutritionInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([])
  const [insightCadence, setInsightCadence] = useState<'off' | 'daily' | 'weekly'>('off')
  const [weightReminderEnabled, setWeightReminderEnabled] = useState(true)
  const [activityReminderCadence, setActivityReminderCadence] = useState<'off' | 'daily' | 'weekly'>('daily')
  const [reminderChannel, setReminderChannel] = useState<'email' | 'in_app'>('in_app')
  const [weightReminderDue, setWeightReminderDue] = useState(false)
  const [activityReminderDue, setActivityReminderDue] = useState(false)
  const [privacy, setPrivacy] = useState<PrivacySettingsForm | null>(null)
  const [consents, setConsents] = useState<Array<Record<string, unknown>>>([])
  const [exportEvents, setExportEvents] = useState<Array<Record<string, unknown>>>([])
  const [deletionRequest, setDeletionRequest] = useState<Record<string, unknown> | null>(null)
  const [deletionReason, setDeletionReason] = useState('')
  const [accountDisplayName, setAccountDisplayName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null)
  const [profileTimezone, setProfileTimezone] = useState(deviceTimezone())
  const [timezoneUseCustom, setTimezoneUseCustom] = useState(false)

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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const {
    accessToken,
    refreshToken,
    authApi,
    saveTokens,
    clearTokens,
    rotateLoginGreeting,
    syncMeFromToken,
    loginGreetingTemplate,
    showConsentOnboarding,
    onboardingGrants,
    setOnboardingGrants,
    submitConsentOnboarding,
  } = useAuthSession({
    setMe,
    setAccountDisplayName,
    setConsents,
    setError,
    setMessage,
    setBusy,
  })

  const signIn = useSignInAuth({
    setBusy,
    setError,
    setMessage,
    setMe,
    saveTokens,
    rotateLoginGreeting,
    syncMeFromToken,
  })

  const {
    resetPath,
    emailChangePath,
    verifyEmailSuccess,
    resetFlowSuccess,
    emailChangeFlowSuccess,
    resetPassword,
    setResetPassword,
    resetPasswordConfirm,
    setResetPasswordConfirm,
    submitReset,
  } = useAuthPublicFlows({ setBusy, setError, setMessage })

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

  const overviewChartsLoaded = useRef(false)
  const trendsLoadSeq = useRef(0)

  useEffect(() => {
    if (!devToolsEnabled) return
    void apiPublicJson('/health')
      .then(({ data }) => setHealth(JSON.stringify(data)))
      .catch(() => setHealth('unreachable'))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const loadNutritionInsights = useCallback(async () => {
    setNutritionInsightsLoading(true)
    try {
      const { data, response } = await authApi.request<NutritionInsights>(
        '/nutrition-analytics/insights',
      )
      if (response.ok) setNutritionInsights(data)
    } finally {
      setNutritionInsightsLoading(false)
    }
  }, [authApi])

  const loadTrends = useCallback(
    async (days: number) => {
      const loadId = ++trendsLoadSeq.current
      const today = todayDateInput()
      setBusy(true)
      setError(null)
      try {
        const [w, ws, act, nut, daily, weekly] = await Promise.all([
          authApi.request<Point[]>(`/analytics/series/weight?days=${days}`),
          authApi.request<Point[]>(`/analytics/series/wellness?days=${days}`),
          authApi.request<unknown[]>(`/analytics/series/activity?days=${days}`),
          authApi.request<TrendPoint[]>(`/nutrition-analytics/trend?days=${days}`),
          authApi.request<DailyAnalytics>(`/nutrition-analytics/daily?date=${today}`),
          authApi.request<WeeklyAnalytics>(`/nutrition-analytics/weekly?end=${today}`),
        ])
        if (loadId !== trendsLoadSeq.current) return
        if (!w.response.ok) {
          setError(publicErrorMessage(w.data, w.response))
          return
        }
        if (!ws.response.ok) {
          setError(publicErrorMessage(ws.data, ws.response))
          return
        }
        if (!act.response.ok) {
          setError(publicErrorMessage(act.data, act.response))
          return
        }
        setWeightSeries(Array.isArray(w.data) ? w.data : [])
        setWellnessSeries(Array.isArray(ws.data) ? ws.data : [])
        setActivitySeries(Array.isArray(act.data) ? (act.data as ActivityPoint[]) : [])
        if (nut.response.ok) {
          setNutritionTrend(Array.isArray(nut.data) ? nut.data : [])
        }
        if (daily.response.ok) setNutritionDaily(daily.data)
        if (weekly.response.ok) setNutritionWeekly(weekly.data)
      } finally {
        if (loadId === trendsLoadSeq.current) setBusy(false)
      }
    },
    [authApi],
  )

  useEffect(() => {
    if (!accessToken || dashboardView !== 'overview') return
    if (overviewChartsLoaded.current) return
    overviewChartsLoaded.current = true
    void loadSummary()
    void loadProfile()
    void loadInsights()
    void loadNutritionInsights()
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
    if (dashboardView === 'insights') {
      void loadInsights()
      void loadNutritionInsights()
    }
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
      const { data: body, response } = await authApi.request<{ activities?: ActivityTypeOption[] }>(
        '/profile/activities/catalog',
      )
      if (response.ok && Array.isArray(body.activities) && body.activities.length) {
        setActivityTypes(body.activities)
      }
    } catch {
      /* use bundled fallback */
    }
  }

  async function loadRecordData(days: number) {
    setBusy(true)
    setError(null)
    try {
      const [m, a] = await Promise.all([
        authApi.request<MetricEntry[]>(`/profile/metrics?days=${days}&limit=200`),
        authApi.request<ActivityEntry[]>(`/profile/activities?days=${days}&limit=200`),
      ])
      if (!m.response.ok) {
        setError(publicErrorMessage(m.data, m.response))
        return
      }
      if (!a.response.ok) {
        setError(publicErrorMessage(a.data, a.response))
        return
      }
      setMetricEntries(Array.isArray(m.data) ? m.data : [])
      setActivityEntries(Array.isArray(a.data) ? a.data : [])
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
      if (editingMetricId) {
        await authApi.patch(`/profile/metrics/${editingMetricId}`, payload)
      } else {
        await authApi.post('/profile/metrics', payload)
      }
      setMessage(editingMetricId ? 'Weight entry updated.' : 'Weight recorded.')
      resetRecordWeightForm()
      await loadRecordData(logDays)
      await Promise.all([loadSummary(), loadTrends(chartDays)])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save weight entry')
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
      if (editingActivityId) {
        await authApi.patch(`/profile/activities/${editingActivityId}`, payload)
      } else {
        await authApi.post('/profile/activities', payload)
      }
      setMessage(editingActivityId ? 'Activity updated.' : 'Activity logged.')
      resetRecordActivityForm()
      await loadRecordData(logDays)
      await Promise.all([loadSummary(), loadTrends(chartDays)])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save activity')
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecordedWeight(id: string) {
    if (!window.confirm('Remove this weight entry?')) return
    setBusy(true)
    setError(null)
    try {
      await authApi.delete(`/profile/metrics/${id}`)
      if (editingMetricId === id) resetRecordWeightForm()
      setMessage('Weight entry removed.')
      await loadRecordData(logDays)
      await Promise.all([loadSummary(), loadTrends(chartDays)])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove weight entry')
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecordedActivity(id: string) {
    if (!window.confirm('Remove this activity?')) return
    setBusy(true)
    setError(null)
    try {
      await authApi.delete(`/profile/activities/${id}`)
      if (editingActivityId === id) resetRecordActivityForm()
      setMessage('Activity removed.')
      await loadRecordData(logDays)
      await loadTrends(chartDays)
      await loadSummary()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove activity')
    } finally {
      setBusy(false)
    }
  }

  async function manualRefresh() {
    setBusy(true)
    setError(null)
    try {
      const csrfToken = getCookieValue('csrf_token') ?? undefined
      const { response, data: body } = await apiPublicJson<{
        accessToken?: string
        refreshToken?: string
      }>('/auth/refresh', {
        method: 'POST',
        csrfToken,
        body: refreshToken ? { refreshToken } : {},
      })
      if (!response.ok) {
        setError(publicErrorMessage(body, response))
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
      const body = await authApi.get<Record<string, unknown>>('/auth/me')
      setMe(body)
      setAccountDisplayName(typeof body.displayName === 'string' ? body.displayName : '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load account')
    } finally {
      setBusy(false)
    }
  }

  async function saveAccountSettings(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.patch<{ user?: unknown }>('/auth/account', {
        displayName: accountDisplayName,
      })
      await authApi.patch('/nutrition/profile', {
        timezone: profileTimezone.trim() || 'UTC',
      })
      setMe(body.user ?? me)
      setMessage('Account settings updated.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save account settings')
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
      const body = await authApi.post<{
        qrDataUrl?: string
        secret?: string
        otpauthUrl?: string
        expiresInSec?: number
      }>('/auth/totp/setup')
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start 2FA setup')
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
      const body = await authApi.post<{ backupCodes?: unknown[]; message?: string }>(
        '/auth/totp/confirm',
        { code: totpSetupCode },
      )
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm 2FA')
    } finally {
      setBusy(false)
    }
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.post<{ message?: string }>('/auth/totp/disable', {
        password: totpDisablePwd,
      })
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable 2FA')
    } finally {
      setBusy(false)
    }
  }

  async function regenerateTotpBackups(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.post<{ backupCodes?: unknown[] }>(
        '/auth/totp/backup-codes/regenerate',
        { password: totpRegenPwd },
      )
      setTotpRegenPwd('')
      if (Array.isArray(body.backupCodes)) {
        setTotpShownBackups(
          body.backupCodes.filter((c: unknown): c is string => typeof c === 'string'),
        )
      }
      setMessage('New backup codes generated. Save them in a safe place; old codes no longer work.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not regenerate backup codes')
    } finally {
      setBusy(false)
    }
  }

  async function requestEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.post<{ message?: string }>('/auth/change-email/request', {
        newEmail,
      })
      setMessage(body.message ?? 'Email change link sent.')
      setNewEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not request email change')
    } finally {
      setBusy(false)
    }
  }

  async function loadSummary() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<Record<string, unknown>>('/analytics/summary')
      setSummary(body)
      const { data: prBody, response: prRes } = await authApi.request<{
        weekly: ProgressSummary
        monthly: ProgressSummary
      }>('/analytics/summaries/progress')
      if (prRes.ok) {
        setProgressSummary(prBody)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load summary')
    } finally {
      setBusy(false)
    }
  }

  async function loadInsights() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<Array<Record<string, unknown>>>('/insights?limit=10')
      setInsights(Array.isArray(body) ? body : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load insights')
    } finally {
      setBusy(false)
    }
  }

  async function generateInsight(historyDays = 30) {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.post<{ fallback?: boolean }>('/insights/generate', {
        historyDays,
      })
      const mode = body?.fallback ? 'fallback' : 'AI'
      setMessage(`Generated ${mode} insight.`)
      await loadInsights()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate insight')
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
      const [weight, activity] = await Promise.all([
        authApi.request<MetricEntry[]>('/profile/metrics?days=30&limit=1'),
        authApi.request<ActivityEntry[]>('/profile/activities?days=7&limit=1'),
      ])
      const latestWeight =
        weight.response.ok && Array.isArray(weight.data) ? weight.data[0] : null
      const latestActivity =
        activity.response.ok && Array.isArray(activity.data) ? activity.data[0] : null
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
      const body = await authApi.get<{
        profile?: Record<string, unknown>
        hasStartingWeight?: boolean
        startingWeightKg?: number
      }>('/profile')
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile')
    } finally {
      setBusy(false)
    }
  }

  async function loadNutritionSettings() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<{
        nutritionProfile?: { timezone?: string }
      }>('/nutrition/profile')
      const tz =
        typeof body?.nutritionProfile?.timezone === 'string'
          ? body.nutritionProfile.timezone
          : null
      if (tz) {
        setProfileTimezone(tz)
        setTimezoneUseCustom(!isListedTimezone(tz))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load nutrition settings')
    } finally {
      setBusy(false)
    }
  }

  async function loadPrivacy() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<{ settings?: unknown }>('/profile/privacy')
      const parsed = privacyFromApi(body.settings)
      setPrivacy(parsed)
      if (parsed) {
        setInsightCadence(parsed.insightCadence)
        setWeightReminderEnabled(parsed.weightReminderEnabled)
        setActivityReminderCadence(parsed.activityReminderCadence)
        setReminderChannel(parsed.reminderChannel)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load privacy settings')
    } finally {
      setBusy(false)
    }
  }

  async function savePrivacy() {
    if (!privacy) return
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.patch<{ settings?: unknown }>(
        '/profile/privacy',
        privacyToPayload(privacy),
      )
      setPrivacy(privacyFromApi(body.settings) ?? privacy)
      setMessage('Privacy settings saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save privacy settings')
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
      const body = await authApi.patch<{ settings?: unknown }>('/profile/privacy', merged)
      const parsed = privacyFromApi(body.settings)
      if (parsed) setPrivacy(parsed)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save insight automation preferences',
      )
    }
  }

  async function loadConsents() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<{ records?: Array<Record<string, unknown>> }>(
        '/profile/consents?limit=10',
      )
      setConsents(Array.isArray(body.records) ? body.records : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load consents')
    } finally {
      setBusy(false)
    }
  }

  async function exportData() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<Record<string, unknown>>('/profile/export')
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export data')
    } finally {
      setBusy(false)
    }
  }

  async function loadExportEvents() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<{ events?: unknown[] }>('/profile/export/events?limit=10')
      setExportEvents(
        Array.isArray(body.events) ? (body.events as Array<Record<string, unknown>>) : [],
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load export history')
    } finally {
      setBusy(false)
    }
  }

  async function loadDeletionStatus() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.get<{ request?: unknown }>('/profile/deletion-request')
      setDeletionRequest((body.request as Record<string, unknown> | null) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deletion status')
    } finally {
      setBusy(false)
    }
  }

  async function loadDemoOverview() {
    setBusy(true)
    setError(null)
    try {
      const today = todayDateInput()
      const [
        me,
        summary,
        progress,
        weight,
        wellness,
        activity,
        insights,
        profile,
        privacy,
        consents,
        exportEvents,
        deletion,
        nutTrend,
        nutDaily,
        nutWeekly,
        nutInsights,
      ] = await Promise.all([
        authApi.request<Record<string, unknown>>('/auth/me'),
        authApi.request<Record<string, unknown>>('/analytics/summary'),
        authApi.request<{ weekly: ProgressSummary; monthly: ProgressSummary }>(
          '/analytics/summaries/progress',
        ),
        authApi.request<Point[]>(`/analytics/series/weight?days=${chartDays}`),
        authApi.request<Point[]>(`/analytics/series/wellness?days=${chartDays}`),
        authApi.request<unknown[]>(`/analytics/series/activity?days=${chartDays}`),
        authApi.request<unknown[]>('/insights?limit=10'),
        authApi.request<{ profile?: Record<string, unknown> }>('/profile'),
        authApi.request<{ settings?: unknown }>('/profile/privacy'),
        authApi.request<{ records?: unknown[] }>('/profile/consents?limit=10'),
        authApi.request<{ events?: unknown[] }>('/profile/export/events?limit=10'),
        authApi.request<{ request?: unknown }>('/profile/deletion-request'),
        authApi.request<TrendPoint[]>(`/nutrition-analytics/trend?days=${chartDays}`),
        authApi.request<DailyAnalytics>(`/nutrition-analytics/daily?date=${today}`),
        authApi.request<WeeklyAnalytics>(`/nutrition-analytics/weekly?end=${today}`),
        authApi.request<NutritionInsights>('/nutrition-analytics/insights'),
      ])

      if (!me.response.ok) return void setError(publicErrorMessage(me.data, me.response))
      if (!summary.response.ok) {
        return void setError(publicErrorMessage(summary.data, summary.response))
      }
      if (!progress.response.ok) {
        return void setError(publicErrorMessage(progress.data, progress.response))
      }
      if (!weight.response.ok) {
        return void setError(publicErrorMessage(weight.data, weight.response))
      }
      if (!wellness.response.ok) {
        return void setError(publicErrorMessage(wellness.data, wellness.response))
      }
      if (!activity.response.ok) {
        return void setError(publicErrorMessage(activity.data, activity.response))
      }
      if (!insights.response.ok) {
        return void setError(publicErrorMessage(insights.data, insights.response))
      }
      if (!profile.response.ok) {
        return void setError(publicErrorMessage(profile.data, profile.response))
      }
      if (!privacy.response.ok) {
        return void setError(publicErrorMessage(privacy.data, privacy.response))
      }
      if (!consents.response.ok) {
        return void setError(publicErrorMessage(consents.data, consents.response))
      }
      if (!exportEvents.response.ok) {
        return void setError(publicErrorMessage(exportEvents.data, exportEvents.response))
      }
      if (!deletion.response.ok) {
        return void setError(publicErrorMessage(deletion.data, deletion.response))
      }

      const meBody = me.data
      const summaryBody = summary.data
      const progressBody = progress.data
      const weightBody = weight.data
      const wellnessBody = wellness.data
      const activityBody = activity.data
      const insightsBody = insights.data
      const profileBody = profile.data
      const privacyBody = privacy.data
      const consentsBody = consents.data
      const exportEventsBody = exportEvents.data
      const deletionBody = deletion.data
      const nutTrendBody = nutTrend.data
      const nutDailyBody = nutDaily.data
      const nutWeeklyBody = nutWeekly.data
      const nutInsightsBody = nutInsights.data

      setMe(meBody)
      setAccountDisplayName(typeof meBody?.displayName === 'string' ? meBody.displayName : '')
      setSummary(summaryBody)
      setProgressSummary(progressBody as { weekly: ProgressSummary; monthly: ProgressSummary })
      setWeightSeries(Array.isArray(weightBody) ? weightBody : [])
      setWellnessSeries(Array.isArray(wellnessBody) ? wellnessBody : [])
      setActivitySeries(
        Array.isArray(activityBody) ? (activityBody as ActivityPoint[]) : [],
      )
      setInsights(
        Array.isArray(insightsBody) ? (insightsBody as Array<Record<string, unknown>>) : [],
      )
      if (nutTrend.response.ok) {
        setNutritionTrend(Array.isArray(nutTrendBody) ? nutTrendBody : [])
      }
      if (nutDaily.response.ok) setNutritionDaily(nutDailyBody)
      if (nutWeekly.response.ok) setNutritionWeekly(nutWeeklyBody)
      if (nutInsights.response.ok) setNutritionInsights(nutInsightsBody)
      const demoProfile = (profileBody.profile ?? {}) as Record<string, unknown>
      setProfileForm(profileFromApi(demoProfile))
      applyProfileChartTargets(demoProfile)
      setPrivacy(privacyFromApi(privacyBody.settings))
      setConsents(
        Array.isArray(consentsBody.records)
          ? (consentsBody.records as Array<Record<string, unknown>>)
          : [],
      )
      setExportEvents(
        Array.isArray(exportEventsBody.events)
          ? (exportEventsBody.events as Array<Record<string, unknown>>)
          : [],
      )
      setDeletionRequest((deletionBody.request as Record<string, unknown> | null) ?? null)
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
      const body = await authApi.post<{ request?: unknown }>('/profile/deletion-request', {
        reason: deletionReason || undefined,
      })
      setDeletionRequest((body.request as Record<string, unknown> | null) ?? null)
      setMessage('Deletion request submitted.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit deletion request')
    } finally {
      setBusy(false)
    }
  }

  async function cancelDeletionRequest() {
    setBusy(true)
    setError(null)
    try {
      const body = await authApi.post<{ request?: unknown }>(
        '/profile/deletion-request/cancel',
      )
      setDeletionRequest((body.request as Record<string, unknown> | null) ?? null)
      setMessage('Deletion request cancelled.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel deletion request')
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
      const body = await authApi.post<{
        profile?: Record<string, unknown>
        startingWeightKg?: number
      }>('/profile/reset-starting-weight', { startingWeightKg })
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset starting weight')
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
      const body = await authApi.patch<{
        profile?: Record<string, unknown>
        hasStartingWeight?: boolean
        startingWeightKg?: number
      }>('/profile', data)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (refreshToken) {
      try {
        await apiPublicJson('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
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
      await authApi.post('/auth/logout-all')
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

      <AppToast
        message={message}
        error={error}
        onDismissMessage={() => setMessage(null)}
        onDismissError={() => setError(null)}
        hidden={
          !!signIn.mfaToken ||
          pathHas('verify-email') ||
          resetPath ||
          emailChangePath ||
          !!(accessToken && showConsentOnboarding)
        }
      />

      <main className="main">
        <AuthPublicPages
          busy={busy}
          error={error}
          verifyEmailSuccess={verifyEmailSuccess}
          resetPath={resetPath}
          emailChangePath={emailChangePath}
          resetPassword={resetPassword}
          setResetPassword={setResetPassword}
          resetPasswordConfirm={resetPasswordConfirm}
          setResetPasswordConfirm={setResetPasswordConfirm}
          resetFlowSuccess={resetFlowSuccess}
          emailChangeFlowSuccess={emailChangeFlowSuccess}
          submitReset={submitReset}
        />

        {!accessToken ? <AuthSignInPanel busy={busy} {...signIn} /> : null}

        {accessToken ? (
          <>
            {showConsentOnboarding ? (
              <ConsentOnboardingModal
                busy={busy}
                error={error}
                onboardingGrants={onboardingGrants}
                setOnboardingGrants={setOnboardingGrants}
                onSubmit={submitConsentOnboarding}
              />
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
                nutritionDaily={nutritionDaily}
                nutritionWeekly={nutritionWeekly}
                nutritionInsightPreview={
                  nutritionInsights?.achievements[0] ??
                  nutritionInsights?.suggestions[0] ??
                  null
                }
                onViewInsights={() => setDashboardView('insights')}
                onViewNutrition={() => setDashboardView('nutrition')}
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
              <div className="insightsGrouped">
                <section className="card cardWide">
                  <h2>AI insights</h2>
                  <p className="hint">
                    Wellness and nutrition analysis in one place. Auto-generate wellness insights below;
                    nutrition highlights refresh from your meal plans and logged intake.
                  </p>
                </section>

                <section className="card cardWide insightsSection">
                  <h2>Wellness &amp; lifestyle</h2>
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
                      Generate wellness insight
                    </button>
                    {devToolsEnabled ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadInsights()}
                        disabled={busy}
                      >
                        Load recent wellness insights
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
                                <details
                                  key={`${String(item.id ?? idx)}-${rIdx}`}
                                  className="recommendationItem"
                                >
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
                    <p className="hint">No wellness insights yet. Generate one to see recommendations.</p>
                  )}
                </section>

                <section className="card cardWide insightsSection">
                  <div className="chartPanelHead">
                    <h2>Nutrition analysis</h2>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void loadNutritionInsights()}
                      disabled={busy || nutritionInsightsLoading}
                    >
                      Refresh nutrition insights
                    </button>
                  </div>
                  <p className="hint">
                    Macro balance, achievements, and meal-plan suggestions based on your logged intake.
                  </p>
                  <NutritionInsightsSection
                    insights={nutritionInsights}
                    loading={nutritionInsightsLoading}
                  />
                </section>
              </div>
            ) : null}

            {dashboardView === 'nutrition' && accessToken ? (
              <NutritionPanel
                accessToken={accessToken}
                busy={busy}
                setBusy={setBusy}
                setMessage={setMessage}
                setError={setError}
                onOpenWellnessInsights={() => setDashboardView('insights')}
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
                    <div className="timezoneFieldBlock">
                      <label htmlFor="profile-timezone">
                        Timezone
                        {!timezoneUseCustom ? (
                          <select
                            id="profile-timezone"
                            value={isListedTimezone(profileTimezone) ? profileTimezone : ''}
                            disabled={busy}
                            onChange={(e) => {
                              const next = e.target.value
                              if (next === '__custom__') {
                                setTimezoneUseCustom(true)
                                return
                              }
                              setProfileTimezone(next)
                            }}
                          >
                            <option value="">Select timezone…</option>
                            {timezoneGroupsForSelect(profileTimezone).map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.zones.map((zone) => (
                                  <option key={zone} value={zone}>
                                    {zone}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            <option value="__custom__">Other (enter IANA name)…</option>
                          </select>
                        ) : (
                          <input
                            id="profile-timezone"
                            value={profileTimezone}
                            onChange={(e) => setProfileTimezone(e.target.value)}
                            disabled={busy}
                            placeholder="e.g. Europe/Helsinki"
                            list="profile-timezone-suggestions"
                          />
                        )}
                      </label>
                      <datalist id="profile-timezone-suggestions">
                        {timezoneGroupsForSelect(profileTimezone).flatMap((g) =>
                          g.zones.map((zone) => <option key={zone} value={zone} />),
                        )}
                      </datalist>
                      <p className="hint timezoneFieldHint">
                        Used for meal plan scheduling and nutrition day boundaries. Choose your
                        city region (IANA format, e.g. <code>Europe/Helsinki</code>).
                      </p>
                      <div className="row timezoneFieldActions">
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => {
                            setProfileTimezone(deviceTimezone())
                            setTimezoneUseCustom(!isListedTimezone(deviceTimezone()))
                          }}
                        >
                          Use my device timezone
                        </button>
                        {timezoneUseCustom ? (
                          <button
                            type="button"
                            className="secondary"
                            disabled={busy}
                            onClick={() => {
                              setTimezoneUseCustom(false)
                              if (!isListedTimezone(profileTimezone)) {
                                setProfileTimezone(deviceTimezone())
                              }
                            }}
                          >
                            Choose from list
                          </button>
                        ) : null}
                      </div>
                    </div>
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

      </main>

      {accessToken && !showConsentOnboarding ? (
        <WingmanChat
          authFetch={authApi.fetch}
          showReminderDot={
            (weightReminderEnabled && weightReminderDue) ||
            (activityReminderCadence !== 'off' && activityReminderDue)
          }
          onOpenRecord={() => {
            setDashboardView('record')
          }}
          onOpenNutrition={() => {
            setDashboardView('nutrition')
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
