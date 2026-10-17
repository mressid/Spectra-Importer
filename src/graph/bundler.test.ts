import { describe, expect, it } from 'vitest'
import { autoLayoutGraph, bundleGraph, createPresetGraph } from './bundler'
import type { ProductGraph } from './types'

describe('bundleGraph', () => {
  it('bundles simple product preset into valid ImportDocuments and Manifest', () => {
    const graph = createPresetGraph('simple')
    const result = bundleGraph(graph)

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.documents.products).toBeDefined()
    expect(result.documents.brands).toBeDefined()
    expect(result.documents.categories).toBeDefined()
    expect(result.documents.tags).toBeDefined()
    expect(result.documents.collections).toBeDefined()

    const prodRow = result.documents.products!.rows[0]
    expect(prodRow.slug).toBe('solitaire-gold-ring')
    expect(prodRow.brand).toBe('create:aurum-lux')
    expect(prodRow.categories).toEqual(['create:fine-rings'])
    expect(prodRow.tags).toEqual(['create:bestseller', 'create:handcrafted'])
    expect(prodRow.collections).toEqual(['create:bridal-2026'])
    expect(prodRow.thumbnailUrl).toBe('media:solitaire-main.jpg')
    expect(prodRow.images).toEqual(['media:solitaire-detail.jpg'])
    expect(prodRow.price).toBe(450)

    // Manifest stats
    expect(result.manifest.stats.products).toBe(1)
    expect(result.manifest.stats.brands).toBe(1)
    expect(result.manifest.stats.categories).toBe(1)
    expect(result.manifest.stats.tags).toBe(2)
    expect(result.manifest.stats.collections).toBe(1)
    expect(result.manifest.stats.media).toBe(2)
  })

  it('bundles product with variants preset correctly', () => {
    const graph = createPresetGraph('variants')
    const result = bundleGraph(graph)

    expect(result.ok).toBe(true)
    expect(result.documents.products).toBeDefined()
    expect(result.documents.variants).toBeDefined()

    const prod = result.documents.products!.rows[0]
    expect(prod.hasVariants).toBe(true)
    expect(prod.sku).toBeUndefined()
    expect(prod.price).toBeUndefined()

    const variants = result.documents.variants!.rows
    expect(variants).toHaveLength(2)
    expect(variants[0].product).toBe('classic-chain-bracelet')
    expect(variants[0].sku).toBe('CHAIN-16CM')
    expect(variants[1].sku).toBe('CHAIN-18CM')
  })

  it('bundles category hierarchy preset linking parent to subcategory', () => {
    const graph = createPresetGraph('hierarchy')
    const result = bundleGraph(graph)

    expect(result.ok).toBe(true)
    const catRows = result.documents.categories!.rows
    expect(catRows).toHaveLength(2)

    const child = catRows.find((c) => c.slug === 'necklaces')
    expect(child).toBeDefined()
    expect(child!.parent).toBe('create:jewelry')
  })

  it('detects missing products and duplicate identifiers', () => {
    const emptyGraph: ProductGraph = {
      id: 'g-empty',
      name: 'Empty Graph',
      nodes: [
        { id: 'b1', type: 'brand', x: 0, y: 0, data: { slug: 'acme', name: 'Acme' } },
        { id: 'b2', type: 'brand', x: 10, y: 10, data: { slug: 'acme', name: 'Acme Duplicate' } },
      ],
      edges: [],
      updatedAt: '2026-01-01',
    }

    const result = bundleGraph(emptyGraph)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('contains no product nodes'),
        expect.stringContaining('Duplicate identifier "acme"'),
      ]),
    )
  })

  it('auto-layouts nodes without crashing', () => {
    const graph = createPresetGraph('simple')
    const laidOut = autoLayoutGraph(graph)
    expect(laidOut.nodes).toHaveLength(graph.nodes.length)
    expect(laidOut.nodes.some((n) => n.x === 600)).toBe(true) // Product column
  })
})
