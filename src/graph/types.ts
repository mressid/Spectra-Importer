import type { ImportDocument, ResourceKind } from '../core/types'

export type GraphNodeType =
  | 'product'
  | 'brand'
  | 'category'
  | 'collection'
  | 'tag'
  | 'variant'
  | 'media'

export interface ProductNodeData {
  slug: string
  name: string
  thumbnailUrl?: string
  sku?: string
  barcode?: string
  price?: number
  compareAtPrice?: number
  weightGrams?: number
  stockQuantity?: number
  leadTimeDays?: number
  availability?: 'AUTO' | 'ON_ORDER' | 'SOLD_OUT'
  shortDescription?: string
  description?: string
  descriptionFormat?: 'MARKDOWN' | 'HTML' | 'TEXT'
  seoTitle?: string
  seoDescription?: string
  isActive?: boolean
  hasVariants?: boolean
  allowPersonalization?: boolean
  personalizationInstructions?: string
}

export interface BrandNodeData {
  slug: string
  name: string
  website?: string
  country?: string
  logoUrl?: string
  /** If true, emitted as `create:<slug>` reference in dependent products. */
  isAutoCreate?: boolean
}

export interface CategoryNodeData {
  slug: string
  name: string
  sortOrder?: number
  isActive?: boolean
  imageUrl?: string
  seoTitle?: string
  seoDescription?: string
  /** If true, emitted as `create:<slug>` reference in dependent products or subcategories. */
  isAutoCreate?: boolean
}

export interface CollectionNodeData {
  slug: string
  name: string
  description?: string
  startAt?: string
  endAt?: string
  isActive?: boolean
  /** If true, emitted as `create:<slug>` reference in dependent products. */
  isAutoCreate?: boolean
}

export interface TagNodeData {
  slug: string
  name: string
  /** If true, emitted as `create:<slug>` reference in dependent products. */
  isAutoCreate?: boolean
}

export interface VariantNodeData {
  sku: string
  name: string
  price: number
  compareAtPrice?: number
  barcode?: string
  weightGrams?: number
  stockQuantity?: number
  safetyStock?: number
  leadTimeDays?: number
  availability?: 'AUTO' | 'ON_ORDER' | 'SOLD_OUT'
  isActive?: boolean
}

export interface MediaNodeData {
  fileName: string
  url?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  role?: 'thumbnail' | 'gallery'
  sortOrder?: number
}

export type NodeDataMap = {
  product: ProductNodeData
  brand: BrandNodeData
  category: CategoryNodeData
  collection: CollectionNodeData
  tag: TagNodeData
  variant: VariantNodeData
  media: MediaNodeData
}

export type ProductNode = { id: string; type: 'product'; x: number; y: number; data: ProductNodeData }
export type BrandNode = { id: string; type: 'brand'; x: number; y: number; data: BrandNodeData }
export type CategoryNode = { id: string; type: 'category'; x: number; y: number; data: CategoryNodeData }
export type CollectionNode = { id: string; type: 'collection'; x: number; y: number; data: CollectionNodeData }
export type TagNode = { id: string; type: 'tag'; x: number; y: number; data: TagNodeData }
export type VariantNode = { id: string; type: 'variant'; x: number; y: number; data: VariantNodeData }
export type MediaNode = { id: string; type: 'media'; x: number; y: number; data: MediaNodeData }

export type GraphNode =
  | ProductNode
  | BrandNode
  | CategoryNode
  | CollectionNode
  | TagNode
  | VariantNode
  | MediaNode

export function getNodeDisplayTitle(node: GraphNode): string {
  switch (node.type) {
    case 'product':
    case 'brand':
    case 'category':
    case 'collection':
    case 'tag':
      return node.data.name || node.data.slug || 'Untitled'
    case 'variant':
      return node.data.name || node.data.sku || 'Variant'
    case 'media':
      return node.data.fileName || 'Media'
  }
}

export function getNodeDisplaySubtitle(node: GraphNode): string {
  switch (node.type) {
    case 'product':
    case 'brand':
    case 'category':
    case 'collection':
    case 'tag':
      return node.data.slug || ''
    case 'variant':
      return node.data.sku || ''
    case 'media':
      return node.data.fileName || ''
  }
}

export type GraphEdgeType =
  | 'product-brand'
  | 'product-category'
  | 'category-parent'
  | 'product-collection'
  | 'product-tag'
  | 'product-variant'
  | 'product-media'

export interface GraphEdge {
  id: string
  source: string // node id
  target: string // node id
  type: GraphEdgeType
}

export interface ProductGraph {
  id: string
  name: string
  description?: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  updatedAt: string
}

export interface ProductManifest {
  version: 1
  manifestId: string
  name: string
  createdAt: string
  stats: {
    products: number
    variants: number
    categories: number
    brands: number
    tags: number
    collections: number
    media: number
    nodes: number
    edges: number
  }
  bundle: {
    products?: Record<string, unknown>[]
    variants?: Record<string, unknown>[]
    categories?: Record<string, unknown>[]
    brands?: Record<string, unknown>[]
    tags?: Record<string, unknown>[]
    collections?: Record<string, unknown>[]
  }
}

export interface BundleResult {
  documents: Partial<Record<ResourceKind, ImportDocument>>
  manifest: ProductManifest
  issues: string[]
  ok: boolean
}
