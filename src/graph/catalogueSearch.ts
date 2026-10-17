import { TEMPLATES } from '../templates'
import { isLoggedIn, request } from '../upload/api'
import { loadLibrary } from '../upload/imageLibrary'

export type SearchableKind = 'brand' | 'category' | 'tag' | 'collection' | 'media'

export interface CatalogueSearchItem {
  id: string
  kind: SearchableKind
  slug: string
  name: string
  subtitle?: string
  imageUrl?: string
  isExistingInStore: boolean
  data: Record<string, unknown>
}

// Built-in fallback catalogue entries to enable testing when offline or unauthenticated
const DEMO_CATALOGUE: CatalogueSearchItem[] = [
  // Brands
  {
    id: 'demo-brand-1',
    kind: 'brand',
    slug: 'cartier',
    name: 'Cartier',
    subtitle: 'France • Luxury Jewelry & Watches',
    isExistingInStore: true,
    data: { slug: 'cartier', name: 'Cartier', website: 'https://www.cartier.com', country: 'France', isAutoCreate: false },
  },
  {
    id: 'demo-brand-2',
    kind: 'brand',
    slug: 'tiffany',
    name: 'Tiffany & Co.',
    subtitle: 'United States • Fine Jewelry & Sterling Silver',
    isExistingInStore: true,
    data: { slug: 'tiffany', name: 'Tiffany & Co.', website: 'https://www.tiffany.com', country: 'United States', isAutoCreate: false },
  },
  {
    id: 'demo-brand-3',
    kind: 'brand',
    slug: 'bvlgari',
    name: 'Bvlgari',
    subtitle: 'Italy • High Jewelry & Luxury Goods',
    isExistingInStore: true,
    data: { slug: 'bvlgari', name: 'Bvlgari', website: 'https://www.bulgari.com', country: 'Italy', isAutoCreate: false },
  },
  // Categories
  {
    id: 'demo-cat-1',
    kind: 'category',
    slug: 'fine-jewelry',
    name: 'Fine Jewelry',
    subtitle: 'Root Category',
    isExistingInStore: true,
    data: { slug: 'fine-jewelry', name: 'Fine Jewelry', sortOrder: 1, isActive: true, isAutoCreate: false },
  },
  {
    id: 'demo-cat-2',
    kind: 'category',
    slug: 'rings',
    name: 'Rings',
    subtitle: 'Parent: Fine Jewelry',
    isExistingInStore: true,
    data: { slug: 'rings', name: 'Rings', parent: 'fine-jewelry', sortOrder: 2, isActive: true, isAutoCreate: false },
  },
  {
    id: 'demo-cat-3',
    kind: 'category',
    slug: 'bracelets',
    name: 'Bracelets',
    subtitle: 'Parent: Fine Jewelry',
    isExistingInStore: true,
    data: { slug: 'bracelets', name: 'Bracelets', parent: 'fine-jewelry', sortOrder: 3, isActive: true, isAutoCreate: false },
  },
  {
    id: 'demo-cat-4',
    kind: 'category',
    slug: 'necklaces',
    name: 'Necklaces & Pendants',
    subtitle: 'Parent: Fine Jewelry',
    isExistingInStore: true,
    data: { slug: 'necklaces', name: 'Necklaces & Pendants', parent: 'fine-jewelry', sortOrder: 4, isActive: true, isAutoCreate: false },
  },
  // Tags
  {
    id: 'demo-tag-1',
    kind: 'tag',
    slug: 'gold-18k',
    name: '18K Gold',
    subtitle: 'Material Tag',
    isExistingInStore: true,
    data: { slug: 'gold-18k', name: '18K Gold', isAutoCreate: false },
  },
  {
    id: 'demo-tag-2',
    kind: 'tag',
    slug: 'diamonds',
    name: 'Natural Diamonds',
    subtitle: 'Gemstone Tag',
    isExistingInStore: true,
    data: { slug: 'diamonds', name: 'Natural Diamonds', isAutoCreate: false },
  },
  {
    id: 'demo-tag-3',
    kind: 'tag',
    slug: 'bestseller',
    name: 'Bestseller',
    subtitle: 'Marketing Tag',
    isExistingInStore: true,
    data: { slug: 'bestseller', name: 'Bestseller', isAutoCreate: false },
  },
  {
    id: 'demo-tag-4',
    kind: 'tag',
    slug: 'new-arrival',
    name: 'New Arrival',
    subtitle: 'Seasonal Tag',
    isExistingInStore: true,
    data: { slug: 'new-arrival', name: 'New Arrival', isAutoCreate: false },
  },
  // Collections
  {
    id: 'demo-coll-1',
    kind: 'collection',
    slug: 'summer-2026',
    name: 'Summer Glamour 2026',
    subtitle: 'Seasonal Featured Collection',
    isExistingInStore: true,
    data: { slug: 'summer-2026', name: 'Summer Glamour 2026', isActive: true, isAutoCreate: false },
  },
  {
    id: 'demo-coll-2',
    kind: 'collection',
    slug: 'bridal-collection',
    name: 'Bridal & Engagement',
    subtitle: 'Curated Wedding Catalogue',
    isExistingInStore: true,
    data: { slug: 'bridal-collection', name: 'Bridal & Engagement', isActive: true, isAutoCreate: false },
  },
]

