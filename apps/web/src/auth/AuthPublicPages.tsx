import type { FormEvent } from 'react'
import { pathHas } from './authPaths'

type AuthPublicPagesProps = {
  busy: boolean
  error: string | null
  verifyEmailSuccess: string | null
  resetPath: boolean
  emailChangePath: boolean
  resetPassword: string
  setResetPassword: (value: string) => void
  resetPasswordConfirm: string
  setResetPasswordConfirm: (value: string) => void
  resetFlowSuccess: string | null
  emailChangeFlowSuccess: string | null
  submitReset: (e: FormEvent) => void
}

export function AuthPublicPages({
  busy,
  error,
  verifyEmailSuccess,
  resetPath,
  emailChangePath,
  resetPassword,
  setResetPassword,
  resetPasswordConfirm,
  setResetPasswordConfirm,
  resetFlowSuccess,
  emailChangeFlowSuccess,
  submitReset,
}: AuthPublicPagesProps) {
  return (
    <>
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
    </>
  )
}
