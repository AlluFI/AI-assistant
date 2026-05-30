import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiPublicJson, fetchCsrf, publicErrorMessage } from '../lib/authApiClient'

type UseSignInAuthOptions = {
  setBusy: (value: boolean) => void
  setError: (value: string | null) => void
  setMessage: (value: string | null) => void
  setMe: (value: object | null) => void
  saveTokens: (access: string, refresh: string | null) => void
  rotateLoginGreeting: () => void
  syncMeFromToken: (token: string) => Promise<void>
}

export function useSignInAuth({
  setBusy,
  setError,
  setMessage,
  setMe,
  saveTokens,
  rotateLoginGreeting,
  syncMeFromToken,
}: UseSignInAuthOptions) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBackup, setMfaBackup] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [authAccordion, setAuthAccordion] = useState<
    'email' | 'google' | 'github' | 'register' | null
  >('email')
  const [emailAuthMode, setEmailAuthMode] = useState<'login' | 'forgot'>('login')

  useEffect(() => {
    if (authAccordion !== 'email') setEmailAuthMode('login')
  }, [authAccordion])

  const login = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setBusy(true)
      setError(null)
      setMessage(null)
      setMe(null)
      setMfaToken(null)
      try {
        const { response, data: body } = await apiPublicJson<{
          mfaRequired?: boolean
          mfaToken?: string
          accessToken?: string
          refreshToken?: string
        }>('/auth/login', {
          method: 'POST',
          body: { email: loginEmail, password: loginPassword },
        })
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
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
          await fetchCsrf(body.accessToken)
          void syncMeFromToken(body.accessToken)
        }
      } finally {
        setBusy(false)
      }
    },
    [
      loginEmail,
      loginPassword,
      rotateLoginGreeting,
      saveTokens,
      setBusy,
      setError,
      setMe,
      setMessage,
      syncMeFromToken,
    ],
  )

  const completeMfa = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!mfaToken) return
      setBusy(true)
      setError(null)
      try {
        const { response, data: body } = await apiPublicJson<{
          accessToken?: string
          refreshToken?: string
        }>('/auth/mfa/complete', {
          method: 'POST',
          body: {
            mfaToken,
            totpCode: mfaCode || undefined,
            backupCode: mfaBackup || undefined,
          },
        })
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
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
          await fetchCsrf(body.accessToken)
          void syncMeFromToken(body.accessToken)
        }
      } finally {
        setBusy(false)
      }
    },
    [
      mfaBackup,
      mfaCode,
      mfaToken,
      rotateLoginGreeting,
      saveTokens,
      setBusy,
      setError,
      setMessage,
      syncMeFromToken,
    ],
  )

  const register = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setBusy(true)
      setError(null)
      setMessage(null)
      try {
        if (password !== registerPasswordConfirm) {
          setError('Passwords do not match.')
          return
        }
        const { response, data: body } = await apiPublicJson<{ message?: string }>(
          '/auth/register',
          { method: 'POST', body: { email, password } },
        )
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
          return
        }
        setMessage(body.message ?? 'Registered.')
        setPassword('')
        setRegisterPasswordConfirm('')
      } finally {
        setBusy(false)
      }
    },
    [
      email,
      password,
      registerPasswordConfirm,
      setBusy,
      setError,
      setMessage,
    ],
  )

  const forgotPassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setBusy(true)
      setError(null)
      try {
        const { response, data: body } = await apiPublicJson<{ message?: string }>(
          '/auth/forgot-password',
          { method: 'POST', body: { email: forgotEmail } },
        )
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
          return
        }
        setMessage(body.message ?? 'Check your email.')
      } finally {
        setBusy(false)
      }
    },
    [forgotEmail, setBusy, setError, setMessage],
  )

  return {
    mfaToken,
    mfaCode,
    setMfaCode,
    mfaBackup,
    setMfaBackup,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    email,
    setEmail,
    password,
    setPassword,
    registerPasswordConfirm,
    setRegisterPasswordConfirm,
    forgotEmail,
    setForgotEmail,
    authAccordion,
    setAuthAccordion,
    emailAuthMode,
    setEmailAuthMode,
    login,
    completeMfa,
    register,
    forgotPassword,
  }
}
