import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readImportFile } from '../adapters'
import { RESOURCE_KINDS, type ResourceKind } from '../core/types'
import { TEMPLATES } from '.'
import { validateDocument, type ValidationContext } from '../validate/validate'

const example = (kind: ResourceKind, extension: string) =>
  readImportFile(`${kind}.${extension}`, readFileSync(`templates/${kind}/${kind}.${extension}`, 'utf8'), kind)

// every identifier used by the examples, so the references between templates resolve
const pending: ValidationContext['pending'] = Object.fromEntries(
  RESOURCE_KINDS.map((kind) => [kind, new Set(example(kind, 'json').rows.map((row) => String(row[TEMPLATES[kind].idField])))]),
)
// the images the examples point at, as if they had been uploaded to the library
const images = new Set(['acme-logo.png', 'rings-cover.jpg', 'ring-gold-1.jpg', 'ring-gold-2.jpg', 'ring-gold-3.jpg'])

describe.each(RESOURCE_KINDS)('template %s', (kind) => {
  it.each(['json', 'yaml', 'csv'])('%s example is valid', (extension) => {
    const result = validateDocument(example(kind, extension), { pending, existing: {}, images })
    expect(result.issues).toEqual([])
  })

  it('csv and yaml examples give the same values as json (except json-only fields)', () => {
    const jsonOnly = new Set(['contentBlocks'])
    const values = (extension: string) =>
      validateDocument(example(kind, extension), { pending, existing: {}, images }).clean.map((row) =>
        Object.fromEntries(Object.entries(row.values).filter(([name]) => !jsonOnly.has(name))),
      )
    expect(values('csv')).toEqual(values('json'))
    expect(values('yaml')).toEqual(values('json'))
  })
})