/**
 * Loads catalogue items across the store API and the local image library.
 */
export async function loadCatalogueItems(): Promise<CatalogueSearchItem[]> {
  const items: CatalogueSearchItem[] = []
  const seenKeys = new Set<string>()

  // 1. Load Media from local ImageLibrary (and localStorage)
  try {
    const library = loadLibrary()
    for (const [fileName, entry] of library.entries()) {
      const key = `media:${fileName}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        const dim = entry.width && entry.height ? `${entry.width}x${entry.height}` : null
        items.push({
          id: `media-${fileName}`,
          kind: 'media',
          slug: fileName,
          name: fileName,
          subtitle: dim ? `${dim} • ${(entry.sizeBytes / 1024).toFixed(1)} KB` : `${(entry.sizeBytes / 1024).toFixed(1)} KB`,
          imageUrl: entry.url,
          isExistingInStore: true,
          data: {
            fileName,
            role: 'gallery',
            mediaType: 'IMAGE',
          },
        })
      }
    }
  } catch {
    // Ignore storage errors
  }

  // 2. Load Resources from Store API if authenticated
  if (isLoggedIn()) {
    const apiResources: { kind: SearchableKind; tmplKey: 'tags' | 'brands' | 'categories' | 'collections' }[] = [
      { kind: 'tag', tmplKey: 'tags' },
      { kind: 'brand', tmplKey: 'brands' },
      { kind: 'category', tmplKey: 'categories' },
      { kind: 'collection', tmplKey: 'collections' },
    ]
    await Promise.all(
      apiResources.map(async ({ kind, tmplKey }) => {
        try {
          const tmpl = TEMPLATES[tmplKey]
          if (!tmpl) return
          const response = await request<{ content?: Record<string, unknown>[] }>(
            'GET',
            `${tmpl.endpoint}?page=0&size=100`,
          )
          const content = response?.content ?? []
          for (const raw of content) {
            const slug = String(raw[tmpl.idField] ?? '').trim()
            if (!slug) continue
            const key = `${kind}:${slug}`
            if (!seenKeys.has(key)) {
              seenKeys.add(key)
              items.push({
                id: `${kind}-${String(raw.id ?? slug)}`,
                kind,
                slug,
                name: String(raw.name ?? slug),
                subtitle:
                  kind === 'brand' && raw.country
                    ? `${String(raw.country)}${raw.website ? ` • ${String(raw.website)}` : ''}`
                    : kind === 'category' && raw.parent
                    ? `Parent: ${String(raw.parent)}`
                    : `Store ${tmpl.title}`,
                imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : typeof raw.logoUrl === 'string' ? raw.logoUrl : undefined,
                isExistingInStore: true,
                data: {
                  ...raw,
                  slug,
                  isAutoCreate: false,
                },
              })
            }
          }
        } catch {
          // Fall back gracefully if endpoint fails
        }
      }),
    )
  }

  // 3. Fallback demo data to guarantee search experience works out of the box
  for (const demo of DEMO_CATALOGUE) {
    const key = `${demo.kind}:${demo.slug}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      items.push(demo)
    }
  }

  return items
}

/**
 * Filter catalogue items by query and kind.
 */
export function filterCatalogueItems(
  items: CatalogueSearchItem[],
  query: string,
  selectedKind: SearchableKind | 'all',
): CatalogueSearchItem[] {
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    if (selectedKind !== 'all' && item.kind !== selectedKind) {
      return false
    }
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    )
  })
}
