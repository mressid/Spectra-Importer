import { describe, expect, it } from 'vitest'
import { applySnapshot, lookupProduct, type StoreSnapshot } from './fromStore'
import type { ProductGraph } from './types'

const product = { id: 'p1', slug: 'ring-gold', name: 'Gold ring', description: 'Hand made', shortDescription: 'A ring', descriptionFormat: 'MARKDOWN', thumbnailUrl: 'http://x/thumb.png', isActive: true, hasVariants: false, defaultVariantId: 'v1', brandId: 'b1', seoTitle: 'Gold ring | shop' }
const variant = { id: 'v1', productId: 'p1', sku: 'RING-GOLD', name: 'RING-GOLD', price: 320.5, compareAtPrice: 380, stockQuantity: 12, weightGrams: 4, barcode: null }

const graphWithProduct = (): ProductGraph => ({
  id: 'g', name: 'g', description: '', updatedAt: 't', edges: [],
  nodes: [{ id: 'node-product-1', type: 'product', x: 600, y: 100, data: { slug: 'ring-gold', name: 'New Product', price: 100, hasVariants: false } }],
})

const snapshot = (overrides: Partial<StoreSnapshot> = {}): StoreSnapshot => ({
  product, variants: [variant], media: [], categories: [], tags: [], collections: [], ...overrides,
})

describe('applySnapshot', () => {
  it("fills the product with the store's data, and takes the SKU and price from the variant of a simple product", () => {
    const { graph } = applySnapshot(graphWithProduct(), 'node-product-1', snapshot())
    expect(graph.nodes[0].data).toMatchObject({ slug: 'ring-gold', name: 'Gold ring', description: 'Hand made', thumbnailUrl: 'http://x/thumb.png', seoTitle: 'Gold ring | shop', sku: 'RING-GOLD', price: 320.5, compareAtPrice: 380, stockQuantity: 12, weightGrams: 4, hasVariants: false })
    // what the store does not say (a null barcode) leaves the node alone
    expect(graph.nodes[0].data).not.toHaveProperty('barcode')
  })

  it('connects the brand, categories, tags and collections as records that already exist', () => {
    const { graph, applied } = applySnapshot(graphWithProduct(), 'node-product-1', snapshot({
      brand: { slug: 'aurum', name: 'Aurum', country: 'TN' },
      categories: [{ slug: 'rings', name: 'Rings', sortOrder: 1 }],
      tags: [{ slug: 'new', name: 'New' }],
      collections: [{ slug: 'winter', name: 'Winter' }],
    }))
    expect(applied).toMatchObject({ brands: 1, categories: 1, tags: 1, collections: 1 })
    const byType = (type: string) => graph.nodes.filter((n) => n.type === type)
    expect(byType('brand')[0].data).toMatchObject({ slug: 'aurum', name: 'Aurum', country: 'TN', isAutoCreate: false })
    expect(graph.edges.map((e) => [e.type, e.target])).toEqual([
      ['product-brand', 'node-product-1'], ['product-category', 'node-product-1'], ['product-tag', 'node-product-1'], ['product-collection', 'node-product-1'],
    ])
  })

  it('adds the gallery in order, without the thumbnail, as images that already have an address', () => {
    const { graph, applied } = applySnapshot(graphWithProduct(), 'node-product-1', snapshot({
      media: [
        { url: 'http://x/b.png', sortOrder: 2, mediaType: 'IMAGE', variantId: null },
        { url: 'http://x/a.png', sortOrder: 1, mediaType: 'IMAGE', variantId: null },
        { url: 'http://x/thumb.png', sortOrder: 1, mediaType: 'IMAGE', variantId: null },
        { url: 'http://x/v.png', sortOrder: 1, mediaType: 'IMAGE', variantId: 'v9' },
      ],
    }))
    expect(applied.images).toBe(2)
    expect(graph.nodes.filter((n) => n.type === 'media').map((n) => [(n.data as { fileName: string }).fileName, (n.data as { sortOrder: number }).sortOrder])).toEqual([['a.png', 1], ['b.png', 2]])
  })

  it('adds the variants of a product with options, and none for a simple one', () => {
    const withOptions = snapshot({ product: { ...product, hasVariants: true }, variants: [{ ...variant, id: 'v1' }, { ...variant, id: 'v2', sku: 'RING-GOLD-54', name: 'Size 54', price: 330 }] })
    const { graph, applied } = applySnapshot(graphWithProduct(), 'node-product-1', withOptions)
    expect(applied.variants).toBe(2)
    expect(graph.nodes.find((n) => n.type === 'product')?.data).not.toHaveProperty('sku')
    expect(graph.edges.filter((e) => e.type === 'product-variant').every((e) => e.source === 'node-product-1')).toBe(true)
    expect(applySnapshot(graphWithProduct(), 'node-product-1', snapshot()).applied.variants).toBe(0)
  })

  it('reuses what is already on the canvas, so applying twice does not double anything', () => {
    const snap = snapshot({ brand: { slug: 'aurum', name: 'Aurum' }, categories: [{ slug: 'rings', name: 'Rings' }], media: [{ url: 'http://x/a.png', sortOrder: 1, variantId: null }] })
    const once = applySnapshot(graphWithProduct(), 'node-product-1', snap)
    const twice = applySnapshot(once.graph, 'node-product-1', snap)
    expect(twice.graph.nodes).toHaveLength(once.graph.nodes.length)
    expect(twice.graph.edges).toHaveLength(once.graph.edges.length)
    expect(twice.applied).toEqual({ brands: 0, categories: 0, tags: 0, collections: 0, images: 0, variants: 0 })
  })

  it("replaces the brand on the canvas with the store's, since a product has one", () => {
    const start = applySnapshot(graphWithProduct(), 'node-product-1', snapshot({ brand: { slug: 'old', name: 'Old' } }))
    const { graph } = applySnapshot(start.graph, 'node-product-1', snapshot({ brand: { slug: 'aurum', name: 'Aurum' } }))
    const brandEdges = graph.edges.filter((e) => e.type === 'product-brand')
    expect(brandEdges).toHaveLength(1)
    expect(graph.nodes.find((n) => n.id === brandEdges[0].source)?.data).toMatchObject({ slug: 'aurum' })
  })

  it('leaves the graph alone when the node is not a product', () => {
    const graph = graphWithProduct()
    expect(applySnapshot(graph, 'missing', snapshot()).graph).toBe(graph)
  })
})

