export function pathHas(segment: string) {
  return window.location.pathname.includes(segment)
}

export function readOAuthHash() {
  const h = window.location.hash.replace(/^#/, '')
  if (!h) return null
  const p = new URLSearchParams(h)
  const access = p.get('access_token')
  const refresh = p.get('refresh_token')
  if (access) return { access, refresh: refresh ?? null }
  return null
}
