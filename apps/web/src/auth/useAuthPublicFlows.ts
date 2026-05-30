import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiPublicJson, publicErrorMessage } from '../lib/authApiClient'
import { pathHas } from './authPaths'

const SUCCESS_MESSAGE_AUTO_DISMISS_MS = 4500

type UseAuthPublicFlowsOptions = {
  setBusy: (value: boolean) => void
  setError: (value: string | null) => void
  setMessage: (value: string | null) => void
}

export function useAuthPublicFlows({
  setBusy,
  setError,
  setMessage,
}: UseAuthPublicFlowsOptions) {
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
  const [verifyEmailSuccess, setVerifyEmailSuccess] = useState<string | null>(null)
  const [resetFlowSuccess, setResetFlowSuccess] = useState<string | null>(null)
  const [emailChangeFlowSuccess, setEmailChangeFlowSuccess] = useState<string | null>(null)

  const verify = useCallback(
    async (token: string) => {
      setBusy(true)
      setError(null)
      setMessage(null)
      setVerifyEmailSuccess(null)
      try {
        const { response, data: body } = await apiPublicJson<{ message?: string }>(
          '/auth/verify-email',
          { method: 'POST', body: { token } },
        )
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
          return
        }
        setVerifyEmailSuccess(body.message ?? 'Verified.')
        window.history.replaceState({}, '', window.location.pathname)
      } finally {
        setBusy(false)
      }
    },
    [setBusy, setError, setMessage],
  )

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    if (t && pathHas('verify-email')) void verify(t)
  }, [verify])

  const submitReset = useCallback(
    async (e: FormEvent) => {
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
        const { response, data: body } = await apiPublicJson<{ message?: string }>(
          '/auth/reset-password',
          { method: 'POST', body: { token: resetToken, password: resetPassword } },
        )
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
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
    },
    [
      resetPassword,
      resetPasswordConfirm,
      resetToken,
      setBusy,
      setError,
      setMessage,
    ],
  )

  const confirmEmailChange = useCallback(
    async (token: string) => {
      setBusy(true)
      setError(null)
      setMessage(null)
      try {
        const { response, data: body } = await apiPublicJson<{ message?: string }>(
          '/auth/change-email/confirm',
          { method: 'POST', body: { token } },
        )
        if (!response.ok) {
          setError(publicErrorMessage(body, response))
          return
        }
        setMessage(null)
        setEmailChangeFlowSuccess(body.message ?? 'Email updated.')
        window.history.replaceState({}, '', '/')
      } finally {
        setBusy(false)
      }
    },
    [setBusy, setError, setMessage],
  )

  useEffect(() => {
    if (emailChangeToken && pathHas('confirm-email-change')) {
      void confirmEmailChange(emailChangeToken)
    }
  }, [confirmEmailChange, emailChangeToken])

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

  const resetPath =
    window.location.pathname.includes('reset-password') || Boolean(resetToken)
  const emailChangePath =
    window.location.pathname.includes('confirm-email-change') || Boolean(emailChangeToken)

  return {
    resetToken,
    resetPath,
    emailChangePath,
    resetPassword,
    setResetPassword,
    resetPasswordConfirm,
    setResetPasswordConfirm,
    verifyEmailSuccess,
    resetFlowSuccess,
    emailChangeFlowSuccess,
    submitReset,
  }
}
