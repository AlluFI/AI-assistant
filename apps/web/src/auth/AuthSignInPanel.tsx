import { apiBase } from '../lib/authApiClient'
import type { useSignInAuth } from './useSignInAuth'

type SignInAuth = ReturnType<typeof useSignInAuth>

type AuthSignInPanelProps = SignInAuth & {
  busy: boolean
}

export function AuthSignInPanel({
  busy,
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
}: AuthSignInPanelProps) {
  return (
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
                onClick={() => setAuthAccordion((p) => (p === 'google' ? null : 'google'))}
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
                onClick={() => setAuthAccordion((p) => (p === 'github' ? null : 'github'))}
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
                onClick={() => setAuthAccordion((p) => (p === 'register' ? null : 'register'))}
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
  )
}
