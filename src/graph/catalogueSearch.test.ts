import { describe, expect, it } from 'vitest'
import {
  type CatalogueSearchItem,
  filterCatalogueItems,
  loadCatalogueItems,
} from './catalogueSearch'

describe('catalogueSearch', () => {
  it('loads catalogue items with built-in catalogue data', async () => {
    const items = await loadCatalogueItems()
    expect(items.length).toBeGreaterThan(0)

    const brands = items.filter((i) => i.kind === 'brand')
    const categories = items.filter((i) => i.kind === 'category')
    const tags = items.filter((i) => i.kind === 'tag')
    const collections = items.filter((i) => i.kind === 'collection')

    expect(brands.length).toBeGreaterThan(0)
    expect(categories.length).toBeGreaterThan(0)
    expect(tags.length).toBeGreaterThan(0)
    expect(collections.length).toBeGreaterThan(0)
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
