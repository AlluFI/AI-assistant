import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiGet } from '../lib/apiClient'
import {
  createAuthApiClient,
  fetchCsrf,
  publicErrorMessage,
  type AuthApiClient,
} from '../lib/authApiClient'
import {
  clearLoginGreetingTemplate,
  pickLoginGreetingTemplate,
  readLoginGreetingTemplate,
  storeLoginGreetingTemplate,
} from '../loginGreeting'
import { fetchConsentRecords, needsConsentOnboarding, type AllConsentType } from './consent'
import { readOAuthHash } from './authPaths'

type UseAuthSessionOptions = {
  setMe: (value: object | null) => void
  setAccountDisplayName: (value: string) => void
  setConsents: (records: Array<Record<string, unknown>>) => void
  setError: (value: string | null) => void
  setMessage: (value: string | null) => void
  setBusy: (value: boolean) => void
}

export function useAuthSession({
  setMe,
  setAccountDisplayName,
  setConsents,
  setError,
  setMessage,
  setBusy,
}: UseAuthSessionOptions) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    sessionStorage.getItem('accessToken'),
  )
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    sessionStorage.getItem('refreshToken'),
  )
  const [loginGreetingTemplate, setLoginGreetingTemplate] = useState<string | null>(() =>
    readLoginGreetingTemplate(),
  )
  const [showConsentOnboarding, setShowConsentOnboarding] = useState(false)
  const [onboardingGrants, setOnboardingGrants] = useState<Record<AllConsentType, boolean>>(
    () => ({
      data_collection: false,
      ai_processing: false,
      analytics: false,
      marketing_email: false,
    }),
  )

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

  const syncMeFromToken = useCallback(
    async (token: string) => {
      try {
        const body = await apiGet<Record<string, unknown>>('/auth/me', token)
        setMe(body)
        setAccountDisplayName(typeof body.displayName === 'string' ? body.displayName : '')
      } catch {
        /* session may be invalid */
      }
    },
    [setAccountDisplayName, setMe],
  )

  const authApi: AuthApiClient = useMemo(
    () => createAuthApiClient({ accessToken, refreshToken, saveTokens }),
    [accessToken, refreshToken, saveTokens],
  )

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
            setError(
              'Your session no longer matches this server (for example after a database reset). Please sign in again.',
            )
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
  }, [accessToken, clearTokens, setConsents, setError])

  useEffect(() => {
    if (!showConsentOnboarding) return
    setError(null)
    setOnboardingGrants({
      data_collection: false,
      ai_processing: false,
      analytics: false,
      marketing_email: false,
    })
  }, [showConsentOnboarding, setError])

  useEffect(() => {
    if (window.location.pathname.includes('oauth/callback')) {
      const o = readOAuthHash()
      if (o) {
        saveTokens(o.access, o.refresh)
        rotateLoginGreeting()
        setMessage('Signed in with OAuth.')
        window.history.replaceState({}, '', '/')
        void fetchCsrf(o.access)
        void syncMeFromToken(o.access)
      }
    }
  }, [rotateLoginGreeting, saveTokens, setMessage, syncMeFromToken])

  const submitConsentOnboarding = useCallback(
    async (e: FormEvent) => {
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
        const types: AllConsentType[] = [
          'data_collection',
          'ai_processing',
          'analytics',
          'marketing_email',
        ]
        for (const ct of types) {
          const { response, data: body } = await authApi.request('/profile/consents', {
            method: 'POST',
            body: JSON.stringify({
              consentType: ct,
              granted: onboardingGrants[ct],
              source: 'initial_login',
            }),
          })
          if (!response.ok) {
            if (response.status === 401) clearTokens()
            setError(
              response.status === 401
                ? 'Your session is no longer valid. Please sign in again.'
                : publicErrorMessage(body, response),
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
    },
    [
      accessToken,
      authApi,
      clearTokens,
      onboardingGrants,
      setBusy,
      setConsents,
      setError,
      setMessage,
    ],
  )

  return {
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
  }
}
