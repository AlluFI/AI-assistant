import { useEffect, useRef, useState } from 'react'
import './toast.css'

const SUCCESS_AUTO_DISMISS_MS = 6000

type ToastItem = {
  id: string
  kind: 'success' | 'error'
  text: string
}

type Props = {
  message: string | null
  error: string | null
  onDismissMessage: () => void
  onDismissError: () => void
  hidden?: boolean
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: () => void
}) {
  const [paused, setPaused] = useState(false)
  const dismissTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (item.kind !== 'success' || paused) return
    dismissTimerRef.current = window.setTimeout(onDismiss, SUCCESS_AUTO_DISMISS_MS)
    return () => {
      if (dismissTimerRef.current != null) {
        window.clearTimeout(dismissTimerRef.current)
      }
    }
  }, [item.kind, item.id, onDismiss, paused])

  return (
    <div
      className={`appToast appToast-${item.kind}`}
      role={item.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="appToastText">{item.text}</p>
      <button
        type="button"
        className="appToastDismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

export function AppToast({
  message,
  error,
  onDismissMessage,
  onDismissError,
  hidden = false,
}: Props) {
  const items: ToastItem[] = []
  if (message) items.push({ id: 'success', kind: 'success', text: message })
  if (error) items.push({ id: 'error', kind: 'error', text: error })

  if (hidden || items.length === 0) return null

  return (
    <div className="appToastStack" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={item.kind === 'success' ? onDismissMessage : onDismissError}
        />
      ))}
    </div>
  )
}
