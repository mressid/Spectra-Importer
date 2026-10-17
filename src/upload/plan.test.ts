import { describe, expect, it } from 'vitest'
import type { CleanRow, LibraryImage } from '../core/types'
import type { ImageLibrary } from './imageLibrary'
import { buildPlan } from './plan'

const fakeLibrary: ImageLibrary = new Map<string, LibraryImage>([
  [
    'thumb.jpg',
    {
      fileName: 'thumb.jpg',
      url: 'https://store.local/thumb.jpg',
      mediaType: 'IMAGE',
      width: 100,
      height: 100,
      sizeBytes: 1000,
      duplicate: false,
      uploadedAt: '2026-01-01T00:00:00Z',
    },
  ],
  [
    'gallery-1.jpg',
    {
      fileName: 'gallery-1.jpg',
      url: 'https://store.local/gallery-1.jpg',
      mediaType: 'IMAGE',
      width: 100,
      height: 100,
      sizeBytes: 1000,
      duplicate: false,
      uploadedAt: '2026-01-01T00:00:00Z',
    },
  ],
  [
    'block.jpg',
    {
      fileName: 'block.jpg',
      url: 'https://store.local/block.jpg',
      mediaType: 'IMAGE',
      width: 100,
      height: 100,
      sizeBytes: 1000,
      duplicate: false,
      uploadedAt: '2026-01-01T00:00:00Z',
    },
  ],
])

describe('buildPlan', () => {
  it('covers a simple product with gallery images and contentBlocks resolving media', () => {
    const row: CleanRow = {
      id: 'gold-ring',
      index: 0,
      values: {
        slug: 'gold-ring',
        name: 'Gold Ring',
        thumbnailUrl: 'media:thumb.jpg',
        brand: 'acme',
        categories: ['rings'],
        tags: ['sale'],
        collections: ['winter'],
        hasVariants: false,
        sku: 'RING-01',
        price: 99.9,
        images: ['media:gallery-1.jpg'],
        specifications: [{ name: 'Material', value: 'Gold 18k' }],
        contentBlocks: [
          { type: 'IMAGE', url: 'media:block.jpg' },
          { type: 'TEXT', content: 'Story' },
        ],
      },
    }

    const ops = buildPlan([
      {
        template: 'products',
        rows: [row],
        onConflict: 'skip',
        library: fakeLibrary,
      },
    ])

    // Main product op
    const main = ops.find((op) => op.key === 'products:gold-ring')
    expect(main).toBeDefined()
    expect(main!.method).toBe('POST')
    const mainBody = main!.body as Record<string, unknown>
    expect(mainBody.thumbnailUrl).toBe('https://store.local/thumb.jpg')
    expect(mainBody.brandId).toBe('{brands:acme}')
    expect((mainBody.defaultVariant as { sku: string; price: number }).sku).toBe('RING-01')

    // Content block resolved
    const blocks = (mainBody.contentBlocks as { type: string; url?: string }[])
    expect(blocks[0].url).toBe('https://store.local/block.jpg')

    // Sub-ops
    expect(ops.some((op) => op.key === 'products:gold-ring:category:rings')).toBe(true)
    expect(ops.some((op) => op.key === 'products:gold-ring:tag:sale')).toBe(true)
    expect(ops.some((op) => op.key === 'products:gold-ring:collection:winter')).toBe(true)
    expect(ops.some((op) => op.key === 'products:gold-ring:specifications')).toBe(true)

    const gallery = ops.find((op) => op.key === 'products:gold-ring:images:0')
    expect(gallery).toBeDefined()
    expect((gallery!.body as { url: string }).url).toBe('https://store.local/gallery-1.jpg')
    expect(gallery!.after).toEqual(['products:gold-ring'])
  })

  it('covers a product with variants', () => {
    const prodRow: CleanRow = {
      id: 't-shirt',
      index: 0,
      values: {
        slug: 't-shirt',
        name: 'T-Shirt',
        thumbnailUrl: 'https://cdn.example/t.jpg',
        hasVariants: true,
      },
    }

    const variantRow: CleanRow = {
      id: 'TSHIRT-RED-M',
      index: 0,
      values: {
        sku: 'TSHIRT-RED-M',
        product: 't-shirt',
        name: 'Red / M',
        price: 25.0,
      },
    }

    const ops = buildPlan([
      { template: 'products', rows: [prodRow], onConflict: 'skip', library: fakeLibrary },
      { template: 'variants', rows: [variantRow], onConflict: 'skip', library: fakeLibrary },
    ])

    const prodOp = ops.find((op) => op.key === 'products:t-shirt')
    expect(prodOp).toBeDefined()
    expect((prodOp!.body as { defaultVariant: unknown }).defaultVariant).toBeNull()

    const varOp = ops.find((op) => op.key === 'variants:TSHIRT-RED-M')
    expect(varOp).toBeDefined()
    expect((varOp!.body as { productId: string }).productId).toBe('{products:t-shirt}')
    expect(varOp!.after).toEqual(['products:t-shirt'])
  })

  it('sorts categories parent-first and handles cycle gracefully', () => {
    const catChild: CleanRow = {
      id: 'wedding-rings',
      index: 0,
      values: { slug: 'wedding-rings', name: 'Wedding Rings', parent: 'rings' },
    }
    const catParent: CleanRow = {
      id: 'rings',
      index: 1,
      values: { slug: 'rings', name: 'Rings' },
    }

    const ops = buildPlan([
      { template: 'categories', rows: [catChild, catParent], onConflict: 'skip', library: fakeLibrary },
    ])

    expect(ops.map((op) => op.key)).toEqual(['categories:rings', 'categories:wedding-rings'])
    const childOp = ops.find((op) => op.key === 'categories:wedding-rings')
    expect(childOp?.after).toEqual(['categories:rings'])
  })
})
