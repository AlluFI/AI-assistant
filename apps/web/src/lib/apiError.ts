export function apiErrorMessage(body: unknown, res: Response): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    if (typeof o.message === 'string') return o.message
    if (Array.isArray(o.message)) return o.message.map(String).join('; ')
  }
  return `Request failed (HTTP ${res.status})`
}
