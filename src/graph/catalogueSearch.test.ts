import { describe, expect, it } from 'vitest'
import {
  type CatalogueSearchItem,
  fetchCatalogueItems,
  filterCatalogueItems,
  loadCatalogueItems,
} from './catalogueSearch'

describe('catalogueSearch', () => {
  it('loads catalogue items with built-in catalogue data limited to 5 max per kind', async () => {
    const items = await loadCatalogueItems(5)
    expect(items.length).toBeGreaterThan(0)

    const brands = items.filter((i) => i.kind === 'brand')
    const categories = items.filter((i) => i.kind === 'category')
    const tags = items.filter((i) => i.kind === 'tag')
    const collections = items.filter((i) => i.kind === 'collection')
    const media = items.filter((i) => i.kind === 'media')

    expect(brands.length).toBeLessThanOrEqual(5)
    expect(categories.length).toBeLessThanOrEqual(5)
    expect(tags.length).toBeLessThanOrEqual(5)
    expect(collections.length).toBeLessThanOrEqual(5)
    expect(media.length).toBeLessThanOrEqual(5)

    expect(brands.length).toBeGreaterThan(0)
    expect(categories.length).toBeGreaterThan(0)
    expect(tags.length).toBeGreaterThan(0)
    expect(collections.length).toBeGreaterThan(0)
    expect(media.length).toBeGreaterThan(0)
  })

  it('provides media items with preview image URLs', async () => {
    const result = await fetchCatalogueItems({ kind: 'media', limitPerKind: 5 })
    expect(result.items.length).toBeGreaterThan(0)
    for (const item of result.items) {
      expect(item.kind).toBe('media')
      expect(item.imageUrl).toBeDefined()
      expect(item.imageUrl).toMatch(/^https?:\/\//)
      expect(item.data.url).toBe(item.imageUrl)
    }
  })

  it('lazy loads with pagination (page 0 and page 1)', async () => {
    const page0 = await fetchCatalogueItems({ kind: 'brand', page: 0, limitPerKind: 3 })
    expect(page0.items.length).toBe(3)

    const page1 = await fetchCatalogueItems({ kind: 'brand', page: 1, limitPerKind: 3 })
    expect(page1.items.length).toBeGreaterThan(0)

    // Items on page 1 should not overlap with page 0
    const page0Slugs = new Set(page0.items.map((i) => i.slug))
    for (const item of page1.items) {
      expect(page0Slugs.has(item.slug)).toBe(false)
    }
  })

  it('filters catalogue items dynamically by query', async () => {
    const searchResult = await fetchCatalogueItems({ query: 'cartier', limitPerKind: 5 })
    expect(searchResult.items.length).toBe(1)
    expect(searchResult.items[0].slug).toBe('cartier')
  })

  it('filters catalogue items by query across name and slug', () => {
    const sample: CatalogueSearchItem[] = [
      {
        id: '1',
        kind: 'brand',
        slug: 'cartier',
        name: 'Cartier',
        isExistingInStore: true,
        data: {},
      },
      {
        id: '2',
        kind: 'category',
        slug: 'rings',
        name: 'Gold Rings',
        isExistingInStore: true,
        data: {},
      },
      {
        id: '3',
        kind: 'tag',
        slug: 'diamonds',
        name: 'Diamonds',
        isExistingInStore: true,
        data: {},
      },
    ]

    const res1 = filterCatalogueItems(sample, 'cartier', 'all')
    expect(res1).toHaveLength(1)
    expect(res1[0].slug).toBe('cartier')

    const res2 = filterCatalogueItems(sample, 'gold', 'all')
    expect(res2).toHaveLength(1)
    expect(res2[0].name).toBe('Gold Rings')

    const res3 = filterCatalogueItems(sample, 'dia', 'all')
    expect(res3).toHaveLength(1)
    expect(res3[0].slug).toBe('diamonds')
  })

  it('filters catalogue items by kind', () => {
    const sample: CatalogueSearchItem[] = [
      {
        id: '1',
        kind: 'brand',
        slug: 'tiffany',
        name: 'Tiffany',
        isExistingInStore: true,
        data: {},
      },
      {
        id: '2',
        kind: 'tag',
        slug: 'tiffany-blue',
        name: 'Tiffany Blue',
        isExistingInStore: true,
        data: {},
      },
    ]

    const brandsOnly = filterCatalogueItems(sample, 'tiffany', 'brand')
    expect(brandsOnly).toHaveLength(1)
    expect(brandsOnly[0].kind).toBe('brand')

    const tagsOnly = filterCatalogueItems(sample, 'tiffany', 'tag')
    expect(tagsOnly).toHaveLength(1)
    expect(tagsOnly[0].kind).toBe('tag')
  })
})
