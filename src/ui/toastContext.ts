import { createContext, useContext } from 'react'

export type ToastKind = 'error' | 'success' | 'info'

export interface Toasts {
  error: (message: string) => void
  success: (message: string) => void
  info: (message: string) => void
}

/** Without a provider (tests, isolated components) a toast is simply dropped. */
export const ToastContext = createContext<Toasts>({ error: () => {}, success: () => {}, info: () => {} })

export const useToast = (): Toasts => useContext(ToastContext)
