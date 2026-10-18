import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HistoryView } from './HistoryView'

describe('HistoryView', () => {
  it('asks to connect when there is no login, and does not offer filters', () => {
    const html = renderToStaticMarkup(<HistoryView connected={false} />)
    expect(html).toContain('Connect to the store to see the imports it has kept')
    expect(html).not.toContain('Filter by source')
  })

  it('offers the source and result filters and a refresh once connected', () => {
    const html = renderToStaticMarkup(<HistoryView connected />)
    expect(html).toContain('Every data import and media drop, kept by the store.')
    expect(html).toContain('aria-label="Filter by source"')
    expect(html).toContain('<option value="CLI">CLI</option>')
    expect(html).toContain('aria-label="Filter by result"')
    expect(html).toContain('<option value="PARTIAL">Partial</option>')
    expect(html).toContain('Loading…')
  })
})
