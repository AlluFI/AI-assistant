import { useEffect, useState } from 'react'

function readChartTheme() {
  const s = getComputedStyle(document.documentElement)
  return {
    tick: s.getPropertyValue('--muted').trim() || '#64748b',
    text: s.getPropertyValue('--text').trim() || '#0f172a',
    border: s.getPropertyValue('--border').trim() || '#dbe4f0',
    surface: s.getPropertyValue('--bg-soft').trim() || '#f1f5f9',
  }
}

/** Recharts SVG props cannot use CSS variables; sync when data-theme changes. */
export function useChartTheme() {
  const [theme, setTheme] = useState(readChartTheme)

  useEffect(() => {
    const sync = () => setTheme(readChartTheme())
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => obs.disconnect()
  }, [])

  return theme
}
