import { apiErrorMessage } from './apiError'
import { readApiJson } from './apiJson'

export const apiBase = import.meta.env.VITE_API_BASE ?? '/api'

export type ApiRequestOptions = {
  accessToken: string
  method?: string
  body?: unknown
  /** Default true — parse JSON and throw on !res.ok */
  parseJson?: boolean
}

export type ApiResult<T> = {
  data: T
  response: Response
}

function authHeaders(accessToken: string, jsonBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }
  if (jsonBody) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

/**
 * Authenticated fetch with shared JSON parsing and Nest error message extraction.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions,
): Promise<ApiResult<T>> {
  const { accessToken, method = 'GET', body, parseJson = true } = options
  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD'
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: authHeaders(accessToken, hasBody),
    body: hasBody ? JSON.stringify(body) : undefined,
  })

  if (!parseJson) {
    return { data: undefined as T, response: res }
  }

  const data = await readApiJson<T & { message?: string }>(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, res))
  }
  return { data, response: res }
}

export async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const { data } = await apiRequest<T>(path, { accessToken })
  return data
}

export async function apiPost<T>(
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const { data } = await apiRequest<T>(path, {
    accessToken,
    method: 'POST',
    body,
  })
  return data
}

export async function apiPatch<T>(
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const { data } = await apiRequest<T>(path, {
    accessToken,
    method: 'PATCH',
    body,
  })
  return data
}

export async function apiPut<T>(
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const { data } = await apiRequest<T>(path, {
    accessToken,
    method: 'PUT',
    body,
  })
  return data
}

export async function apiDelete<T>(path: string, accessToken: string): Promise<T> {
  const { data } = await apiRequest<T>(path, {
    accessToken,
    method: 'DELETE',
  })
  return data
}
