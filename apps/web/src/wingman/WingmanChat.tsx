import { useCallback, useEffect, useRef, useState } from 'react'
import { readApiJson } from '../lib/apiJson'
import { WingmanChart } from './WingmanChart'
import {
  WINGMAN_STARTER_PROMPTS,
  type WingmanCoachingMode,
  type WingmanMessage,
  type WingmanNudges,
  type WingmanOnboardingStatus,
  type WingmanUiBlock,
} from './types'
import './wingman.css'

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>

const THREAD_KEY = 'wingmanThreadId'
const STREAMING_ENABLED = import.meta.env.VITE_ASSISTANT_STREAMING !== 'false'

type Props = {
  authFetch: AuthFetch
  showReminderDot: boolean
  onboarding?: WingmanOnboardingStatus | null
  onOnboardingRefresh?: () => void
  onOpenRecord: (focus?: 'weight' | 'activity' | 'overview') => void
  onOpenNutrition: (opts?: { shoppingListId?: string }) => void
  onOpenInsights: () => void
  onDataChanged: () => void
}

type ThreadPayload = {
  id: string
  coachingMode?: WingmanCoachingMode
  messages: WingmanMessage[]
}

type ThreadListItem = {
  id: string
  title: string | null
  coachingMode?: WingmanCoachingMode
  updatedAt: string
  messageCount: number
  lastMessageAt: string | null
  preview: string | null
  previewRole: string | null
}

function formatThreadWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onboardingOpenerMessage(opener: WingmanOnboardingStatus['opener']): WingmanMessage {
  return {
    id: `onboarding-opener-${Date.now()}`,
    role: 'assistant',
    content: opener.content,
    uiBlocks: opener.uiBlocks,
  }
}

function nudgesToMessage(nudges: WingmanNudges): WingmanMessage {
  return {
    id: `nudge-${Date.now()}`,
    role: 'assistant',
    content: nudges.lines.join('\n\n'),
    uiBlocks: nudges.uiBlocks,
  }
}

function renderUiBlock(
  block: WingmanUiBlock,
  key: string,
  busy: boolean,
  runCta: (b: WingmanUiBlock) => void,
) {
  if (block.type === 'chart') {
    return <WingmanChart key={key} block={block} />
  }
  if (block.type === 'hint') {
    return (
      <p key={key} className="wingmanHint">
        {block.text}
      </p>
    )
  }
  if (block.type === 'cta') {
    return (
      <button
        key={key}
        type="button"
        className="wingmanCta"
        disabled={busy}
        onClick={() => void runCta(block)}
      >
        {block.label}
      </button>
    )
  }
  return null
}

