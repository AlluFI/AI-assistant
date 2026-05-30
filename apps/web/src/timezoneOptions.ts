/** Common IANA timezones for profile / meal-plan scheduling. */
export const TIMEZONE_GROUPS: ReadonlyArray<{ label: string; zones: readonly string[] }> = [
  {
    label: 'UTC',
    zones: ['UTC'],
  },
  {
    label: 'Europe',
    zones: [
      'Europe/Helsinki',
      'Europe/Stockholm',
      'Europe/Oslo',
      'Europe/Copenhagen',
      'Europe/Berlin',
      'Europe/Paris',
      'Europe/London',
      'Europe/Dublin',
      'Europe/Amsterdam',
      'Europe/Warsaw',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Athens',
      'Europe/Istanbul',
    ],
  },
  {
    label: 'Americas',
    zones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'America/Vancouver',
      'America/Sao_Paulo',
      'America/Mexico_City',
    ],
  },
  {
    label: 'Asia & Pacific',
    zones: [
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Australia/Sydney',
      'Pacific/Auckland',
    ],
  },
]

export const ALL_LISTED_TIMEZONES = new Set(
  TIMEZONE_GROUPS.flatMap((g) => g.zones),
)

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isListedTimezone(tz: string): boolean {
  return ALL_LISTED_TIMEZONES.has(tz.trim())
}

/** Options for &lt;select&gt;, including a saved value not in the curated list. */
export function timezoneGroupsForSelect(current: string) {
  const trimmed = current.trim()
  if (!trimmed || isListedTimezone(trimmed)) {
    return TIMEZONE_GROUPS
  }
  return [{ label: 'Your saved timezone', zones: [trimmed] as readonly string[] }, ...TIMEZONE_GROUPS]
}
