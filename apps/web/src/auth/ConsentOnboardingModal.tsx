import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  ALL_CONSENT_TYPES,
  CONSENT_ONBOARDING_COPY,
  type AllConsentType,
} from './consent'

type ConsentOnboardingModalProps = {
  busy: boolean
  error: string | null
  onboardingGrants: Record<AllConsentType, boolean>
  setOnboardingGrants: Dispatch<SetStateAction<Record<AllConsentType, boolean>>>
  onSubmit: (e: FormEvent) => void
}

export function ConsentOnboardingModal({
  busy,
  error,
  onboardingGrants,
  setOnboardingGrants,
  onSubmit,
}: ConsentOnboardingModalProps) {
  return (
    <div
      className="consentModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-onboarding-title"
    >
      <div className="consentModalCard card">
        <h2 id="consent-onboarding-title">Review your consents</h2>
        <p className="hint">
          Before you continue, please confirm how we may use your information. You can update these
          choices later under Privacy.
        </p>
        {error ? <p className="err">{error}</p> : null}
        <form onSubmit={onSubmit} className="form consentOnboardingForm">
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
  )
}
