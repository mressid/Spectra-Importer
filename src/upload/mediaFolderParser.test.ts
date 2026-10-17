import { describe, expect, it } from 'vitest'
import {
  calculateAspectRatio,
  detectRole,
  extractAltText,
  extractOrder,
  parseAspectRatioFromPath,
  parseMediaFolder,
  parseTargetAndNames,
} from './mediaFolderParser'

function createFakeFile(relativePath: string, name?: string): File {
  const parts = relativePath.split('/')
  const fileName = name || parts[parts.length - 1]
  const blob = new Blob(['fake content'], { type: 'image/jpeg' })
  const file = new File([blob], fileName, { type: 'image/jpeg' })
  Object.defineProperty(file, 'webkitRelativePath', {
    value: relativePath,
    writable: false,
  })
  Object.defineProperty(file, 'relativePath', {
    value: relativePath,
    writable: false,
  })
  return file
}

describe('calculateAspectRatio', () => {
  it('correctly detects standard square, portrait, and landscape ratios', () => {
    // 1:1 Square
    const square = calculateAspectRatio(1000, 1000)
    expect(square.formatted).toBe('1:1')
    expect(square.orientation).toBe('SQUARE')
    expect(square.ratio).toBe(1)

    // 4:5 Instagram Portrait
    const p45 = calculateAspectRatio(800, 1000)
    expect(p45.formatted).toBe('4:5')
    expect(p45.orientation).toBe('PORTRAIT')
    expect(p45.ratio).toBe(0.8)

    // 3:4 Standard Portrait
    const p34 = calculateAspectRatio(1200, 1600)
    expect(p34.formatted).toBe('3:4')
    expect(p34.orientation).toBe('PORTRAIT')
    expect(p34.ratio).toBe(0.75)

    // 16:9 Widescreen
    const l169 = calculateAspectRatio(1920, 1080)
    expect(l169.formatted).toBe('16:9')
    expect(l169.orientation).toBe('LANDSCAPE')
    expect(l169.ratio).toBeCloseTo(1.778, 2)

    // 9:16 Vertical Story
    const v916 = calculateAspectRatio(1080, 1920)
    expect(v916.formatted).toBe('9:16')
    expect(v916.orientation).toBe('PORTRAIT')
  })

  it('handles invalid or zero dimensions gracefully', () => {
    const invalid = calculateAspectRatio(0, 0)
    expect(invalid.formatted).toBe('unknown')
    expect(invalid.ratio).toBe(0)

    const negative = calculateAspectRatio(-10, 100)
    expect(negative.formatted).toBe('unknown')
  })
})

describe('parseAspectRatioFromPath', () => {
  it('recognizes various path ratio formats', () => {
    expect(parseAspectRatioFromPath('1:1')).toBe('1:1')
    expect(parseAspectRatioFromPath('4:5')).toBe('4:5')
    expect(parseAspectRatioFromPath('16x9')).toBe('16:9')
    expect(parseAspectRatioFromPath('ratio-1:1')).toBe('1:1')
    expect(parseAspectRatioFromPath('aspect_4x5')).toBe('4:5')
    expect(parseAspectRatioFromPath('gallery')).toBeUndefined()
  })
})

describe('parseTargetAndNames', () => {
  it('parses wildcard with multiple logical names', () => {
    const res = parseTargetAndNames('*:[ring-a, ring-b]')
    expect(res).toEqual([
      { target: 'product', name: 'ring-a' },
      { target: 'product', name: 'ring-b' },
    ])
  })

  it('parses target prefix with multiple names', () => {
    const res = parseTargetAndNames('product:[ring-a, ring-b]')
    expect(res).toEqual([
      { target: 'product', name: 'ring-a' },
      { target: 'product', name: 'ring-b' },
    ])
  })

  it('parses individual order per binding inside bracket', () => {
    const res = parseTargetAndNames('*:[ring-a:1, ring-b:3]')
    expect(res).toEqual([
      { target: 'product', name: 'ring-a', order: 1 },
      { target: 'product', name: 'ring-b', order: 3 },
    ])
  })

  it('parses multi-target entries inside bracket', () => {
    const res = parseTargetAndNames('*:[product:ring-a:1, category:rings:2]')
    expect(res).toEqual([
      { target: 'product', name: 'ring-a', order: 1 },
      { target: 'category', name: 'rings', order: 2 },
    ])
  })

  it('parses plain bracket syntax defaulting to given target', () => {
    const res = parseTargetAndNames('[var-1, var-2]', 'variant')
    expect(res).toEqual([
      { target: 'variant', name: 'var-1' },
      { target: 'variant', name: 'var-2' },
    ])
  })
})

