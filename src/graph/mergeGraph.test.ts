import { describe, expect, it } from 'vitest'
import type { RawRow } from '../core/types'
import { createPresetGraph } from './bundler'
import { graphFromDocuments } from './fromDocuments'
import { isUntouchedPreset, mergeGraphs } from './mergeGraph'
import type { ProductGraph } from './types'

const rows = (...products: RawRow[]) => graphFromDocuments({ products: { template: 'products', version: 1, rows: products } }, new Map()).graph
const ring = (slug: string, extra: RawRow = {}): RawRow => ({ slug, name: slug, thumbnailUrl: `media:${slug}/t.png`, sku: `${slug}-1`, price: 10, ...extra })
const count = (g: ProductGraph, type: string) => g.nodes.filter((n) => n.type === type).length

describe('mergeGraphs', () => {
  it('replaces the sample graph that was never touched, and merges into one that was', () => {
    const sample = createPresetGraph('simple')
    expect(isUntouchedPreset(sample)).toBe(true)
    const replaced = mergeGraphs(sample, rows(ring('a')))
    expect(count(replaced.graph, 'product')).toBe(1)
    expect(replaced.graph.nodes.some((n) => n.id === 'node-prod-1')).toBe(false)

    const edited = { ...sample, nodes: sample.nodes.map((n) => (n.id === 'node-prod-1' ? { ...n, data: { ...n.data, name: 'Mine' } } : n)) } as ProductGraph
    expect(isUntouchedPreset(edited)).toBe(false)
    expect(count(mergeGraphs(edited, rows(ring('a'))).graph, 'product')).toBe(2)
    // moving a node on the canvas is not an edit of the sample
    expect(isUntouchedPreset({ ...sample, nodes: sample.nodes.map((n) => ({ ...n, x: n.x + 50 })) })).toBe(true)
  })

  it('adds a new product below what is there, with its photos and edges', () => {
    const base = rows(ring('a'))
    const { graph, added, updated } = mergeGraphs(base, rows(ring('b')))
    expect(count(graph, 'product')).toBe(2)
    expect({ added, updated }).toEqual({ added: 2, updated: 0 }) // product + its photo
    const [a, b] = ['a', 'b'].map((slug) => graph.nodes.find((n) => n.type === 'product' && (n.data as { slug: string }).slug === slug))
    expect((b?.y ?? 0) > (a?.y ?? 0) + 200).toBe(true)
    expect(graph.edges.filter((e) => e.type === 'product-media')).toHaveLength(2)
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(graph.nodes.length)
  })

  it('merging the same product again updates it instead of duplicating it', () => {
    const base = mergeGraphs(rows(ring('a')), rows(ring('b'))).graph
    const again = mergeGraphs(base, rows(ring('a', { price: 99 })))
    expect(again.added).toBe(0)
    expect(again.updated).toBe(2)
    expect(count(again.graph, 'product')).toBe(2)
    expect(again.graph.nodes.find((n) => n.type === 'product' && (n.data as { slug: string }).slug === 'a')?.data).toMatchObject({ price: 99 })
    expect(again.graph.edges).toHaveLength(base.edges.length)
  })

  it('keeps what the user changed in the graph where the incoming rows say nothing, and keeps the node where it was moved', () => {
    const base = rows(ring('a'))
    const edited: ProductGraph = {
      ...base,
      nodes: base.nodes.map((n) => (n.type === 'product' ? { ...n, x: 777, y: 555, data: { ...n.data, description: 'Written in the graph' } } : n)),
    }
    const { graph } = mergeGraphs(edited, rows(ring('a', { price: 42 })))
    const merged = graph.nodes.find((n) => n.type === 'product')
    expect(merged).toMatchObject({ x: 777, y: 555 })
    expect(merged?.data).toMatchObject({ description: 'Written in the graph', price: 42 })
  })

  it('the merged graph bundles without duplicate identifiers', async () => {
    const { bundleGraph } = await import('./bundler')
    const base = mergeGraphs(rows(ring('a', { brand: 'create:aurum' })), rows(ring('b', { brand: 'create:aurum' }))).graph
    const issues = bundleGraph(mergeGraphs(base, rows(ring('a', { brand: 'create:aurum' }))).graph).issues
    expect(issues).toEqual([])
  })
})
