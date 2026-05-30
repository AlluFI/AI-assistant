import { apiErrorMessage } from './apiError'
import { apiBase } from './apiClient'
import { readApiJson } from './apiJson'

export { apiBase }

export function getCookieValue(name: string): string | null {
  const source = document.cookie
  if (!source) return null
  const item = source
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
  if (!item) return null
  return decodeURIComponent(item.slice(name.length + 1))
}

export type PublicApiOptions = {
  method?: string
  body?: unknown
  accessToken?: string
  csrfToken?: string
}

/** JSON request without throwing on HTTP errors (for auth flows that branch on status). */
export async function apiPublicJson<T = Record<string, unknown>>(
  path: string,
  options: PublicApiOptions = {},
): Promise<{ response: Response; data: T }> {
  const { method = 'GET', body, accessToken, csrfToken } = options
  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD'
  const headers: Record<string, string> = {}
  if (hasBody) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (csrfToken) headers['x-csrf-token'] = csrfToken

  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  })
  const data = await readApiJson<T & { message?: string }>(res)
  return { response: res, data: data as T }
}

export function publicErrorMessage(data: unknown, response: Response): string {
  return apiErrorMessage(data, response)
}

export async function fetchCsrf(accessToken: string): Promise<void> {
  await fetch(`${apiBase}/auth/csrf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>

export type CreateAuthFetchOptions = {
  accessToken: string | null
  refreshToken: string | null
  saveTokens: (access: string, refresh: string | null) => void
}

/** Authenticated fetch with automatic token refresh on 401. */
export function createAuthFetch({
  accessToken,
  refreshToken,
  saveTokens,
}: CreateAuthFetchOptions): AuthFetch {
  return async (path: string, init: RequestInit = {}) => {
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
        if (init.body && !h2.has('Content-Type')) {
          h2.set('Content-Type', 'application/json')
        }
        res = await fetch(`${apiBase}${path}`, { ...init, headers: h2 })
      }
    }
    return res
  }
}

export type AuthApiResult<T> = {
  data: T
  response: Response
}

async function authJson<T>(
  fetch: AuthFetch,
  path: string,
  init: RequestInit = {},
): Promise<AuthApiResult<T>> {
  const method = init.method ?? 'GET'
  const hasBody = init.body !== undefined && method !== 'GET' && method !== 'HEAD'
  const headers = new Headers(init.headers)
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { ...init, method, headers })
  const data = await readApiJson<T & { message?: string }>(res)
  return { data: data as T, response: res }
}

function assertOk<T>({ data, response }: AuthApiResult<T>): T {
  if (!response.ok) {
    throw new Error(apiErrorMessage(data, response))
  }
  return data
}

/** Session-aware JSON client (refresh on 401). Use in `App.tsx` and other authenticated shell code. */
export function createAuthApiClient(options: CreateAuthFetchOptions) {
  const fetch = createAuthFetch(options)

  async function request<T>(path: string, init: RequestInit = {}): Promise<AuthApiResult<T>> {
    return authJson<T>(fetch, path, init)
  }

  async function get<T>(path: string): Promise<T> {
    return assertOk(await request<T>(path))
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    return assertOk(
      await request<T>(path, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    )
  }

  async function patch<T>(path: string, body?: unknown): Promise<T> {
    return assertOk(
      await request<T>(path, {
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    )
  }

  async function delete_<T>(path: string): Promise<T> {
    return assertOk(await request<T>(path, { method: 'DELETE' }))
  }

  return { fetch, request, get, post, patch, delete: delete_ }
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>