describe('detectRole & extractOrder & extractAltText', () => {
  it('detects role from filename or folder segment', () => {
    expect(detectRole('thumbnail')).toBe('THUMBNAIL')
    expect(detectRole('cover.png')).toBe('THUMBNAIL')
    expect(detectRole('hero_photo.jpg')).toBe('THUMBNAIL')
    expect(detectRole('gallery')).toBe('GALLERY')
    expect(detectRole('images')).toBe('GALLERY')
    expect(detectRole('banner')).toBe('BANNER')
    expect(detectRole('logo.png')).toBe('LOGO')
    expect(detectRole('swatch')).toBe('SWATCH')
  })

  it('extracts order from numeric folders, prefixes and roles', () => {
    // Thumbnail is always order 1
    expect(extractOrder([], 'thumb.jpg', 'THUMBNAIL')).toBe(1)

    // Folder segment
    expect(extractOrder(['gallery', '2'], 'photo.jpg')).toBe(2)
    expect(extractOrder(['gallery', 'order-3'], 'photo.jpg')).toBe(3)
    expect(extractOrder(['gallery', '[order=4]'], 'photo.jpg')).toBe(4)

    // Filename prefix
    expect(extractOrder([], '01_front.jpg')).toBe(1)
    expect(extractOrder([], '02-side.jpg')).toBe(2)
    expect(extractOrder([], '3.back.jpg')).toBe(3)
    expect(extractOrder([], '10.png')).toBe(10)
  })

  it('extracts alt text cleanly from filenames', () => {
    expect(extractAltText('01_front-view_diamond.jpg')).toBe('Front view diamond')
    expect(extractAltText('02_side-angle.png')).toBe('Side angle')
    expect(extractAltText('thumbnail.jpg')).toBeUndefined()
    expect(extractAltText('01.jpg')).toBeUndefined()
  })
})

