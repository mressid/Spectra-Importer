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

  it('generates synthetic operations for create: references with dependency ordering', () => {
    const prodRow: CleanRow = {
      id: 'gold-ring',
      index: 0,
      values: {
        slug: 'gold-ring',
        name: 'Gold Ring',
        thumbnailUrl: 'https://cdn.example/ring.jpg',
        brand: 'create:acme-jewelry',
        categories: ['create:rings'],
        tags: ['create:sale-tag'],
        collections: ['create:summer-2026'],
        hasVariants: false,
        sku: 'RING-1',
        price: 50,
      },
    }

    const ops = buildPlan([
      { template: 'products', rows: [prodRow], onConflict: 'skip', library: fakeLibrary },
    ])

    // Auto-created tag
    const tagOp = ops.find((op) => op.key === 'tags:sale-tag')
    expect(tagOp).toBeDefined()
    expect(tagOp!.method).toBe('POST')
    expect(tagOp!.path).toBe('/api/v1/tags')
    expect(tagOp!.body).toEqual({ slug: 'sale-tag', name: 'Sale Tag' })

    // Auto-created brand
    const brandOp = ops.find((op) => op.key === 'brands:acme-jewelry')
    expect(brandOp).toBeDefined()
    expect(brandOp!.body).toMatchObject({ slug: 'acme-jewelry', name: 'Acme Jewelry' })

    // Auto-created category
    const catOp = ops.find((op) => op.key === 'categories:rings')
    expect(catOp).toBeDefined()
    expect(catOp!.body).toMatchObject({ slug: 'rings', name: 'Rings', isActive: true })

    // Auto-created collection
    const colOp = ops.find((op) => op.key === 'collections:summer-2026')
    expect(colOp).toBeDefined()
    expect(colOp!.body).toMatchObject({ slug: 'summer-2026', name: 'Summer 2026', isActive: true })

    // Product operation links to brand and waits for it
    const prodOp = ops.find((op) => op.key === 'products:gold-ring')
    expect(prodOp).toBeDefined()
    expect((prodOp!.body as { brandId: string }).brandId).toBe('{brands:acme-jewelry}')
    expect(prodOp!.after).toContain('brands:acme-jewelry')

    // Linking operations
    const catLink = ops.find((op) => op.key === 'products:gold-ring:category:rings')
    expect(catLink).toBeDefined()
    expect(catLink!.path).toBe('/api/v1/products/{products:gold-ring}/categories/{categories:rings}')
    expect(catLink!.after).toEqual(['products:gold-ring', 'categories:rings'])

    const tagLink = ops.find((op) => op.key === 'products:gold-ring:tag:sale-tag')
    expect(tagLink).toBeDefined()
    expect(tagLink!.path).toBe('/api/v1/products/{products:gold-ring}/tags/{tags:sale-tag}')
    expect(tagLink!.after).toEqual(['products:gold-ring', 'tags:sale-tag'])

    const colLink = ops.find((op) => op.key === 'products:gold-ring:collection:summer-2026')
    expect(colLink).toBeDefined()
    expect(colLink!.path).toBe('/api/v1/products/{products:gold-ring}/collections/{collections:summer-2026}')
    expect(colLink!.after).toEqual(['products:gold-ring', 'collections:summer-2026'])
  })

  it('deduplicates create: references across multiple products and does not duplicate if explicitly provided', () => {
    const prod1: CleanRow = {
      id: 'p1',
      index: 0,
      values: {
        slug: 'p1',
        name: 'Product 1',
        thumbnailUrl: 'https://cdn.example/1.jpg',
        brand: 'create:acme',
        categories: ['create:rings'],
        hasVariants: false,
        sku: 'P1',
        price: 10,
      },
    }
    const prod2: CleanRow = {
      id: 'p2',
      index: 1,
      values: {
        slug: 'p2',
        name: 'Product 2',
        thumbnailUrl: 'https://cdn.example/2.jpg',
        brand: 'create:acme',
        categories: ['create:rings'],
        hasVariants: false,
        sku: 'P2',
        price: 20,
      },
    }
    const explicitBrand: CleanRow = {
      id: 'acme',
      index: 0,
      values: {
        slug: 'acme',
        name: 'Acme Official Brand',
        website: 'https://acme.example',
      },
    }

    const ops = buildPlan([
      { template: 'brands', rows: [explicitBrand], onConflict: 'skip', library: fakeLibrary },
      { template: 'products', rows: [prod1, prod2], onConflict: 'skip', library: fakeLibrary },
    ])

    // Should only have 1 brand op for acme, and it should use the explicit definition!
    const brandOps = ops.filter((op) => op.key === 'brands:acme')
    expect(brandOps).toHaveLength(1)
    expect((brandOps[0].body as { name: string }).name).toBe('Acme Official Brand')

    // Should only have 1 category op for rings (auto-created)
    const catOps = ops.filter((op) => op.key === 'categories:rings')
    expect(catOps).toHaveLength(1)
    expect((catOps[0].body as { name: string }).name).toBe('Rings')
  })

  it('auto-creates parent category when referenced via create: in category parent', () => {
    const childCat: CleanRow = {
      id: 'engagement-rings',
      index: 0,
      values: {
        slug: 'engagement-rings',
        name: 'Engagement Rings',
        parent: 'create:rings',
      },
    }

    const ops = buildPlan([
      { template: 'categories', rows: [childCat], onConflict: 'skip', library: fakeLibrary },
    ])

    const parentOp = ops.find((op) => op.key === 'categories:rings')
    expect(parentOp).toBeDefined()
    expect(parentOp!.body).toMatchObject({ slug: 'rings', name: 'Rings' })

    const childOp = ops.find((op) => op.key === 'categories:engagement-rings')
    expect(childOp).toBeDefined()
    expect((childOp!.body as { parentId: string }).parentId).toBe('{categories:rings}')
    expect(childOp!.after).toEqual(['categories:rings'])
  })
})
