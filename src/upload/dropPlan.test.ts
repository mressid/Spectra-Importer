import { describe, expect, it } from 'vitest'
import { buildDropPlan } from './dropPlan'

function file(path: string, bytes = 10): File {
  const f = new File([new ArrayBuffer(bytes)], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'relativePath', { value: path })
  return f
}

const set = (...names: string[]) => new Set(names)

describe('buildDropPlan', () => {
  it('groups the photos by place, thumbnail first, gallery in position order', () => {
    const plan = buildDropPlan([
      file('product/ring-a/gallery/02_back.png'),
      file('product/ring-a/thumbnail/cover.png'),
      file('product/ring-a/gallery/01_front.png'),
      file('category/rings/thumbnail/r.png'),
    ])
    expect(plan.places.map((p) => `${p.target}/${p.name}`)).toEqual(['product/ring-a', 'category/rings'])
    expect(plan.places[0]?.images.map((i) => `${i.role}#${i.order} ${i.file.fileName}`)).toEqual([
      'THUMBNAIL#1 cover.png',
      'GALLERY#1 01_front.png',
      'GALLERY#2 02_back.png',
    ])
    expect(plan.totals).toMatchObject({ files: 4, ready: 4, skipped: 0, bindings: 4, places: { product: 1, category: 1 } })
  })

  it('shares one photo between places', () => {
    const plan = buildDropPlan([file('[ring-a, ring-b]/gallery/01_box.png')])
    expect(plan.places.map((p) => p.name)).toEqual(['ring-a', 'ring-b'])
    expect(plan.totals).toMatchObject({ files: 1, bindings: 2 })
  })

  it('says which places exist in the store and which will be reserved, and which have a row loaded', () => {
    const plan = buildDropPlan(
      [file('product/ring-a/thumbnail/a.png'), file('product/new-ring/thumbnail/b.png'), file('variant/SKU-1/gallery/c.png')],
      { existing: { product: set('ring-a') }, inFiles: { product: set('new-ring') } },
    )
    const status = Object.fromEntries(plan.places.map((p) => [p.name, `${p.status}${p.inFiles ? '+row' : ''}`]))
    // variants were not loaded from the store: unknown, not "missing"
    expect(status).toEqual({ 'ring-a': 'in-store', 'new-ring': 'not-in-store+row', 'SKU-1': 'unknown' })
    expect(plan.totals).toMatchObject({ inStore: 1, reserved: 1 })
  })

  it('skips, with the reason, what the store would refuse', () => {
    const plan = buildDropPlan([
      file('variant/SKU-1/thumbnail/a.png'),
      file('category/rings/gallery/b.png'),
      file('product/p/thumbnail/clip.mp4'),
      file('product/p/gallery/huge.png', 6 * 1024 * 1024),
      file('product/p/gallery/vector.svg'),
      file('product/p/gallery/ok.png'),
    ])
    const problem = (name: string) => plan.files.find((f) => f.fileName === name)?.problems.join(' | ')
    expect(problem('a.png')).toContain('a variant has no thumbnail')
    expect(problem('b.png')).toContain('single image')
    expect(problem('clip.mp4')).toContain('must be an image')
    expect(problem('huge.png')).toContain('over the store')
    expect(problem('vector.svg')).toContain('.svg is not accepted')
    expect(problem('ok.png')).toBe('')
    expect(plan.totals).toMatchObject({ files: 6, ready: 1, skipped: 5, bindings: 1 })
  })

  it('a file with one refused binding is skipped as a whole (the store applies all or nothing)', () => {
    const plan = buildDropPlan([file('[product=ring-a, variant=SKU-1]/thumbnail/x.png')])
    expect(plan.files[0]?.ready).toBe(false)
    expect(plan.totals.bindings).toBe(0)
  })

  it('leaves out what is not a photo or video, and says what', () => {
    const plan = buildDropPlan([file('product/a/thumbnail/a.png'), file('product/a/README.md'), file('products.csv')])
    expect(plan.files).toHaveLength(1)
    expect(plan.ignored.map((f) => f.name)).toEqual(['README.md', 'products.csv'])
  })

  it('warns when two photos claim one slot, but not for one photo bound twice', () => {
    const clash = buildDropPlan([file('product/a/gallery/1_x.png'), file('product/a/gallery/01_y.png')])
    expect(clash.warnings).toHaveLength(1)
    expect(clash.warnings[0]).toContain('only one of them stays')
    expect(buildDropPlan([file('[a, b]/gallery/1_x.png')]).warnings).toEqual([])
  })

  it('does not depend on the order the files are listed in', () => {
    const paths = ['product/a/gallery/z.png', 'product/a/gallery/a.png', 'product/a/gallery/3_c.png']
    const summary = (list: File[]) => buildDropPlan(list).places[0]?.images.map((i) => `${i.file.fileName}#${i.order}`)
    expect(summary(paths.map((p) => file(p)))).toEqual(summary([...paths].reverse().map((p) => file(p))))
  })
})
