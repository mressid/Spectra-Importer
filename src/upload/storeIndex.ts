import type { ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import { request } from './api'

export interface PageInfo {
  size?: number
  number?: number
  totalElements?: number
  totalPages?: number
}

export interface PageResponse<T = Record<string, unknown>> {
  content?: T[]
  page?: PageInfo
  totalPages?: number
  number?: number
  last?: boolean
}

export interface LoadStoreIndexOptions {
  /** Which resources to load. Defaults to all RESOURCE_KINDS. */
  kinds?: readonly ResourceKind[]
  /** Page size for pagination. Defaults to 200. */
  pageSize?: number
  /** If provided, variants will be fetched for these product IDs instead of all variants. */
  productIds?: string[]
}

/**
 * Reads every page of a resource from the store API.
 */
async function fetchAllPages(
  endpoint: string,
  idField: string,
  pageSize: number,
  extraParams?: Record<string, string>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  let page = 0

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
      ...(extraParams ?? {}),
    })
    const path = `${endpoint}?${params.toString()}`
    const response = await request<PageResponse<Record<string, unknown>>>('GET', path)

    const content = response?.content ?? []
    for (const item of content) {
      if (!item || typeof item !== 'object') continue
      const idVal = item[idField]
      const storeIdVal = item.id
      if (idVal !== undefined && idVal !== null && storeIdVal !== undefined && storeIdVal !== null) {
        const id = String(idVal).trim()
        const storeId = String(storeIdVal).trim()
        if (id && storeId) {
          result.set(id, storeId)
        }
      }
    }

    const totalPages = response?.page?.totalPages ?? response?.totalPages
    const isLast =
      response?.last === true ||
      (totalPages !== undefined ? page + 1 >= totalPages : content.length < pageSize)

    if (isLast || content.length === 0) {
      break
    }

    page++
  }

  return result
}

/**
 * Loads variants either by product IDs or across all variants.
 */
async function loadVariants(
  pageSize: number,
  productIds?: string[],
  fallbackProductIds?: Iterable<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  if (productIds && productIds.length > 0) {
    for (const productId of productIds) {
      const pageMap = await fetchAllPages('/api/v1/variants', 'sku', pageSize, { productId })
      for (const [sku, storeId] of pageMap) {
        map.set(sku, storeId)
      }
    }
    return map
  }

  try {
    return await fetchAllPages('/api/v1/variants', 'sku', pageSize)
  } catch (err) {
    if (fallbackProductIds) {
      const ids = Array.from(fallbackProductIds)
      if (ids.length > 0) {
        for (const productId of ids) {
          const pageMap = await fetchAllPages('/api/v1/variants', 'sku', pageSize, { productId })
          for (const [sku, storeId] of pageMap) {
            map.set(sku, storeId)
          }
        }
        return map
      }
    }
    throw err
  }
}

/**
 * Reads what already exists in the store (slug/sku -> store id) so references
 * can be validated and imports can skip/update existing rows.
 */
export async function loadStoreIndex(
  options?: LoadStoreIndexOptions | readonly ResourceKind[],
): Promise<Partial<Record<ResourceKind, Map<string, string>>>> {
  const opts: LoadStoreIndexOptions = Array.isArray(options)
    ? { kinds: options }
    : ((options ?? {}) as LoadStoreIndexOptions)
  const kinds = opts.kinds ?? RESOURCE_KINDS
  const pageSize = opts.pageSize ?? 200
  const result: Partial<Record<ResourceKind, Map<string, string>>> = {}

  for (const kind of kinds) {
    if (kind === 'variants') {
      result.variants = await loadVariants(pageSize, opts.productIds, result.products?.values())
    } else {
      const template = TEMPLATES[kind]
      result[kind] = await fetchAllPages(template.endpoint, template.idField, pageSize)
    }
  }

  return result
}

/**
 * Turns a store index (identifier -> storeId) into the `existing` map of sets
 * expected by `validateDocument()`: { [kind]: Set<identifier> }.
 */
export function storeIndexToExisting(
  index: Partial<Record<ResourceKind, Map<string, string>>>,
): Partial<Record<ResourceKind, Set<string>>> {
  const existing: Partial<Record<ResourceKind, Set<string>>> = {}
  for (const [kind, map] of Object.entries(index) as [ResourceKind, Map<string, string>][]) {
    if (map) {
      existing[kind] = new Set(map.keys())
    }
  }
  return existing
}
