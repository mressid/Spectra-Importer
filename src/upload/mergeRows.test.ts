import { describe, expect, it } from 'vitest'
import type { ImportDocument } from '../core/types'
import { mergeRows } from './mergeRows'

const products = (...slugs: string[]): ImportDocument => ({ template: 'products', version: 1, rows: slugs.map((slug) => ({ slug, name: slug })) })

describe('mergeRows', () => {
  it('starts a document when there is none', () => {
    const { document, added, replaced } = mergeRows(undefined, products('a', 'b'))
    expect(document.rows.map((r) => r.slug)).toEqual(['a', 'b'])
    expect({ added, replaced }).toEqual({ added: 2, replaced: 0 })
  })

  it('replaces a row with the same slug and appends the others, keeping the order', () => {
    const incoming: ImportDocument = { template: 'products', version: 1, rows: [{ slug: 'b', name: 'new' }, { slug: 'c', name: 'c' }] }
    const { document, added, replaced } = mergeRows(products('a', 'b'), incoming)
    expect(document.rows).toEqual([{ slug: 'a', name: 'a' }, { slug: 'b', name: 'new' }, { slug: 'c', name: 'c' }])
    expect({ added, replaced }).toEqual({ added: 1, replaced: 1 })
  })

  it('identifies variants by SKU', () => {
    const variants = (...skus: string[]): ImportDocument => ({ template: 'variants', version: 1, rows: skus.map((sku) => ({ sku, name: sku })) })
    expect(mergeRows(variants('X-1'), variants('X-1', 'X-2')).document.rows).toHaveLength(2)
  })
})
