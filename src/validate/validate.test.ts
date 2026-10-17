import { describe, expect, it } from 'vitest'
import { readImportFile } from '../adapters'
import { validateDocument, type ValidationContext } from './validate'

const empty: ValidationContext = { pending: {}, existing: {}, images: new Set() }

describe('validateDocument', () => {
  it('reads the same tags from json, yaml and csv', () => {
    const json = readImportFile('t.json', '[{"slug":"new","name":"New"}]', 'tags')
    const yaml = readImportFile('t.yml', '- slug: new\n  name: New\n', 'tags')
    const csv = readImportFile('t.csv', 'slug,name\nnew,New\n', 'tags')
    expect(yaml.rows).toEqual(json.rows)
    expect(csv.rows).toEqual(json.rows)
  })

  it('requires an identifier and rejects duplicates', () => {
    const doc = readImportFile('t.json', '[{"name":"A"},{"slug":"a","name":"A"},{"slug":"a","name":"B"}]', 'tags')
    const { issues, clean } = validateDocument(doc, empty)
    expect(issues.map((issue) => [issue.rowIndex, issue.field])).toEqual([[0, 'slug'], [0, 'slug'], [2, 'slug']])
    expect(clean).toHaveLength(1)
  })

  it('checks references and media keys', () => {
    const csv = 'slug,name,thumbnailUrl,brand,sku,price\nring,Ring,media:ring-photo.jpg,acme,R1,12.5\n'
    const doc = readImportFile('p.csv', csv, 'products')
    expect(validateDocument(doc, empty).issues.map((issue) => issue.field).sort()).toEqual(['brand', 'thumbnailUrl'])
    const ok = validateDocument(doc, { ...empty, pending: { brands: new Set(['acme']) }, images: new Set(['ring-photo.jpg']) })
    expect(ok.ok).toBe(true)
    expect(ok.clean[0].values.price).toBe(12.5)
  })

  it('needs sku and price on a product without variants', () => {
    const doc = readImportFile('p.json', '[{"slug":"x","name":"X","thumbnailUrl":"https://e.com/x.jpg"}]', 'products')
    expect(validateDocument(doc, empty).issues.map((issue) => issue.field).sort()).toEqual(['price', 'sku'])
  })

  it('allows create: prefix for brand, categories, tags, and collections without prior existence', () => {
    const csv =
      'slug,name,thumbnailUrl,brand,categories,tags,collections,sku,price\n' +
      'ring,Ring,media:ring-photo.jpg,create:acme,create:rings|create:wedding,create:sale,create:summer-2026,R1,12.5\n'
    const doc = readImportFile('p.csv', csv, 'products')
    const res = validateDocument(doc, { ...empty, images: new Set(['ring-photo.jpg']) })
    expect(res.ok).toBe(true)
    expect(res.issues).toHaveLength(0)
    expect(res.clean).toHaveLength(1)
  })

  it('rejects invalid slug inside create: reference', () => {
    const csv =
      'slug,name,thumbnailUrl,brand,sku,price\n' +
      'ring,Ring,https://cdn.example/r.jpg,create:Acme Brand!,R1,12.5\n'
    const doc = readImportFile('p.csv', csv, 'products')
    const res = validateDocument(doc, empty)
    expect(res.ok).toBe(false)
    expect(res.issues).toEqual([
      expect.objectContaining({
        field: 'brand',
        message: expect.stringContaining('invalid slug "acme brand!"'),
      }),
    ])
  })

  it('rejects create: reference on variants product slug', () => {
    const doc = readImportFile(
      'v.json',
      '[{"sku":"V1","product":"create:gold-ring","name":"Gold","price":10}]',
      'variants',
    )
    const res = validateDocument(doc, empty)
    expect(res.ok).toBe(false)
    expect(res.issues).toEqual([
      expect.objectContaining({
        field: 'product',
        message: expect.stringContaining('use lower case letters, digits and dashes only'),
      }),
    ])
  })
})
