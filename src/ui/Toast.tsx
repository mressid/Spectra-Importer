import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconClose } from './Icons'
import { ToastContext, type ToastKind, type Toasts } from './toastContext'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  /** The same message shown again while it is still up: counted instead of stacked. */
  count: number
}

const DURATION: Record<ToastKind, number> = { error: 9000, success: 5000, info: 5000 }
const MAX_VISIBLE = 4

/** Short messages in the bottom-right corner that go away by themselves; errors stay longer. Identical ones are merged. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const schedule = (id: number) => {
        const previous = timers.current.get(id)
        if (previous) clearTimeout(previous)
        timers.current.set(id, setTimeout(() => dismiss(id), DURATION[kind]))
      }
      setToasts((current) => {
        const same = current.find((toast) => toast.kind === kind && toast.message === message)
        if (same) {
          schedule(same.id)
          return current.map((toast) => (toast.id === same.id ? { ...toast, count: toast.count + 1 } : toast))
        }
        const id = nextId.current++
        schedule(id)
        const kept = current.slice(-(MAX_VISIBLE - 1))
        for (const dropped of current.slice(0, current.length - kept.length)) {
          const timer = timers.current.get(dropped.id)
          if (timer) clearTimeout(timer)
          timers.current.delete(dropped.id)
        }
        return [...kept, { id, kind, message, count: 1 }]
      })
    },
    [dismiss],
  )

  useEffect(() => {
    const live = timers.current
    return () => {
      for (const timer of live.values()) clearTimeout(timer)
      live.clear()
    }
  }, [])

  const api = useMemo<Toasts>(
    () => ({ error: (m) => show('error', m), success: (m) => show('success', m), info: (m) => show('info', m) }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function ToastList({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          <span className="toast-dot" aria-hidden="true" />
          <span className="toast-message">
            {toast.message}
            {toast.count > 1 && <span className="toast-count"> ×{toast.count}</span>}
          </span>
          <button className="small toast-close" type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
