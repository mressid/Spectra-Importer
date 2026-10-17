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

export interface FetchCatalogueOptions {
  query?: string
  kind?: SearchableKind | 'all'
  page?: number
  limitPerKind?: number // defaults to 5 per user request
}

export interface FetchCatalogueResult {
  items: CatalogueSearchItem[]
  hasMore: boolean
  page: number
  countsByKind: Record<string, number>
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
  {
    id: 'demo-brand-4',
    kind: 'brand',
    slug: 'chopard',
    name: 'Chopard',
    subtitle: 'Switzerland • Haute Horlogerie & Jewelry',
    isExistingInStore: true,
    data: { slug: 'chopard', name: 'Chopard', website: 'https://www.chopard.com', country: 'Switzerland', isAutoCreate: false },
  },
  {
    id: 'demo-brand-5',
    kind: 'brand',
    slug: 'van-cleef',
    name: 'Van Cleef & Arpels',
    subtitle: 'France • High Jewelry Maison',
    isExistingInStore: true,
    data: { slug: 'van-cleef', name: 'Van Cleef & Arpels', website: 'https://www.vancleefarpels.com', country: 'France', isAutoCreate: false },
  },
  {
    id: 'demo-brand-6',
    kind: 'brand',
    slug: 'boucheron',
    name: 'Boucheron',
    subtitle: 'France • Place Vendôme Jeweler',
    isExistingInStore: true,
    data: { slug: 'boucheron', name: 'Boucheron', website: 'https://www.boucheron.com', country: 'France', isAutoCreate: false },
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
  {
    id: 'demo-cat-5',
    kind: 'category',
    slug: 'earrings',
    name: 'Earrings',
    subtitle: 'Parent: Fine Jewelry',
    isExistingInStore: true,
    data: { slug: 'earrings', name: 'Earrings', parent: 'fine-jewelry', sortOrder: 5, isActive: true, isAutoCreate: false },
  },
  {
    id: 'demo-cat-6',
    kind: 'category',
    slug: 'brooches',
    name: 'Brooches & Pins',
    subtitle: 'Parent: Fine Jewelry',
    isExistingInStore: true,
    data: { slug: 'brooches', name: 'Brooches & Pins', parent: 'fine-jewelry', sortOrder: 6, isActive: true, isAutoCreate: false },
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
  {
    id: 'demo-tag-5',
    kind: 'tag',
    slug: 'platinum',
    name: 'Platinum 950',
    subtitle: 'Material Tag',
    isExistingInStore: true,
    data: { slug: 'platinum', name: 'Platinum 950', isAutoCreate: false },
  },
  {
    id: 'demo-tag-6',
    kind: 'tag',
    slug: 'emerald',
    name: 'Zambian Emerald',
    subtitle: 'Gemstone Tag',
    isExistingInStore: true,
    data: { slug: 'emerald', name: 'Zambian Emerald', isAutoCreate: false },
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
  {
    id: 'demo-coll-3',
    kind: 'collection',
    slug: 'limited-edition',
    name: 'Limited Edition 2026',
    subtitle: 'Numbered Collector Pieces',
    isExistingInStore: true,
    data: { slug: 'limited-edition', name: 'Limited Edition 2026', isActive: true, isAutoCreate: false },
  },

  // Media (with real preview images)
  {
    id: 'demo-media-1',
    kind: 'media',
    slug: 'solitaire-diamond-ring.jpg',
    name: 'solitaire-diamond-ring.jpg',
    subtitle: '800x800 • 145.2 KB',
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80',
    isExistingInStore: true,
    data: {
      fileName: 'solitaire-diamond-ring.jpg',
      url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80',
      role: 'thumbnail',
      mediaType: 'IMAGE',
    },
  },
  {
    id: 'demo-media-2',
    kind: 'media',
    slug: 'gold-bangle-bracelet.jpg',
    name: 'gold-bangle-bracelet.jpg',
    subtitle: '1024x1024 • 210.8 KB',
    imageUrl: 'https://images.unsplash.com/photo-1611591475850-2f9f8c078041?auto=format&fit=crop&w=400&q=80',
    isExistingInStore: true,
    data: {
      fileName: 'gold-bangle-bracelet.jpg',
      url: 'https://images.unsplash.com/photo-1611591475850-2f9f8c078041?auto=format&fit=crop&w=400&q=80',
      role: 'gallery',
      mediaType: 'IMAGE',
    },
  },
  {
    id: 'demo-media-3',
    kind: 'media',
    slug: 'diamond-pendant-necklace.jpg',
    name: 'diamond-pendant-necklace.jpg',
    subtitle: '800x800 • 182.4 KB',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
    isExistingInStore: true,
    data: {
      fileName: 'diamond-pendant-necklace.jpg',
      url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
      role: 'gallery',
      mediaType: 'IMAGE',
    },
  },
]

/**
 * Lazy loads catalogue items from the Store API and local Image Library.
 * Defaults to max 5 items per resource kind.
 */
export async function fetchCatalogueItems(
  options: FetchCatalogueOptions = {},
): Promise<FetchCatalogueResult> {
  const limitPerKind = Math.max(1, options.limitPerKind ?? 5)
  const page = Math.max(0, options.page ?? 0)
  const query = (options.query ?? '').trim().toLowerCase()
  const kindFilter = options.kind ?? 'all'

  const items: CatalogueSearchItem[] = []
  const seenKeys = new Set<string>()
  let hasMore = false

  // 1. Media Library
  if (kindFilter === 'all' || kindFilter === 'media') {
    try {
      const library = loadLibrary()
      const allMediaEntries = Array.from(library.entries())
      const filteredMedia = allMediaEntries.filter(([fileName]) => {
        if (!query) return true
        return fileName.toLowerCase().includes(query)
      })

      const startIndex = page * limitPerKind
      const pagedMedia = filteredMedia.slice(startIndex, startIndex + limitPerKind)
      if (filteredMedia.length > startIndex + limitPerKind) {
        hasMore = true
      }

      for (const [fileName, entry] of pagedMedia) {
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
              url: entry.url,
              role: 'gallery',
              mediaType: 'IMAGE',
            },
          })
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  // 2. Store API (if logged in)
  if (isLoggedIn() && (kindFilter === 'all' || kindFilter !== 'media')) {
    const allApiResources: { kind: SearchableKind; tmplKey: 'tags' | 'brands' | 'categories' | 'collections' }[] = [
      { kind: 'tag', tmplKey: 'tags' },
      { kind: 'brand', tmplKey: 'brands' },
      { kind: 'category', tmplKey: 'categories' },
      { kind: 'collection', tmplKey: 'collections' },
    ]
    const apiResources = allApiResources.filter((res) => kindFilter === 'all' || res.kind === kindFilter)

    await Promise.all(
      apiResources.map(async ({ kind, tmplKey }) => {
        try {
          const tmpl = TEMPLATES[tmplKey]
          if (!tmpl) return

          const searchParam = query ? `&search=${encodeURIComponent(query)}` : ''
          const url = `${tmpl.endpoint}?page=${page}&size=${limitPerKind}${searchParam}`
          const response = await request<{ content?: Record<string, unknown>[]; last?: boolean; totalElements?: number }>(
            'GET',
            url,
          )

          const content = response?.content ?? []
          if (response?.last === false || content.length >= limitPerKind) {
            hasMore = true
          }

          for (const raw of content) {
            const slug = String(raw[tmpl.idField] ?? '').trim()
            if (!slug) continue
            const name = String(raw.name ?? slug)

            // Client-side query matching safeguard in case API ignores search param
            if (
              query &&
              !name.toLowerCase().includes(query) &&
              !slug.toLowerCase().includes(query)
            ) {
              continue
            }

            const key = `${kind}:${slug}`
            if (!seenKeys.has(key)) {
              seenKeys.add(key)
              items.push({
                id: `${kind}-${String(raw.id ?? slug)}`,
                kind,
                slug,
                name,
                subtitle:
                  kind === 'brand' && raw.country
                    ? `${String(raw.country)}${raw.website ? ` • ${String(raw.website)}` : ''}`
                    : kind === 'category' && raw.parent
                    ? `Parent: ${String(raw.parent)}`
                    : `Store ${tmpl.title}`,
                imageUrl:
                  typeof raw.imageUrl === 'string'
                    ? raw.imageUrl
                    : typeof raw.logoUrl === 'string'
                    ? raw.logoUrl
                    : undefined,
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
          // Fall back gracefully if endpoint is unreachable
        }
      }),
    )
  }

  // 3. Demo Fallback items (filtered and sliced to limitPerKind)
  const demoCandidates = DEMO_CATALOGUE.filter((d) => {
    if (kindFilter !== 'all' && d.kind !== kindFilter) return false
    if (!query) return true
    return (
      d.name.toLowerCase().includes(query) ||
      d.slug.toLowerCase().includes(query) ||
      (d.subtitle && d.subtitle.toLowerCase().includes(query))
    )
  })

  // Group demo items by kind and slice each group according to page and limitPerKind
  const demoByKind = new Map<SearchableKind, CatalogueSearchItem[]>()
  for (const demo of demoCandidates) {
    const list = demoByKind.get(demo.kind) ?? []
    list.push(demo)
    demoByKind.set(demo.kind, list)
  }

  demoByKind.forEach((group) => {
    const start = page * limitPerKind
    const paged = group.slice(start, start + limitPerKind)
    if (group.length > start + limitPerKind) {
      hasMore = true
    }
    for (const demo of paged) {
      const key = `${demo.kind}:${demo.slug}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        items.push(demo)
      }
    }
  })

  const countsByKind: Record<string, number> = { all: items.length }
  for (const item of items) {
    countsByKind[item.kind] = (countsByKind[item.kind] ?? 0) + 1
  }

  return {
    items,
    hasMore,
    page,
    countsByKind,
  }
}

/**
 * Convenience method: loads initial catalogue items with max 5 items per kind.
 */
export async function loadCatalogueItems(limitPerKind = 5): Promise<CatalogueSearchItem[]> {
  const res = await fetchCatalogueItems({ limitPerKind, page: 0 })
  return res.items
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
