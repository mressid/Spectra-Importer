/**
 * "Apply" on a product's slug or SKU in the graph builder: reads that product from the store and fills the node with what the store
 * knows (name, descriptions, price and stock of a simple product, SEO...), connects its brand, categories, tags and collections, and
 * adds its gallery images and, for a product with options, its variants. Faster than typing it all again, for a product that is close to
 * one already there.
 *
 * `lookupProduct` talks to the store; `applySnapshot` is pure (graph in, graph out) so it can be tested without a store.
 */
import { request } from '../upload/api'
import type { GraphEdge, GraphEdgeType, GraphNode, MediaNodeData, ProductGraph, ProductNodeData, VariantNodeData } from './types'

type Row = Record<string, unknown>

export interface StoreSnapshot {
  product: Row
  variants: Row[]
  media: Row[]
  brand?: Row
  categories: Row[]
  tags: Row[]
  collections: Row[]
}

export interface Applied {
  brands: number
  categories: number
  tags: number
  collections: number
  images: number
  variants: number
}

const rows = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[]
  const content = (value as { content?: unknown } | null)?.content
  return Array.isArray(content) ? (content as Row[]) : []
}

const str = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)

/** Reads a product by slug or SKU; `first` says which of the two to try first. Null when the store has neither. */
export async function lookupProduct(
  by: { slug?: string; sku?: string; first?: 'slug' | 'sku' },
  send: typeof request = request,
): Promise<StoreSnapshot | null> {
  const bySlug = async (slug: string): Promise<Row | null> => rows(await send('GET', `/api/v1/products?slug=${encodeURIComponent(slug)}&size=1`))[0] ?? null
  const bySku = async (sku: string): Promise<Row | null> => {
    const variant = rows(await send('GET', `/api/v1/variants?skuContains=${encodeURIComponent(sku)}&size=50`)).find((v) => String(v.sku).toLowerCase() === sku.toLowerCase())
    return variant ? await send<Row>('GET', `/api/v1/products/${encodeURIComponent(String(variant.productId))}`) : null
  }

  let product: Row | null = null
  for (const key of by.first === 'sku' ? (['sku', 'slug'] as const) : (['slug', 'sku'] as const)) {
    const value = (by[key] ?? '').trim()
    if (!value) continue
    product = key === 'slug' ? await bySlug(value) : await bySku(value)
    if (product) break
  }
  if (!product) return null

  const id = encodeURIComponent(String(product.id))
  // the rest is a bonus: one missing piece must not lose the others
  const safe = async (path: string): Promise<unknown> => send('GET', path).catch(() => [])
  const [variants, media, categories, tags, collections, brand] = await Promise.all([
    safe(`/api/v1/variants?productId=${id}&size=100`),
    safe(`/api/v1/media?productId=${id}&size=100`),
    safe(`/api/v1/products/${id}/categories`),
    safe(`/api/v1/products/${id}/tags`),
    safe(`/api/v1/products/${id}/collections`),
    product.brandId ? send<Row>('GET', `/api/v1/brands/${encodeURIComponent(String(product.brandId))}`).catch(() => undefined) : Promise.resolve(undefined),
  ])
  return { product, variants: rows(variants), media: rows(media), brand, categories: rows(categories), tags: rows(tags), collections: rows(collections) }
}

const keep = <T extends object>(patch: T): Partial<T> => Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>

function variantData(v: Row): VariantNodeData {
  return {
    sku: String(v.sku),
    name: str(v.name) ?? String(v.sku),
    price: num(v.price) ?? 0,
    ...keep({
      compareAtPrice: num(v.compareAtPrice),
      barcode: str(v.barcode),
      weightGrams: num(v.weightGrams),
      stockQuantity: num(v.stockQuantity),
      safetyStock: num(v.safetyStock),
      leadTimeDays: num(v.leadTimeDays),
      availability: str(v.availability) as VariantNodeData['availability'],
      isActive: typeof v.isActive === 'boolean' ? v.isActive : undefined,
    }),
  }
}

const fileNameOf = (url: string): string => decodeURIComponent(url.split('?')[0].split('/').pop() || url)

/** Fills the product node and connects what the store has around it. Nodes that are already on the canvas are reused, not doubled. */
/** Makes ids unique even for two applies in the same millisecond. */
let sequence = 0

