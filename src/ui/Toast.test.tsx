import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ToastList } from './Toast'

const toast = (id: number, kind: 'error' | 'success' | 'info', message: string, count = 1) => ({ id, kind, message, count })

describe('ToastList', () => {
  it('shows nothing when there is no toast', () => {
    expect(renderToStaticMarkup(<ToastList toasts={[]} onDismiss={() => {}} />)).toBe('')
  })

  it('marks errors as alerts, the rest as status, and counts repeats', () => {
    const html = renderToStaticMarkup(
      <ToastList toasts={[toast(1, 'error', 'a.png was not uploaded: too large', 3), toast(2, 'success', '4 files uploaded.')]} onDismiss={() => {}} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('role="status"')
    expect(html).toContain('a.png was not uploaded: too large')
    expect(html).toContain('×3')
    expect(html).toContain('4 files uploaded.')
    expect(html).toContain('aria-label="Dismiss"')
  })
})
