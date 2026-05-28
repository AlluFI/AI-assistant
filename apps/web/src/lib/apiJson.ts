/** Parse JSON from an API response; surface HTML/proxy errors clearly. */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) {
    if (res.status === 504 || res.status === 502) {
      throw new Error(
        'The request timed out. Weekly meal plans can take longer — try again in a moment, or generate a daily plan first.',
      )
    }
    throw new Error(
      `Server returned an unexpected page (HTTP ${res.status}). Check that the API is running and reachable.`,
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON from server (HTTP ${res.status}).`)
  }
}