describe('lookupProduct', () => {
  const store = (calls: string[] = []) => async (_method: string, path: string): Promise<never> => {
    calls.push(path)
    const answer = (data: unknown) => data as never
    if (path.startsWith('/api/v1/products?slug=ring-gold')) return answer({ content: [product] })
    if (path.startsWith('/api/v1/products?slug=')) return answer({ content: [] })
    if (path.startsWith('/api/v1/variants?skuContains=')) return answer({ content: [variant, { ...variant, sku: 'RING-GOLD-2' }] })
    if (path === '/api/v1/products/p1') return answer(product)
    if (path.startsWith('/api/v1/variants?productId=p1')) return answer({ content: [variant] })
    if (path.startsWith('/api/v1/media')) return answer({ content: [{ url: 'http://x/a.png' }] })
    if (path === '/api/v1/products/p1/categories') return answer([{ slug: 'rings', name: 'Rings' }])
    if (path === '/api/v1/brands/b1') return answer({ slug: 'aurum', name: 'Aurum' })
    throw new Error('Not found: ' + path)
  }

  it('reads the product by slug with its variants, images, brand and categories; a missing piece is just empty', async () => {
    const found = await lookupProduct({ slug: 'ring-gold' }, store())
    expect(found?.product.slug).toBe('ring-gold')
    expect(found?.variants).toHaveLength(1)
    expect(found?.media).toHaveLength(1)
    expect(found?.brand?.slug).toBe('aurum')
    expect(found?.categories).toHaveLength(1)
    expect(found?.tags).toEqual([])
    expect(found?.collections).toEqual([])
  })

  it('finds the product by SKU (exact, any case) when the slug is not in the store, or when SKU is asked first', async () => {
    expect((await lookupProduct({ slug: 'nope', sku: 'ring-gold' }, store()))?.product.id).toBe('p1')
    const calls: string[] = []
    await lookupProduct({ slug: 'ring-gold', sku: 'RING-GOLD', first: 'sku' }, store(calls))
    expect(calls[0]).toContain('/api/v1/variants?skuContains=RING-GOLD')
  })

  it('answers null when the store has neither, and when both are empty', async () => {
    expect(await lookupProduct({ slug: 'nope', sku: 'NOPE' }, store())).toBeNull()
    expect(await lookupProduct({ slug: ' ', sku: '' }, store())).toBeNull()
  })
})
