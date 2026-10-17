import { describe, expect, it } from 'vitest'
import {
  isAutoCreatableTarget,
  isValidSlug,
  parseReference,
  slugToTitle,
} from './references'

describe('parseReference', () => {
  it('parses plain slugs without create: prefix', () => {
    expect(parseReference('summer-sale')).toEqual({
      raw: 'summer-sale',
      isCreate: false,
      slug: 'summer-sale',
    })
    expect(parseReference('acme')).toEqual({
      raw: 'acme',
      isCreate: false,
      slug: 'acme',
    })
  })

  it('handles empty and null values', () => {
    expect(parseReference('')).toEqual({
      raw: '',
      isCreate: false,
      slug: '',
    })
    expect(parseReference(undefined)).toEqual({
      raw: '',
      isCreate: false,
      slug: '',
    })
    expect(parseReference(null)).toEqual({
      raw: '',
      isCreate: false,
      slug: '',
    })
  })

  it('parses create: prefix case-insensitively and trims', () => {
    expect(parseReference('create:summer-sale')).toEqual({
      raw: 'create:summer-sale',
      isCreate: true,
      slug: 'summer-sale',
    })
    expect(parseReference('CREATE:Summer-Sale')).toEqual({
      raw: 'CREATE:Summer-Sale',
      isCreate: true,
      slug: 'summer-sale',
    })
    expect(parseReference('  create:rings  ')).toEqual({
      raw: 'create:rings',
      isCreate: true,
      slug: 'rings',
    })
    expect(parseReference('create:')).toEqual({
      raw: 'create:',
      isCreate: true,
      slug: '',
    })
  })
})

describe('isValidSlug', () => {
  it('accepts valid lower case slugs with hyphens and digits', () => {
    expect(isValidSlug('rings')).toBe(true)
    expect(isValidSlug('summer-sale-2026')).toBe(true)
    expect(isValidSlug('14k-gold')).toBe(true)
  })

  it('rejects invalid slugs with spaces, uppercase, symbols, or consecutive dashes', () => {
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('Summer Sale')).toBe(false)
    expect(isValidSlug('summer_sale')).toBe(false)
    expect(isValidSlug('-rings')).toBe(false)
    expect(isValidSlug('rings-')).toBe(false)
    expect(isValidSlug('rings--gold')).toBe(false)
  })
})

describe('slugToTitle', () => {
  it('converts slug to capitalized title', () => {
    expect(slugToTitle('summer-sale')).toBe('Summer Sale')
    expect(slugToTitle('rings')).toBe('Rings')
    expect(slugToTitle('14k-gold-rings')).toBe('14k Gold Rings')
    expect(slugToTitle('')).toBe('')
  })
})

describe('isAutoCreatableTarget', () => {
  it('accepts supported targets and rejects unsupported ones', () => {
    expect(isAutoCreatableTarget('tags')).toBe(true)
    expect(isAutoCreatableTarget('brands')).toBe(true)
    expect(isAutoCreatableTarget('categories')).toBe(true)
    expect(isAutoCreatableTarget('collections')).toBe(true)
    expect(isAutoCreatableTarget('products')).toBe(false)
    expect(isAutoCreatableTarget('variants')).toBe(false)
  })
})