export function applySnapshot(graph: ProductGraph, productId: string, snapshot: StoreSnapshot): { graph: ProductGraph; applied: Applied } {
  const product = graph.nodes.find((n) => n.id === productId)
  if (!product || product.type !== 'product') return { graph, applied: { brands: 0, categories: 0, tags: 0, collections: 0, images: 0, variants: 0 } }

  const raw = snapshot.product
  const hasVariants = Boolean(raw.hasVariants)
  // a simple product keeps its SKU and price on its one variant
  const simple = hasVariants ? undefined : (snapshot.variants.find((v) => v.id === raw.defaultVariantId) ?? snapshot.variants[0])
  const patch: Partial<ProductNodeData> = keep<Partial<ProductNodeData>>({
    slug: str(raw.slug),
    name: str(raw.name),
    description: str(raw.description),
    shortDescription: str(raw.shortDescription),
    descriptionFormat: str(raw.descriptionFormat) as ProductNodeData['descriptionFormat'],
    thumbnailUrl: str(raw.thumbnailUrl),
    seoTitle: str(raw.seoTitle),
    seoDescription: str(raw.seoDescription),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
    hasVariants,
    allowPersonalization: typeof raw.allowPersonalization === 'boolean' ? raw.allowPersonalization : undefined,
    personalizationInstructions: str(raw.personalizationInstructions),
    availability: str(raw.availability) as ProductNodeData['availability'],
    leadTimeDays: num(raw.leadTimeDays),
    ...(simple ? { sku: str(simple.sku), barcode: str(simple.barcode), price: num(simple.price), compareAtPrice: num(simple.compareAtPrice), weightGrams: num(simple.weightGrams), stockQuantity: num(simple.stockQuantity) } : {}),
  })

  const stamp = `${Date.now().toString(36)}${(sequence++).toString(36)}`
  let counter = 0
  let nodes: GraphNode[] = graph.nodes.map((n) => (n.id === productId ? ({ ...n, data: { ...n.data, ...patch } } as GraphNode) : n))
  let edges: GraphEdge[] = graph.edges
  const applied: Applied = { brands: 0, categories: 0, tags: 0, collections: 0, images: 0, variants: 0 }
  const column = { left: 0, right: 0 }

  const place = (side: 'left' | 'right') => ({ x: product.x + (side === 'left' ? -290 : 300), y: product.y + column[side]++ * 140 })

  /** The node for this record: the one already on the canvas, or a new one; connected to the product either way. */
  const connect = (type: GraphNode['type'], same: (n: GraphNode) => boolean, data: object, edgeType: GraphEdgeType, side: 'left' | 'right', fromProduct = false): boolean => {
    let node = nodes.find((n) => n.type === type && same(n))
    const isNew = !node
    if (!node) {
      node = { id: `node-${type}-${stamp}-${counter++}`, type, ...place(side), data } as GraphNode
      nodes = [...nodes, node]
    }
    const [source, target] = fromProduct ? [productId, node.id] : [node.id, productId]
    if (!edges.some((e) => e.type === edgeType && e.source === source && e.target === target)) {
      edges = [...edges, { id: `edge-${node.id}-${productId}-${edgeType}`, source, target, type: edgeType }]
    }
    return isNew
  }

  const slugOf = (n: GraphNode) => (n.data as { slug?: string }).slug

  if (snapshot.brand) {
    const b = snapshot.brand
    // a product has one brand: the store's replaces the one on the canvas
    edges = edges.filter((e) => !(e.type === 'product-brand' && e.target === productId))
    if (connect('brand', (n) => slugOf(n) === b.slug, { slug: String(b.slug), name: str(b.name) ?? String(b.slug), ...keep({ website: str(b.website), country: str(b.country), logoUrl: str(b.logoUrl) }), isAutoCreate: false }, 'product-brand', 'left')) applied.brands++
  }
  for (const c of snapshot.categories) {
    if (connect('category', (n) => slugOf(n) === c.slug, { slug: String(c.slug), name: str(c.name) ?? String(c.slug), ...keep({ sortOrder: num(c.sortOrder), isActive: typeof c.isActive === 'boolean' ? c.isActive : undefined, imageUrl: str(c.imageUrl), seoTitle: str(c.seoTitle), seoDescription: str(c.seoDescription) }), isAutoCreate: false }, 'product-category', 'left')) applied.categories++
  }
  for (const t of snapshot.tags) {
    if (connect('tag', (n) => slugOf(n) === t.slug, { slug: String(t.slug), name: str(t.name) ?? String(t.slug), isAutoCreate: false }, 'product-tag', 'left')) applied.tags++
  }
  for (const c of snapshot.collections) {
    if (connect('collection', (n) => slugOf(n) === c.slug, { slug: String(c.slug), name: str(c.name) ?? String(c.slug), ...keep({ description: str(c.description), startAt: str(c.startAt), endAt: str(c.endAt), isActive: typeof c.isActive === 'boolean' ? c.isActive : undefined }), isAutoCreate: false }, 'product-collection', 'left')) applied.collections++
  }

  // the gallery: the product's own images, in order (the thumbnail is already on the node as its address)
  const gallery = snapshot.media
    .filter((m) => m.variantId == null && str(m.url) && m.url !== raw.thumbnailUrl)
    .sort((a, b) => (num(a.sortOrder) ?? 0) - (num(b.sortOrder) ?? 0))
  for (const m of gallery) {
    const url = String(m.url)
    const data: MediaNodeData = { fileName: fileNameOf(url), url, mediaType: m.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE', role: 'gallery', sortOrder: num(m.sortOrder) }
    if (connect('media', (n) => (n.data as MediaNodeData).url === url, data, 'product-media', 'right')) applied.images++
  }

  if (hasVariants) {
    for (const v of snapshot.variants) {
      if (connect('variant', (n) => (n.data as VariantNodeData).sku === v.sku, variantData(v), 'product-variant', 'right', true)) applied.variants++
    }
  }

  return { graph: { ...graph, nodes, edges, updatedAt: new Date().toISOString() }, applied }
}
