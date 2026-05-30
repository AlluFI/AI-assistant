import { apiPublicJson } from '../lib/authApiClient'

export const ALL_CONSENT_TYPES = [
  'data_collection',
  'ai_processing',
  'analytics',
  'marketing_email',
] as const

export type AllConsentType = (typeof ALL_CONSENT_TYPES)[number]

export const CONSENT_ONBOARDING_COPY: Record<
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

export type FetchConsentRecordsResult =
  | { ok: true; records: Array<Record<string, unknown>> }
  | { ok: false; status: number }

export async function fetchConsentRecords(token: string): Promise<FetchConsentRecordsResult> {
  const { response, data } = await apiPublicJson<{ records?: unknown[] }>(
    '/profile/consents?limit=200',
    { accessToken: token },
  )
  const records = Array.isArray(data.records) ? data.records : []
  if (!response.ok) {
    return { ok: false, status: response.status }
  }
  return { ok: true, records: records as Array<Record<string, unknown>> }
}

export function needsConsentOnboarding(records: Array<Record<string, unknown>>): boolean {
  const present = new Set<string>()
  for (const r of records) {
    const t = r.consentType
    if (typeof t === 'string') present.add(t)
  }
  return ALL_CONSENT_TYPES.some((k) => !present.has(k))
}
