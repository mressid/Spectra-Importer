import { describe, expect, it } from 'vitest'
import type { ImportDocument, RawRow, ResourceKind } from '../core/types'
import type { LibraryImage } from '../core/types'
import { bundleGraph } from './bundler'
import { graphFromDocuments } from './fromDocuments'

const doc = (template: ResourceKind, rows: RawRow[]): ImportDocument => ({ template, version: 1, rows })
const library = (entries: Record<string, string> = {}) => new Map(Object.entries(entries).map(([key, url]) => [key, { url } as unknown as LibraryImage]))

const product: RawRow = {
  slug: 'gold-ring',
  name: 'Gold Ring',
  thumbnailUrl: 'media:gold-ring/thumbnail.png',
  images: ['media:gold-ring/images/a.png', 'media:gold-ring/images/b.png'],
  hasVariants: false,
  sku: 'GOLD-RING-01',
  price: 10,
  brand: 'create:aurum',
  categories: ['rings'],
  tags: ['create:new'],
  isActive: true,
}

describe('graphFromDocuments', () => {
  it('turns a product row into a product node with the same SKU, its photos as media nodes and its references as edges', () => {
    const { graph, counts } = graphFromDocuments({ products: doc('products', [product]) }, library())
    expect(counts).toMatchObject({ products: 1, media: 3 })
    const productNode = graph.nodes.find((n) => n.type === 'product')
    expect(productNode?.data).toMatchObject({ slug: 'gold-ring', name: 'Gold Ring', sku: 'GOLD-RING-01', price: 10 })
    const media = graph.nodes.filter((n) => n.type === 'media').map((n) => n.data as { fileName: string; role: string; sortOrder?: number })
    expect(media).toEqual([
      expect.objectContaining({ fileName: 'gold-ring/thumbnail.png', role: 'thumbnail' }),
      expect.objectContaining({ fileName: 'gold-ring/images/a.png', role: 'gallery', sortOrder: 1 }),
      expect.objectContaining({ fileName: 'gold-ring/images/b.png', role: 'gallery', sortOrder: 2 }),
    ])
    expect(graph.nodes.find((n) => n.type === 'brand')?.data).toMatchObject({ slug: 'aurum', isAutoCreate: true })
    expect(graph.nodes.find((n) => n.type === 'category')?.data).toMatchObject({ slug: 'rings', isAutoCreate: false })
    expect(graph.edges.map((e) => e.type).sort()).toEqual(['product-brand', 'product-category', 'product-media', 'product-media', 'product-media', 'product-tag'])
  })

  it('uses the store address of a photo that is already uploaded', () => {
    const { graph } = graphFromDocuments({ products: doc('products', [product]) }, library({ 'gold-ring/thumbnail.png': 'http://store/t.png' }))
    const thumb = graph.nodes.find((n) => n.type === 'media' && (n.data as { role: string }).role === 'thumbnail')
    if (!thumb) throw new Error('a thumbnail node is expected')
    expect((thumb.data as { url?: string }).url).toBe('http://store/t.png')
  })

  it('keeps a web address as the image, without a library name', () => {
    const { graph } = graphFromDocuments({ products: doc('products', [{ ...product, thumbnailUrl: 'https://cdn.example/t.jpg', images: [] }]) }, library())
    const media = graph.nodes.find((n) => n.type === 'media')
    expect(media?.data).toMatchObject({ fileName: 'https://cdn.example/t.jpg', url: 'https://cdn.example/t.jpg', role: 'thumbnail' })
  })

  it('reads the typed values of a CSV row (a price written "12,5" is the number 12.5)', () => {
    const csv: RawRow = { slug: 'ring', name: 'Ring', thumbnailUrl: 'https://cdn.example/r.jpg', sku: 'R-1', price: '12,5', isActive: 'yes' }
    const { graph } = graphFromDocuments({ products: doc('products', [csv]) }, library())
    expect(graph.nodes.find((n) => n.type === 'product')?.data).toMatchObject({ price: 12.5, isActive: true })
  })

  it('links variants to their product and moves brands, categories, tags and collections that are rows', () => {
    const { graph, counts } = graphFromDocuments(
      {
        products: doc('products', [{ ...product, hasVariants: true, sku: undefined, price: undefined }]),
        variants: doc('variants', [{ sku: 'GR-52', product: 'gold-ring', name: 'Size 52', price: 120 }]),
        brands: doc('brands', [{ slug: 'aurum', name: 'Aurum Lux', country: 'TN' }]),
        categories: doc('categories', [{ slug: 'rings', name: 'Rings' }, { slug: 'engagement', name: 'Engagement', parent: 'rings' }]),
      },
      library(),
    )
    expect(counts).toMatchObject({ variants: 1, brands: 1, categories: 2 })
    expect(graph.nodes.find((n) => n.type === 'brand')?.data).toMatchObject({ slug: 'aurum', name: 'Aurum Lux', country: 'TN', isAutoCreate: false })
    expect(graph.edges.some((e) => e.type === 'product-variant')).toBe(true)
    expect(graph.edges.some((e) => e.type === 'category-parent')).toBe(true)
    // one brand node, not two: the row and the reference are the same brand
    expect(graph.nodes.filter((n) => n.type === 'brand')).toHaveLength(1)
  })

  it('says which row fields the graph has no place for', () => {
    const { unsupported } = graphFromDocuments({ products: doc('products', [{ ...product, specifications: 'Material: gold', contentBlocks: [{ type: 'text' }] }]) }, library())
    expect(unsupported).toEqual(['contentBlocks', 'specifications'])
  })

  it('round trip: rows -> graph -> bundle gives the same SKU, price, images and references back', () => {
    const { graph } = graphFromDocuments({ products: doc('products', [product]) }, library())
    const bundled = bundleGraph(graph)
    expect(bundled.issues).toEqual([])
    expect(bundled.documents.products?.rows[0]).toMatchObject({
      slug: 'gold-ring',
      name: 'Gold Ring',
      sku: 'GOLD-RING-01',
      price: 10,
      thumbnailUrl: 'media:gold-ring/thumbnail.png',
      images: ['media:gold-ring/images/a.png', 'media:gold-ring/images/b.png'],
      brand: 'create:aurum',
      categories: ['rings'],
      tags: ['create:new'],
    })
  })
})
