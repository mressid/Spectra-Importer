/**
 * Moves rows into the graph: the products, variants, brands, categories, tags and collections that are loaded as files (or made by
 * auto-configure) become nodes with the same identifiers and the same data, their references become edges, and `media:` images
 * become media nodes. What the graph's nodes do not carry is reported, so nothing is lost without being said.
 */
import type { ImportDocument, RawRow, ResourceKind } from '../core/types'
import { TEMPLATES } from '../templates'
import type { ImageLibrary } from '../upload/imageLibrary'
import { parseReference, slugToTitle } from '../validate/references'
import type { GraphEdge, GraphEdgeType, GraphNode, MediaNode, ProductGraph } from './types'

export type RowDocuments = Partial<Record<ResourceKind, ImportDocument | undefined>>

export interface DocumentGraph {
  graph: ProductGraph
  counts: Record<'products' | 'variants' | 'brands' | 'categories' | 'tags' | 'collections' | 'media', number>
  /** Row fields the graph has no place for: they stay in the rows but are not in the graph. */
  unsupported: string[]
}

const PRODUCT_FIELDS = [
  'slug', 'name', 'sku', 'barcode', 'price', 'compareAtPrice', 'weightGrams', 'stockQuantity', 'leadTimeDays', 'availability',
  'shortDescription', 'description', 'descriptionFormat', 'seoTitle', 'seoDescription', 'isActive', 'hasVariants',
  'allowPersonalization', 'personalizationInstructions',
] as const
const PRODUCT_HANDLED = new Set<string>([...PRODUCT_FIELDS, 'thumbnailUrl', 'images', 'brand', 'categories', 'tags', 'collections'])
const VARIANT_FIELDS = ['sku', 'name', 'price', 'compareAtPrice', 'barcode', 'weightGrams', 'stockQuantity', 'safetyStock', 'leadTimeDays', 'availability', 'isActive'] as const
const BRAND_FIELDS = ['slug', 'name', 'website', 'country', 'logoUrl'] as const
const CATEGORY_FIELDS = ['slug', 'name', 'sortOrder', 'isActive', 'imageUrl', 'seoTitle', 'seoDescription'] as const
const COLLECTION_FIELDS = ['slug', 'name', 'description', 'startAt', 'endAt', 'isActive'] as const
const TAG_FIELDS = ['slug', 'name'] as const

const COLUMN = { brand: 40, category: 320, product: 600, media: 880, variant: 1140, tag: 1140 }
const ROW = 250

/** A row as typed values: "12,5" and "yes" of a CSV become numbers and booleans, as the import itself will read them. */
function typed(kind: ResourceKind, row: RawRow): Record<string, unknown> {
  const parsed = TEMPLATES[kind].schema.safeParse(row)
  return (parsed.success ? parsed.data : row) as Record<string, unknown>
}

const pick = (row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(fields.filter((f) => row[f] !== undefined && row[f] !== '' && row[f] !== null).map((f) => [f, row[f]]))

const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? value.split('|').map((v) => v.trim()).filter(Boolean) : [])

const MEDIA_REF = /^media:(.+)$/