describe('parseMediaFolder', () => {
  it('parses wildcard multi-name folders into multiple bindings', () => {
    const files = [
      createFakeFile('*:[ring-a, ring-b]/thumbnail.jpg'),
      createFakeFile('*:[ring-a, ring-b]/gallery/01_front.jpg'),
      createFakeFile('*:[ring-a, ring-b]/gallery/02_side.jpg'),
    ]

    const result = parseMediaFolder(files)
    expect(result.assets).toHaveLength(3)
    expect(result.multiBoundAssetsCount).toBe(3)
    expect(result.uniqueLogicalNames).toEqual(['ring-a', 'ring-b'])

    // First asset (thumbnail)
    const thumb = result.assets[0]
    expect(thumb.bindings).toHaveLength(2)
    expect(thumb.bindings[0]).toEqual({
      target: 'product',
      name: 'ring-a',
      role: 'THUMBNAIL',
      order: 1,
      altText: undefined,
    })
    expect(thumb.bindings[1]).toEqual({
      target: 'product',
      name: 'ring-b',
      role: 'THUMBNAIL',
      order: 1,
      altText: undefined,
    })

    // Second asset (front gallery)
    const front = result.assets[1]
    expect(front.bindings[0]).toEqual({
      target: 'product',
      name: 'ring-a',
      role: 'GALLERY',
      order: 1,
      altText: 'Front',
    })
    expect(front.bindings[1]).toEqual({
      target: 'product',
      name: 'ring-b',
      role: 'GALLERY',
      order: 1,
      altText: 'Front',
    })

    // Third asset (side gallery)
    const side = result.assets[2]
    expect(side.bindings[0].order).toBe(2)
    expect(side.bindings[1].order).toBe(2)
    expect(side.bindings[0].altText).toBe('Side')
  })

  it('parses individual path orders and aspect ratio in path', () => {
    const files = [
      createFakeFile('product/[ring-a:1, ring-b:3]/4:5/gallery/macro.jpg'),
    ]

    const result = parseMediaFolder(files)
    expect(result.assets).toHaveLength(1)
    const asset = result.assets[0]
    expect(asset.explicitAspectRatio).toBe('4:5')
    expect(asset.bindings).toEqual([
      {
        target: 'product',
        name: 'ring-a',
        role: 'GALLERY',
        order: 1,
        altText: 'Macro',
      },
      {
        target: 'product',
        name: 'ring-b',
        role: 'GALLERY',
        order: 3,
        altText: 'Macro',
      },
    ])
  })

  it('parses hierarchical targets: category, brand, variant', () => {
    const files = [
      createFakeFile('category/rings/thumbnail.jpg'),
      createFakeFile('category/rings/banner/header.jpg'),
      createFakeFile('brand/pandora/logo.png'),
      createFakeFile('variant/SKU-101/gallery/01_closeup.jpg'),
    ]

    const result = parseMediaFolder(files)
    expect(result.assets).toHaveLength(4)
    expect(result.targetSummary).toEqual({
      category: 2,
      brand: 1,
      variant: 1,
    })

    expect(result.assets[0].bindings[0]).toEqual({
      target: 'category',
      name: 'rings',
      role: 'THUMBNAIL',
      order: 1,
      altText: undefined,
    })

    expect(result.assets[1].bindings[0]).toEqual({
      target: 'category',
      name: 'rings',
      role: 'BANNER',
      order: 1,
      altText: 'Header',
    })

    expect(result.assets[2].bindings[0]).toEqual({
      target: 'brand',
      name: 'pandora',
      role: 'LOGO',
      order: 1,
      altText: undefined,
    })

    expect(result.assets[3].bindings[0]).toEqual({
      target: 'variant',
      name: 'SKU-101',
      role: 'GALLERY',
      order: 1,
      altText: 'Closeup',
    })
  })

  it('handles standard product folder with variants subfolder', () => {
    const files = [
      createFakeFile('solitaire-ring/thumbnail.jpg'),
      createFakeFile('solitaire-ring/images/front.jpg'),
      createFakeFile('solitaire-ring/variants/gold/01_macro.jpg'),
    ]

    const result = parseMediaFolder(files)
    expect(result.assets).toHaveLength(3)

    expect(result.assets[0].bindings[0]).toEqual({
      target: 'product',
      name: 'solitaire-ring',
      role: 'THUMBNAIL',
      order: 1,
      altText: undefined,
    })

    expect(result.assets[1].bindings[0]).toEqual({
      target: 'product',
      name: 'solitaire-ring',
      role: 'GALLERY',
      order: 1,
      altText: 'Front',
    })

    expect(result.assets[2].bindings[0]).toEqual({
      target: 'variant',
      name: 'gold',
      role: 'GALLERY',
      order: 1,
      altText: 'Macro',
    })
  })

  it('assigns sequential order when no explicit order is present', () => {
    const files = [
      createFakeFile('product/ring-x/gallery/photo-a.jpg'),
      createFakeFile('product/ring-x/gallery/photo-b.jpg'),
      createFakeFile('product/ring-x/gallery/photo-c.jpg'),
    ]

    const result = parseMediaFolder(files)
    expect(result.assets[0].bindings[0].order).toBe(1)
    expect(result.assets[1].bindings[0].order).toBe(2)
    expect(result.assets[2].bindings[0].order).toBe(3)
  })
})