export function WingmanChat({
  authFetch,
  showReminderDot,
  onboarding = null,
  onOnboardingRefresh,
  onOpenRecord,
  onOpenNutrition,
  onOpenInsights,
  onDataChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(() =>
    sessionStorage.getItem(THREAD_KEY),
  )
  const [messages, setMessages] = useState<WingmanMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coachingMode, setCoachingMode] = useState<WingmanCoachingMode>('balanced')
  const [showMemory, setShowMemory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [threadList, setThreadList] = useState<ThreadListItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [memory, setMemory] = useState<{
    narrative: string | null
    facts: Array<{ category: string; text: string }>
    updatedAt: string
  } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const onboardingAutoOpened = useRef(false)
  const onboardingActive = Boolean(onboarding?.active)
  const effectiveCoachingMode: WingmanCoachingMode = onboardingActive
    ? 'onboarding'
    : coachingMode

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (open) scrollToBottom()
  }, [open, messages, scrollToBottom])

  const ensureThread = useCallback(async () => {
    if (threadId) return threadId
    const res = await authFetch('/assistant/threads', {
      method: 'POST',
      body: JSON.stringify({
        title: onboardingActive ? 'Setup' : 'Wingman',
        coachingMode: onboardingActive ? 'onboarding' : undefined,
      }),
    })
    const body = await readApiJson<{ id: string }>(res)
    if (!res.ok) throw new Error('Could not start chat thread')
    setThreadId(body.id)
    sessionStorage.setItem(THREAD_KEY, body.id)
    if (onboardingActive) setCoachingMode('onboarding')
    return body.id
  }, [authFetch, onboardingActive, threadId])

  const loadThread = useCallback(
    async (id: string) => {
      const res = await authFetch(`/assistant/threads/${id}`)
      const body = await readApiJson<ThreadPayload>(res)
      if (!res.ok) {
        sessionStorage.removeItem(THREAD_KEY)
        setThreadId(null)
        return false
      }
      const mapped = body.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          uiBlocks: m.uiBlocks as WingmanUiBlock[] | undefined,
        }))
      if (
        body.coachingMode === 'nutrition' ||
        body.coachingMode === 'wellness' ||
        body.coachingMode === 'onboarding'
      ) {
        setCoachingMode(body.coachingMode)
      }
      if (mapped.length > 0) {
        setMessages(mapped)
        return true
      }
      return false
    },
    [authFetch],
  )

  const loadThreads = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await authFetch('/assistant/threads')
      const body = await readApiJson<ThreadListItem[]>(res)
      if (res.ok && Array.isArray(body)) setThreadList(body)
    } catch {
      /* keep previous list */
    } finally {
      setHistoryLoading(false)
    }
  }, [authFetch])

  const loadOpening = useCallback(async () => {
    const res = await authFetch('/assistant/nudges')
    const nudges = await readApiJson<WingmanNudges>(res)
    if (!res.ok) throw new Error('Could not load wingman nudges')
    setMessages([nudgesToMessage(nudges)])
  }, [authFetch])

  const switchThread = useCallback(
    async (id: string) => {
      setBusy(true)
      setError(null)
      try {
        setThreadId(id)
        sessionStorage.setItem(THREAD_KEY, id)
        const ok = await loadThread(id)
        if (!ok) await loadOpening()
        setShowHistory(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open conversation')
      } finally {
        setBusy(false)
      }
    },
    [loadOpening, loadThread],
  )

  const startNewChat = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/assistant/threads', {
        method: 'POST',
        body: JSON.stringify({ title: 'Wingman', coachingMode: 'balanced' }),
      })
      const body = await readApiJson<{ id: string }>(res)
      if (!res.ok) throw new Error('Could not start a new chat')
      setThreadId(body.id)
      sessionStorage.setItem(THREAD_KEY, body.id)
      setCoachingMode('balanced')
      if (onboarding?.active && onboarding.opener) {
        setCoachingMode('onboarding')
        setMessages([onboardingOpenerMessage(onboarding.opener)])
      } else {
        await loadOpening()
      }
      setShowHistory(false)
      void loadThreads()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a new chat')
    } finally {
      setBusy(false)
    }
  }, [authFetch, loadOpening, loadThreads, onboarding])

  const loadMemory = useCallback(async () => {
    const res = await authFetch('/assistant/memory')
    const body = await readApiJson<{
      narrative: string | null
      facts: Array<{ category: string; text: string }>
      updatedAt: string
    }>(res)
    if (res.ok) setMemory(body)
  }, [authFetch])

  const clearMemory = useCallback(async () => {
    setBusy(true)
    try {
      const res = await authFetch('/assistant/memory', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not clear memory')
      setMemory({ narrative: null, facts: [], updatedAt: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clear memory failed')
    } finally {
      setBusy(false)
    }
  }, [authFetch])

  const showOnboardingOpener = useCallback(() => {
    if (onboarding?.active && onboarding.opener) {
      setCoachingMode('onboarding')
      setMessages([onboardingOpenerMessage(onboarding.opener)])
    }
  }, [onboarding])

  const openPanel = useCallback(async () => {
    setOpen(true)
    setError(null)
    setBusy(true)
    try {
      const stored = threadId ?? sessionStorage.getItem(THREAD_KEY)
      if (stored) {
        setThreadId(stored)
        const ok = await loadThread(stored)
        if (ok) return
      }
      await ensureThread()
      if (onboarding?.active && onboarding.opener) {
        showOnboardingOpener()
      } else {
        await loadOpening()
      }
      void loadMemory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open wingman')
    } finally {
      setBusy(false)
    }
  }, [
    ensureThread,
    loadMemory,
    loadOpening,
    loadThread,
    onboarding,
    showOnboardingOpener,
    threadId,
  ])

  useEffect(() => {
    if (!onboardingActive || onboardingAutoOpened.current) return
    onboardingAutoOpened.current = true
    void openPanel()
  }, [onboardingActive, openPanel])

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setError(null)
      const userMsg: WingmanMessage = {
        id: `local-u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      }
      setMessages((prev) => [...prev, userMsg])
      setBusy(true)
      try {
        const tid = await ensureThread()
        const payload = JSON.stringify({
          content: trimmed,
          coachingMode: effectiveCoachingMode,
        })

        if (STREAMING_ENABLED) {
          const res = await authFetch(
            `/assistant/threads/${tid}/messages/stream`,
            { method: 'POST', body: payload },
          )
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            const m = (errBody as { message?: string | string[] }).message
            throw new Error(
              Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : 'Send failed',
            )
          }
          const assistantId = `local-a-${Date.now()}`
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: '' },
          ])

          const reader = res.body?.getReader()
          if (!reader) throw new Error('Streaming not supported')
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const chunks = buffer.split('\n\n')
            buffer = chunks.pop() ?? ''
            for (const chunk of chunks) {
              const line = chunk
                .split('\n')
                .find((l) => l.startsWith('data: '))
              if (!line) continue
              const raw = line.slice(6).trim()
              if (raw === '[DONE]') continue
              const event = JSON.parse(raw) as {
                type: string
                text?: string
                content?: string
                uiBlocks?: WingmanUiBlock[]
                message?: string
                messageId?: string
              }
              if (event.type === 'token' && event.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.text }
                      : m,
                  ),
                )
              }
              if (event.type === 'done') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          id: event.messageId ?? assistantId,
                          content: event.content ?? m.content,
                          uiBlocks: event.uiBlocks as WingmanUiBlock[] | undefined,
                        }
                      : m,
                  ),
                )
              }
              if (event.type === 'error') {
                throw new Error(event.message ?? 'Stream failed')
              }
            }
          }
        } else {
          const res = await authFetch(`/assistant/threads/${tid}/messages`, {
            method: 'POST',
            body: payload,
          })
          const assistant = await readApiJson<WingmanMessage>(res)
          if (!res.ok) {
            const errBody = assistant as unknown as { message?: string | string[] }
            const m = errBody.message
            throw new Error(
              Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : 'Send failed',
            )
          }
          setMessages((prev) => [...prev, assistant])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Send failed')
      } finally {
        setBusy(false)
      }
    },
    [authFetch, busy, effectiveCoachingMode, ensureThread],
  )

  const setMode = useCallback(
    async (mode: WingmanCoachingMode) => {
      setCoachingMode(mode)
      const tid = threadId ?? sessionStorage.getItem(THREAD_KEY)
      if (!tid) return
      try {
        await authFetch(`/assistant/threads/${tid}`, {
          method: 'PATCH',
          body: JSON.stringify({ coachingMode: mode }),
        })
      } catch {
        /* mode still applies to next message */
      }
    },
    [authFetch, threadId],
  )

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void sendText(text)
  }, [input, sendText])

  const runCta = useCallback(
    async (block: WingmanUiBlock) => {
      if (block.type === 'cta') {
        if (block.action === 'open_record') {
          const focus =
            block.payload?.focus === 'weight' ||
            block.payload?.focus === 'activity' ||
            block.payload?.focus === 'overview'
              ? block.payload.focus
              : undefined
          onOpenRecord(focus)
          setOpen(false)
          return
        }
        if (block.action === 'open_nutrition') {
          const listId =
            typeof block.payload?.shoppingListId === 'string'
              ? block.payload.shoppingListId
              : undefined
          onOpenNutrition(listId ? { shoppingListId: listId } : undefined)
          setOpen(false)
          return
        }
        if (block.action === 'open_insights') {
          onOpenInsights()
          setOpen(false)
          return
        }
      }
      if (block.type !== 'cta') return
      setBusy(true)
      setError(null)
      try {
        const res = await authFetch('/assistant/actions/confirm', {
          method: 'POST',
          body: JSON.stringify({
            action: block.action,
            payload: block.payload ?? {},
          }),
        })
        const body = await readApiJson<{
          message?: string
          uiBlocks?: WingmanUiBlock[]
        }>(res)
        if (!res.ok) throw new Error('Could not complete action')
        onDataChanged()
        onOnboardingRefresh?.()
        setMessages((prev) => [
          ...prev,
          {
            id: `local-a-${Date.now()}`,
            role: 'assistant',
            content: body.message ?? 'Saved.',
            uiBlocks: body.uiBlocks,
          },
        ])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(false)
      }
    },
    [authFetch, onDataChanged, onOnboardingRefresh, onOpenInsights, onOpenNutrition, onOpenRecord],
  )

  const skipSetup = useCallback(async () => {
    setBusy(true)
    try {
      const res = await authFetch('/assistant/onboarding/skip', { method: 'POST' })
      if (!res.ok) throw new Error('Could not skip setup')
      onOnboardingRefresh?.()
      onDataChanged()
      setMessages((prev) => [
        ...prev,
        {
          id: `local-a-${Date.now()}`,
          role: 'assistant',
          content:
            'Setup skipped. Ask me anytime to set targets, meal times, or log weight and activities.',
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Skip failed')
    } finally {
      setBusy(false)
    }
  }, [authFetch, onDataChanged, onOnboardingRefresh])

  const showStarterChips =
    !onboardingActive && !messages.some((m) => m.role === 'user')

  return (
    <>
      <button
        type="button"
        className={`wingmanFab${showReminderDot || onboardingActive ? ' hasReminder' : ''}`}
        aria-label={open ? 'Close wingman chat' : 'Open wingman chat'}
        title="Wellness wingman"
        onClick={() => (open ? setOpen(false) : void openPanel())}
      >
        {open ? '×' : '💬'}
      </button>

      {open ? (
        <div
          className={`wingmanPanel${showHistory ? ' wingmanPanel--historyOpen' : ''}`}
          role="dialog"
          aria-label="Wellness wingman chat"
        >
          <header className="wingmanHeader">
            <div>
              <h2>{onboardingActive ? 'Setup with Wingman' : 'Wingman'}</h2>
              {onboardingActive && onboarding ? (
                <p>{`Step ${Math.min(onboarding.steps.length, onboarding.steps.findIndex((s) => s.id === onboarding.step) + 1 || 1)} of ${onboarding.steps.length} · answer in chat or tap confirm`}</p>
              ) : null}
              {onboardingActive && onboarding ? (
                <div
                  className="wingmanOnboardingProgress"
                  role="progressbar"
                  aria-valuenow={onboarding.percentComplete}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {onboarding.steps.map((s) => (
                    <span
                      key={s.id}
                      className={`wingmanOnboardingStep${s.done ? ' done' : s.id === onboarding.step ? ' current' : ''}`}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="wingmanModeRow" role="group" aria-label="Coaching mode">
                  {(['balanced', 'nutrition', 'wellness'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`wingmanModeBtn${coachingMode === mode ? ' active' : ''}`}
                      disabled={busy}
                      onClick={() => void setMode(mode)}
                    >
                      {mode === 'balanced'
                        ? 'Balanced'
                        : mode === 'nutrition'
                          ? 'Nutrition'
                          : 'Wellness'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="wingmanHeaderActions">
              {onboardingActive ? (
                <button
                  type="button"
                  className="secondary wingmanSkipSetup"
                  disabled={busy}
                  onClick={() => void skipSetup()}
                >
                  Skip setup
                </button>
              ) : null}
              <button
                type="button"
                className={`wingmanHistoryBtn${showHistory ? ' active' : ''}`}
                hidden={onboardingActive}
                aria-expanded={showHistory}
                disabled={busy}
                onClick={() => {
                  setShowHistory((v) => !v)
                  setShowMemory(false)
                  void loadThreads()
                }}
              >
                History
              </button>
              <button
                type="button"
                className={`wingmanMemoryBtn${showMemory ? ' active' : ''}`}
                hidden={onboardingActive}
                aria-expanded={showMemory}
                disabled={busy}
                onClick={() => {
                  setShowMemory((v) => !v)
                  setShowHistory(false)
                  void loadMemory()
                }}
              >
                Memory
              </button>
              <button
                type="button"
                className="wingmanClose"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {showHistory ? (
            <section className="wingmanHistoryPanel" aria-label="Past conversations">
              <div className="wingmanHistoryHead">
                <p className="wingmanHistoryIntro">Earlier Wingman chats on this account.</p>
                <button
                  type="button"
                  className="wingmanHistoryNew"
                  disabled={busy}
                  onClick={() => void startNewChat()}
                >
                  New chat
                </button>
              </div>
              {historyLoading ? (
                <p className="wingmanHistoryEmpty">Loading…</p>
              ) : threadList.length === 0 ? (
                <p className="wingmanHistoryEmpty">No saved conversations yet.</p>
              ) : (
                <ul className="wingmanHistoryList">
                  {threadList.map((t) => {
                    const active = t.id === threadId
                    const label =
                      t.title?.trim() ||
                      (t.preview
                        ? t.preview.slice(0, 48) + (t.preview.length > 48 ? '…' : '')
                        : 'Conversation')
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          className={`wingmanHistoryItem${active ? ' active' : ''}`}
                          disabled={busy}
                          onClick={() => void switchThread(t.id)}
                        >
                          <span className="wingmanHistoryTitle">{label}</span>
                          <span className="wingmanHistoryMeta">
                            {formatThreadWhen(t.updatedAt)}
                            {t.messageCount > 0 ? ` · ${t.messageCount} messages` : ''}
                          </span>
                          {t.preview && t.id !== threadId ? (
                            <span className="wingmanHistoryPreview">{t.preview}</span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {showMemory ? (
            <section className="wingmanMemoryPanel" aria-label="Long-term memory">
              <p className="wingmanMemoryIntro">
                Saved across all chats (not this thread only). Profile restrictions are
                seeded automatically.
              </p>
              {memory?.narrative ? (
                <p className="wingmanMemoryNarrative">{memory.narrative}</p>
              ) : null}
              {memory?.facts?.length ? (
                <ul className="wingmanMemoryList">
                  {memory.facts.map((f) => (
                    <li key={`${f.category}-${f.text}`}>
                      <span className="wingmanMemoryTag">{f.category}</span> {f.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="wingmanMemoryEmpty">No long-term memory yet — chat to build it.</p>
              )}
              <button
                type="button"
                className="wingmanMemoryClear"
                disabled={busy || !memory?.facts?.length && !memory?.narrative}
                onClick={() => void clearMemory()}
              >
                Clear memory
              </button>
            </section>
          ) : null}

          {error ? <p className="wingmanErr">{error}</p> : null}

          {showStarterChips ? (
            <div className="wingmanStarters">
              {WINGMAN_STARTER_PROMPTS[
                coachingMode === 'onboarding' ? 'balanced' : coachingMode
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="wingmanStarterChip"
                  disabled={busy}
                  onClick={() => void sendText(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <div className="wingmanMessages" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`wingmanMsg ${m.role}`}>
                {m.content}
                {m.uiBlocks?.length ? (
                  <div className="wingmanBlocks">
                    {m.uiBlocks.map((b, i) =>
                      renderUiBlock(b, `${m.id}-block-${i}`, busy, runCta),
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <p className="wingmanMsg assistant wingmanTyping">…</p> : null}
          </div>

          <form
            className="wingmanComposer"
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage()
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or e.g. record 1 hour tennis for today"
              disabled={busy}
              aria-label="Message wingman"
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      ) : null}
    </>
  )
}