export function graphFromDocuments(docs: RowDocuments, library: ImageLibrary): DocumentGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const unsupported = new Set<string>()
  const counts: DocumentGraph['counts'] = { products: 0, variants: 0, brands: 0, categories: 0, tags: 0, collections: 0, media: 0 }
  const ids = new Map<string, string>() // "kind:identifier" -> node id

  const node = (type: GraphNode['type'], identifier: string, x: number, y: number, data: Record<string, unknown>): string => {
    const key = `${type}:${identifier}`
    const existing = ids.get(key)
    if (existing) return existing
    const id = `node-${type}-${identifier.replace(/[^A-Za-z0-9_-]+/g, '_')}`
    ids.set(key, id)
    nodes.push({ id, type, x, y, data } as unknown as GraphNode)
    return id
  }
  const edge = (source: string, target: string, type: GraphEdgeType) => {
    if (!edges.some((e) => e.source === source && e.target === target && e.type === type)) edges.push({ id: `edge-${source}-${target}`, source, target, type })
  }

  // rows that are in a document are real rows (not `create:` references): their nodes are not auto-created
  for (const [i, row] of (docs.brands?.rows ?? []).entries()) {
    const r = typed('brands', row)
    const slug = String(r.slug ?? '').trim()
    if (slug) {
      node('brand', slug, COLUMN.brand, 60 + i * ROW, { ...pick(r, BRAND_FIELDS), isAutoCreate: false })
      counts.brands++
    }
  }
  for (const [i, row] of (docs.categories?.rows ?? []).entries()) {
    const r = typed('categories', row)
    const slug = String(r.slug ?? '').trim()
    if (slug) {
      node('category', slug, COLUMN.category, 60 + i * ROW, { ...pick(r, CATEGORY_FIELDS), isAutoCreate: false })
      counts.categories++
    }
  }
  for (const [i, row] of (docs.categories?.rows ?? []).entries()) {
    const r = typed('categories', row)
    const parent = parseReference(r.parent)
    if (parent.slug && r.slug) {
      const child = ids.get(`category:${String(r.slug).trim()}`)
      const parentId = ids.get(`category:${parent.slug}`) ?? node('category', parent.slug, COLUMN.category, 60 + (counts.categories + i) * ROW, { slug: parent.slug, name: slugToTitle(parent.slug), isAutoCreate: parent.isCreate })
      if (child) edge(child, parentId, 'category-parent')
    }
  }
  for (const [i, row] of (docs.tags?.rows ?? []).entries()) {
    const r = typed('tags', row)
    const slug = String(r.slug ?? '').trim()
    if (slug) {
      node('tag', slug, COLUMN.tag, 60 + i * ROW, { ...pick(r, TAG_FIELDS), isAutoCreate: false })
      counts.tags++
    }
  }
  for (const [i, row] of (docs.collections?.rows ?? []).entries()) {
    const r = typed('collections', row)
    const slug = String(r.slug ?? '').trim()
    if (slug) {
      node('collection', slug, COLUMN.brand, 60 + (counts.brands + i) * ROW, { ...pick(r, COLLECTION_FIELDS), isAutoCreate: false })
      counts.collections++
    }
  }

  let y = 60
  for (const row of docs.products?.rows ?? []) {
    const r = typed('products', row)
    const slug = String(r.slug ?? '').trim()
    if (!slug) continue
    for (const key of Object.keys(row)) if (!PRODUCT_HANDLED.has(key) && row[key] !== '' && row[key] !== undefined) unsupported.add(key)

    const data: Record<string, unknown> = pick(r, PRODUCT_FIELDS)
    const productId = node('product', slug, COLUMN.product, y, data)
    counts.products++

    // images: `media:<key>` (uploaded in the Images step) or an address; the thumbnail first, then the gallery in order
    const photos: { value: string; role: 'thumbnail' | 'gallery'; sortOrder?: number }[] = []
    const thumb = typeof r.thumbnailUrl === 'string' ? r.thumbnailUrl.trim() : ''
    if (thumb) photos.push({ value: thumb, role: 'thumbnail' })
    list(r.images).forEach((value, i) => photos.push({ value, role: 'gallery', sortOrder: i + 1 }))
    photos.forEach(({ value, role, sortOrder }, m) => {
      const ref = MEDIA_REF.exec(value)
      const fileName = ref ? (ref[1] as string) : value
      const mediaData: MediaNode['data'] = {
        fileName,
        url: ref ? library.get(fileName)?.url : value,
        mediaType: /\.(mp4|webm|mov|ogg)(\?|$)/i.test(fileName) ? 'VIDEO' : 'IMAGE',
        role,
        sortOrder,
      }
      const mediaId = node('media', fileName, COLUMN.media, y + m * ROW, mediaData as unknown as Record<string, unknown>)
      edge(mediaId, productId, 'product-media')
      counts.media++
    })

    const brand = parseReference(r.brand)
    if (brand.slug) edge(node('brand', brand.slug, COLUMN.brand, 60 + counts.brands * ROW, { slug: brand.slug, name: slugToTitle(brand.slug), isAutoCreate: brand.isCreate }), productId, 'product-brand')
    for (const [kind, field, type, column] of [
      ['category', 'categories', 'product-category', COLUMN.category],
      ['tag', 'tags', 'product-tag', COLUMN.tag],
      ['collection', 'collections', 'product-collection', COLUMN.brand],
    ] as const) {
      for (const value of list(r[field])) {
        const ref = parseReference(value)
        if (ref.slug) edge(node(kind, ref.slug, column, y + 200, { slug: ref.slug, name: slugToTitle(ref.slug), isAutoCreate: ref.isCreate }), productId, type)
      }
    }
    y += Math.max(photos.length, 1) * ROW + 60
  }

  for (const row of docs.variants?.rows ?? []) {
    const r = typed('variants', row)
    const sku = String(r.sku ?? '').trim()
    if (!sku) continue
    const variantId = node('variant', sku, COLUMN.variant, 60 + counts.variants * ROW, { ...pick(r, VARIANT_FIELDS), price: Number(r.price ?? 0) || 0 })
    counts.variants++
    const parent = ids.get(`product:${String(r.product ?? '').trim()}`)
    if (parent) edge(variantId, parent, 'product-variant')
  }

  return {
    graph: {
      id: `graph-${Date.now()}`,
      name: 'From rows',
      description: 'Rows moved into the graph: edit them here, then stage the result back into the importer.',
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
    counts,
    unsupported: [...unsupported].sort(),
  }
}
