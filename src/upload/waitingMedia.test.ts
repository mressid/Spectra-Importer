import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { readImportFile } from '../adapters'
import { validateDocument } from '../validate/validate'
import type { WaitingMedia } from './api'
import { groupWaiting, knownNames, reservedThumbnailSlugs, waitingDataCsv, withoutRow } from './waitingMedia'

function media(target: string, name: string, role: 'THUMBNAIL' | 'GALLERY', order: number): WaitingMedia {
  return { target, name, role, order, altText: null, uploadedFileId: `f-${target}-${name}-${order}`, url: `http://x/${name}-${order}.png`, mediaType: 'IMAGE', reservedAt: '2026-10-18T10:00:00' }
}

const items = [
  media('variant', 'SKU-2', 'GALLERY', 1),
  media('product', 'ring-b', 'GALLERY', 3),
  media('product', 'ring-a', 'GALLERY', 2),
  media('product', 'ring-a', 'THUMBNAIL', 1),
  media('product', 'ring-b', 'GALLERY', 2),
  media('category', 'rings', 'THUMBNAIL', 1),
  media('mystery', 'x', 'GALLERY', 1), // a kind this tool does not know is left out
]

describe('groupWaiting', () => {
  it('groups by place, orders the gallery and splits off the thumbnail', () => {
    const places = groupWaiting(items)
    expect(places.map((p) => `${p.target}/${p.name}`)).toEqual(['product/ring-a', 'product/ring-b', 'variant/SKU-2', 'category/rings'])
    const ringA = places[0]
    expect(ringA.thumbnail?.order).toBe(1)
    expect(ringA.gallery.map((g) => g.order)).toEqual([2])
    expect(places[1].gallery.map((g) => g.order)).toEqual([2, 3])
    expect(places[1].thumbnail).toBeNull()
  })

  it('marks the places that have a row in the loaded data files', () => {
    const doc = readImportFile('products.csv', 'slug,name\nring-a,Ring A\nother,Other\n', 'products')
    const places = groupWaiting(items, knownNames({ products: doc }))
    expect(places.filter((p) => p.inFiles).map((p) => p.name)).toEqual(['ring-a'])
    expect(withoutRow(places, 'product').map((p) => p.name)).toEqual(['ring-b'])
  })
})

describe('reservedThumbnailSlugs', () => {
  it('lists the products that have a thumbnail waiting', () => {
    expect([...reservedThumbnailSlugs(items)]).toEqual(['ring-a'])
  })
})

describe('waitingDataCsv', () => {
  it('has the template columns and the waiting names in the identifier column', () => {
    const { data } = Papa.parse<Record<string, string>>(waitingDataCsv('variant', ['SKU-2', 'SKU-9']), { header: true, skipEmptyLines: true })
    expect(data.map((r) => r.sku)).toEqual(['SKU-2', 'SKU-9'])
    expect(Object.keys(data[0])).toContain('price')
    expect(waitingDataCsv('product', ['ring-b']).split('\n')[0]).toContain('thumbnailUrl')
  })

  it('with no names it is a blank template: just the columns of the data file', () => {
    for (const target of ['product', 'variant', 'category', 'brand'] as const) {
      const lines = waitingDataCsv(target, []).trim().split(/\r?\n/)
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(target === 'variant' ? 'sku' : 'slug')
    }
  })

  it('a product row with only its name needs no thumbnailUrl when one is waiting', () => {
    const doc = readImportFile('products.json', '[{"slug":"ring-a","name":"Ring A","hasVariants":true}]', 'products')
    const base = { pending: {}, existing: {}, images: new Set<string>() }
    const without = validateDocument(doc, base).issues.filter((i) => i.field === 'thumbnailUrl')
    expect(without.length).toBeGreaterThan(0)
    const withReservation = validateDocument(doc, { ...base, reservedThumbnails: new Set(['ring-a']) }).issues.filter((i) => i.field === 'thumbnailUrl')
    expect(withReservation).toEqual([])
  })
})
