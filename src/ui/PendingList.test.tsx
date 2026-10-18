import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { WaitingMedia } from '../upload/api'
import { groupWaiting } from '../upload/waitingMedia'
import { PendingList } from './PendingList'

const item = (target: string, name: string, role: 'THUMBNAIL' | 'GALLERY', order: number): WaitingMedia => ({
  target, name, role, order, altText: null, uploadedFileId: 'f', url: `http://x/${name}-${order}.png`, mediaType: 'IMAGE', reservedAt: '2026-10-18T10:00:00',
})

const noop = () => {}
const render = (props: Partial<Parameters<typeof PendingList>[0]>) =>
  renderToStaticMarkup(<PendingList places={[]} loaded connected loading={false} onRefresh={noop} {...props} />)

describe('PendingList', () => {
  it('lists each pending place with its images, kind and whether a row is loaded', () => {
    const places = groupWaiting(
      [item('product', 'ring-a', 'THUMBNAIL', 1), item('product', 'ring-a', 'GALLERY', 2), item('variant', 'SKU-1', 'GALLERY', 1)],
      { product: new Set(['ring-a']) },
    )
    const html = render({ places })
    expect(html).toContain('Pending images')
    expect(html).toContain('1 of 2 have a row in your loaded files')
    expect(html).toContain('ring-a')
    expect(html).toContain('thumbnail + 1 gallery')
    expect(html).toContain('http://x/ring-a-1.png')
    expect(html).toContain('http://x/ring-a-2.png')
    expect(html).toContain('row loaded')
    expect(html).toContain('SKU-1')
    expect(html).toContain('no row')
    expect(html).toContain('Variants 1')
  })

  it('explains an empty list, an unloaded list and a missing connection', () => {
    expect(render({})).toContain('Nothing is pending')
    expect(render({ loaded: false })).toContain('Not loaded yet')
    expect(render({ loaded: false, connected: false })).toContain('Connect to the store')
  })

  it('has an "Assemble in graph" button on each row, and one for everything shown, only when the app can assemble', () => {
    const places = groupWaiting([item('product', 'ring-a', 'THUMBNAIL', 1), item('variant', 'SKU-1', 'GALLERY', 1)])
    const withButtons = render({ places, onAssemble: noop })
    expect(withButtons.match(/Assemble in graph/g)).toHaveLength(2)
    expect(withButtons).toContain('Assemble all in graph')
    expect(render({ places })).not.toContain('Assemble')
  })
})
