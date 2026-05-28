export const LOGIN_GREETING_STORAGE_KEY = 'loginGreetingTemplate'

const GREETING_TEMPLATES = [
  "G'day, {name}",
  'Hello, {name}',
  'Welcome back, {name}',
  'Hey there, {name}',
  'Good to see you, {name}',
  'Hi, {name}',
  'Nice to have you back, {name}',
] as const

export function pickLoginGreetingTemplate(): string {
  const idx = Math.floor(Math.random() * GREETING_TEMPLATES.length)
  return GREETING_TEMPLATES[idx] ?? GREETING_TEMPLATES[0]
}

export function storeLoginGreetingTemplate(template: string): void {
  sessionStorage.setItem(LOGIN_GREETING_STORAGE_KEY, template)
}

export function readLoginGreetingTemplate(): string | null {
  return sessionStorage.getItem(LOGIN_GREETING_STORAGE_KEY)
}

export function clearLoginGreetingTemplate(): void {
  sessionStorage.removeItem(LOGIN_GREETING_STORAGE_KEY)
}

export function formatLoginGreeting(
  template: string,
  displayName: string | null | undefined,
  email?: string | null,
): string {
  const trimmed = displayName?.trim()
  const name =
    trimmed ||
    (email?.includes('@') ? email.split('@')[0] : null) ||
    'friend'
  return template.replace('{name}', name)
}
