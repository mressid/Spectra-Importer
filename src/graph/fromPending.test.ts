import { describe, expect, it } from 'vitest'
import type { WaitingMedia } from '../upload/api'
import { groupWaiting } from '../upload/waitingMedia'
import { bundleGraph } from './bundler'
import { graphFromPending } from './fromPending'
import { mergeGraphs } from './mergeGraph'

const media = (target: string, name: string, role: 'THUMBNAIL' | 'GALLERY', order: number): WaitingMedia => ({
  target, name, role, order, altText: null, uploadedFileId: `f-${name}-${role}${order}`, url: `http://store/${name}-${order}.png`, mediaType: 'IMAGE', reservedAt: '2026-10-18T10:00:00',
})

const places = groupWaiting([
  media('product', 'gold-ring', 'THUMBNAIL', 1),
  media('product', 'gold-ring', 'GALLERY', 2),
  media('product', 'gold-ring', 'GALLERY', 1),
  media('variant', 'RING-52', 'GALLERY', 1),
  media('category', 'rings', 'THUMBNAIL', 1),
  media('brand', 'aurum', 'THUMBNAIL', 1),
])

describe('graphFromPending', () => {
  it('makes a product node named by the slug the images wait for, with its images as reserved media nodes in order', () => {
    const { graph, products, photos } = graphFromPending(places.filter((p) => p.target === 'product'))
    expect({ products, photos }).toEqual({ products: 1, photos: 3 })
    expect(graph.nodes.find((n) => n.type === 'product')?.data).toMatchObject({ slug: 'gold-ring', name: 'Gold Ring', sku: 'GOLD-RING-01' })
    const mediaNodes = graph.nodes.filter((n) => n.type === 'media').map((n) => n.data as { role: string; sortOrder?: number; url: string; reserved: boolean })
    expect(mediaNodes.map((m) => `${m.role}${m.sortOrder ?? ''}`)).toEqual(['thumbnail', 'gallery1', 'gallery2'])
    expect(mediaNodes.every((m) => m.reserved && m.url.startsWith('http://store/'))).toBe(true)
    expect(graph.edges.filter((e) => e.type === 'product-media')).toHaveLength(3)
  })

  it('makes nodes for variants, categories and brands, whose images the store attaches itself', () => {
    const { graph, variants, categories, brands, otherPhotos } = graphFromPending(places.filter((p) => p.target !== 'product'))
    expect({ variants, categories, brands, otherPhotos }).toEqual({ variants: 1, categories: 1, brands: 1, otherPhotos: 3 })
    expect(graph.nodes.map((n) => n.type).sort()).toEqual(['brand', 'category', 'variant'])
    expect(graph.nodes.find((n) => n.type === 'variant')?.data).toMatchObject({ sku: 'RING-52' })
  })

  it('does not write the reserved images into the product row, and does not ask for a thumbnail the store already holds', () => {
    const { graph } = graphFromPending(places.filter((p) => p.target === 'product'))
    const bundled = bundleGraph(graph)
    // only the price is missing: the images are not repeated and the thumbnail is not demanded
    expect(bundled.issues).toEqual(['Simple product "gold-ring" requires a price.'])
    const row = bundled.documents.products?.rows[0]
    expect(row?.thumbnailUrl).toBeUndefined()
    expect(row?.images).toBeUndefined()
    expect(row).toMatchObject({ slug: 'gold-ring', sku: 'GOLD-RING-01' })
  })

  it('a product without a reserved thumbnail still needs one', () => {
    const noThumb = groupWaiting([media('product', 'chain', 'GALLERY', 1)])
    expect(bundleGraph(graphFromPending(noThumb).graph).issues).toContain('Product "chain" has no thumbnail image (connect a thumbnail media node or provide thumbnailUrl).')
  })

  it('merges into a graph that already has the product without duplicating it', () => {
    const first = graphFromPending(places.filter((p) => p.target === 'product')).graph
    const again = mergeGraphs(first, graphFromPending(places.filter((p) => p.target === 'product')).graph)
    expect(again.added).toBe(0)
    expect(again.graph.nodes).toHaveLength(first.nodes.length)
  })
})
