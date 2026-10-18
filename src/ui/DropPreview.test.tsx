import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildDropPlan } from '../upload/dropPlan'
import { DropPreview } from './DropPreview'

function file(path: string, bytes = 10): File {
  const f = new File([new ArrayBuffer(bytes)], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'relativePath', { value: path })
  return f
}

const noop = () => {}
const render = (paths: string[], props: Partial<Parameters<typeof DropPreview>[0]> = {}, context = {}) =>
  renderToStaticMarkup(<DropPreview plan={buildDropPlan(paths.map((p) => file(p)), context)} connected busy={false} onApply={noop} onCancel={noop} {...props} />)

describe('DropPreview', () => {
  it('summarises the drop and lists each place with its status', () => {
    const html = render(
      ['product/ring-a/thumbnail/a.png', 'product/ring-a/gallery/01_b.png', 'product/new-ring/thumbnail/c.png', 'brand/aurum/thumbnail/d.png'],
      {},
      { existing: { product: new Set(['ring-a']), brand: new Set(['aurum']) }, inFiles: { product: new Set(['new-ring']) } },
    )
    expect(html).toContain('Review before uploading')
    expect(html).toContain('4 files to upload, 4 bindings: 2 products, 1 brand')
    expect(html).toContain('2 already in the store (applied now), 1 not yet (reserved until created)')
    expect(html).toContain('ring-a')
    expect(html).toContain('thumbnail + 1 gallery')
    expect(html).toContain('in the store: applied now')
    expect(html).toContain('not in the store yet: reserved')
    expect(html).toContain('row loaded')
    expect(html).toContain('Upload 4 files')
  })

  it('lists what the store would refuse, with the reason, and what is left out', () => {
    const html = render(['variant/SKU-1/thumbnail/a.png', 'product/p/thumbnail/ok.png', 'product/p/README.md'])
    expect(html).toContain('variant/SKU-1/thumbnail/a.png')
    expect(html).toContain('will not be uploaded: variant &quot;SKU-1&quot;: a variant has no thumbnail')
    expect(html).toContain('1 file is not an image or video and will be left out (README.md)')
    expect(html).toContain('Upload 1 file<')
  })

  it('warns about two photos for one slot', () => {
    expect(render(['product/a/gallery/1_x.png', 'product/a/gallery/01_y.png'])).toContain('only one of them stays')
  })

  it('cannot be applied when nothing can be uploaded, while uploading, or when not connected', () => {
    const disabled = (html: string) => /<button class="primary"[^>]*disabled/.test(html)
    expect(disabled(render(['variant/SKU-1/thumbnail/a.png']))).toBe(true)
    expect(render(['variant/SKU-1/thumbnail/a.png'])).toContain('Nothing in this drop can be uploaded.')
    expect(disabled(render(['product/a/thumbnail/a.png'], { busy: true }))).toBe(true)
    const offline = render(['product/a/thumbnail/a.png'], { connected: false })
    expect(disabled(offline)).toBe(true)
    expect(offline).toContain('Connect to the store to upload')
    expect(disabled(render(['product/a/thumbnail/a.png']))).toBe(false)
  })
})
