import { describe, expect, it } from 'vitest'
import { detectProductFolders, isStructureFolder } from './detectProductFolders'
import { normalizeDropRoot } from './dropFiles'

function file(path: string): File {
  const f = new File(['x'], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'relativePath', { value: path })
  return f
}

const files = (...paths: string[]) => paths.map(file)

describe('detectProductFolders', () => {
  it('reads the folder layout: thumbnail, images and variants', () => {
    // the photos come before the thumbnail on purpose: finding the thumbnail must not depend on the order of the files
    const [ring] = detectProductFolders(
      files('gold-ring/images/a.png', 'gold-ring/images/b.png', 'gold-ring/variants/size-52/images/x.png', 'gold-ring/thumbnail.png'),
    )
    expect(ring).toMatchObject({ slug: 'gold-ring', name: 'Gold Ring' })
    expect(ring?.thumbnailFile?.name).toBe('thumbnail.png')
    expect(ring?.galleryFiles.map((f) => f.name).sort()).toEqual(['a.png', 'b.png'])
    expect(ring?.variants.map((v) => v.slug)).toEqual(['size-52'])
    expect(ring?.variants[0]?.images.map((f) => f.name)).toEqual(['x.png'])
  })

  it('keeps the real files, whose library key is the full path (not the path inside the product)', () => {
    const [ring] = detectProductFolders(files('gold-ring/images/a.png', 'gold-ring/thumbnail.png'))
    const key = (f: File | undefined) => (f as File & { relativePath: string } | undefined)?.relativePath
    expect(key(ring?.thumbnailFile)).toBe('gold-ring/thumbnail.png')
    expect(ring?.galleryFiles.map(key)).toEqual(['gold-ring/images/a.png'])
  })

  it('finds each product of a folder that holds several, with its own thumbnail and variants', () => {
    const found = detectProductFolders(
      normalizeDropRoot([
        ...['legacy/gold-ring/images/a.png', 'legacy/gold-ring/thumbnail.png', 'legacy/gold-ring/variants/size-52/images/x.png'].map((p) => file(p)),
        ...['legacy/silver-chain/images/c.png', 'legacy/silver-chain/cover.png'].map((p) => file(p)),
      ]),
    )
    expect(found.map((p) => p.slug)).toEqual(['gold-ring', 'silver-chain'])
    expect(found.map((p) => p.thumbnailFile?.name)).toEqual(['thumbnail.png', 'cover.png'])
    expect(found.map((p) => p.variants.length)).toEqual([1, 0])
  })

  it('reads the media library layout: product/<slug>/thumbnail and gallery in position order', () => {
    const found = detectProductFolders(
      files('product/ring-a/gallery/02_b.png', 'product/ring-a/thumbnail/cover.png', 'product/ring-a/gallery/01_a.png', 'product/ring-b/thumbnail/c.png'),
    )
    expect(found.map((p) => p.slug)).toEqual(['ring-a', 'ring-b'])
    const ringA = found[0]
    expect(ringA?.thumbnailFile?.name).toBe('cover.png')
    expect(ringA?.galleryFiles.map((f) => f.name)).toEqual(['01_a.png', '02_b.png'])
  })

  it('never offers the library structure itself (product/, brand/, [a, b]/…) as a product', () => {
    const found = detectProductFolders(
      files(
        'product/ring-a/thumbnail/a.png',
        'brand/aurum/thumbnail/b.png',
        'category/rings/thumbnail/c.png',
        'variant/SKU-1/gallery/d.png',
        '[ring-a, ring-b]/gallery/e.png',
        'variant[SKU-1, SKU-2]/gallery/f.png',
      ),
    )
    expect(found.map((p) => p.slug)).toEqual(['ring-a', 'ring-b'])
  })

  it('does not list a product twice when both layouts describe it', () => {
    expect(detectProductFolders(files('ring-a/thumbnail.png', 'product/ring-a/gallery/01.png')).map((p) => p.slug)).toEqual(['ring-a'])
  })

  it('finds nothing in a drop without product folders', () => {
    expect(detectProductFolders(files('brand/aurum/thumbnail/a.png', 'category/rings/thumbnail/b.png'))).toEqual([])
    expect(detectProductFolders([])).toEqual([])
  })
})

describe('isStructureFolder', () => {
  it('knows the kinds and the multi-name syntax', () => {
    for (const name of ['product', 'Brand', 'categories', '[a, b]', 'variant[x]', '*:[a]', '[product=a@1]']) expect(isStructureFolder(name), name).toBe(true)
    for (const name of ['gold-ring', 'ring_01', 'My Product']) expect(isStructureFolder(name), name).toBe(false)
  })
})
