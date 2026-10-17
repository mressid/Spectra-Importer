import { afterEach, describe, expect, it, vi } from 'vitest'
import { readImportFile } from '../adapters'
import { validateDocument, type ValidationContext } from '../validate/validate'
import { loadStoreIndex, storeIndexToExisting } from './storeIndex'

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('loadStoreIndex', () => {
  it('follows pagination when loading a resource across multiple pages', async () => {
    const requestedUrls: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const urlStr = String(input)
        requestedUrls.push(urlStr)
        const parsed = new URL(urlStr, 'http://localhost')
        const page = parsed.searchParams.get('page')

        if (page === '0') {
          return jsonResponse({
            content: [
              { id: 'uuid-t1', slug: 'tag-1', name: 'Tag 1' },
              { id: 'uuid-t2', slug: 'tag-2', name: 'Tag 2' },
            ],
            page: { number: 0, size: 2, totalPages: 2, totalElements: 3 },
          })
        }
        if (page === '1') {
          return jsonResponse({
            content: [{ id: 'uuid-t3', slug: 'tag-3', name: 'Tag 3' }],
            page: { number: 1, size: 2, totalPages: 2, totalElements: 3 },
          })
        }

        return jsonResponse({ content: [], page: { number: 2, size: 2, totalPages: 2, totalElements: 3 } })
      }),
    )

    const index = await loadStoreIndex({ kinds: ['tags'], pageSize: 2 })

    expect(requestedUrls).toEqual([
      '/api/v1/tags?page=0&size=2',
      '/api/v1/tags?page=1&size=2',
    ])

    expect(index.tags).toBeDefined()
    expect(index.tags?.size).toBe(3)
    expect(index.tags?.get('tag-1')).toBe('uuid-t1')
    expect(index.tags?.get('tag-2')).toBe('uuid-t2')
    expect(index.tags?.get('tag-3')).toBe('uuid-t3')
  })

  it('builds validateDocument existing context from the store index', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const urlStr = String(input)
        if (urlStr.includes('/brands')) {
          return jsonResponse({
            content: [{ id: 'brand-uuid-1', slug: 'acme' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }
        if (urlStr.includes('/tags')) {
          return jsonResponse({
            content: [{ id: 'tag-uuid-1', slug: 'sale' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }
        return jsonResponse({ content: [], page: { number: 0, size: 200, totalPages: 1, totalElements: 0 } })
      }),
    )

    const index = await loadStoreIndex(['brands', 'tags'])
    const existing = storeIndexToExisting(index)

    expect(existing.brands).toBeDefined()
    expect(existing.brands?.has('acme')).toBe(true)
    expect(existing.tags?.has('sale')).toBe(true)

    const csvValid = 'slug,name,thumbnailUrl,brand,tags,sku,price\nring,Ring,https://e.com/r.jpg,acme,sale,R1,20.0\n'
    const docValid = readImportFile('products.csv', csvValid, 'products')
    const context: ValidationContext = {
      pending: {},
      existing,
      images: new Set(),
    }

    const resultValid = validateDocument(docValid, context)
    expect(resultValid.ok).toBe(true)
    expect(resultValid.clean).toHaveLength(1)

    // A document referencing an unknown brand fails validation
    const csvInvalid = 'slug,name,thumbnailUrl,brand,sku,price\nring2,Ring 2,https://e.com/r.jpg,unknown-brand,R2,25.0\n'
    const docInvalid = readImportFile('products.csv', csvInvalid, 'products')
    const resultInvalid = validateDocument(docInvalid, context)
    expect(resultInvalid.ok).toBe(false)
    expect(resultInvalid.issues.some((issue) => issue.field === 'brand')).toBe(true)
  })

  it('loads all resources when no options are provided', async () => {
    const endpointsCalled: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const urlStr = String(input)
        const endpoint = urlStr.split('?')[0]
        endpointsCalled.push(endpoint)

        if (endpoint === '/api/v1/variants') {
          return jsonResponse({
            content: [{ id: 'var-uuid-1', sku: 'SKU-001' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }

        return jsonResponse({
          content: [{ id: 'id-1', slug: 'slug-1' }],
          page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
        })
      }),
    )

    const index = await loadStoreIndex()

    expect(endpointsCalled).toEqual([
      '/api/v1/tags',
      '/api/v1/brands',
      '/api/v1/categories',
      '/api/v1/collections',
      '/api/v1/products',
      '/api/v1/variants',
    ])

    expect(index.tags?.get('slug-1')).toBe('id-1')
    expect(index.brands?.get('slug-1')).toBe('id-1')
    expect(index.categories?.get('slug-1')).toBe('id-1')
    expect(index.collections?.get('slug-1')).toBe('id-1')
    expect(index.products?.get('slug-1')).toBe('id-1')
    expect(index.variants?.get('SKU-001')).toBe('var-uuid-1')
  })

  it('supports fetching variants per product when productIds is provided', async () => {
    const urls: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const urlStr = String(input)
        urls.push(urlStr)
        const parsed = new URL(urlStr, 'http://localhost')
        const productId = parsed.searchParams.get('productId')

        if (productId === 'prod-1') {
          return jsonResponse({
            content: [{ id: 'var-1', sku: 'SKU-A' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }
        if (productId === 'prod-2') {
          return jsonResponse({
            content: [{ id: 'var-2', sku: 'SKU-B' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }
        return jsonResponse({ content: [], page: { number: 0, size: 200, totalPages: 1, totalElements: 0 } })
      }),
    )

    const index = await loadStoreIndex({
      kinds: ['variants'],
      productIds: ['prod-1', 'prod-2'],
    })

    expect(urls).toEqual([
      '/api/v1/variants?page=0&size=200&productId=prod-1',
      '/api/v1/variants?page=0&size=200&productId=prod-2',
    ])
    expect(index.variants?.get('SKU-A')).toBe('var-1')
    expect(index.variants?.get('SKU-B')).toBe('var-2')
  })

  it('falls back to fetching variants per product when global variants endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const urlStr = String(input)
        const parsed = new URL(urlStr, 'http://localhost')

        if (urlStr.startsWith('/api/v1/products')) {
          return jsonResponse({
            content: [{ id: 'p-uuid-1', slug: 'gold-ring' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }

        if (urlStr.startsWith('/api/v1/variants')) {
          const productId = parsed.searchParams.get('productId')
          if (!productId) {
            // Global call fails
            return jsonResponse({ message: 'productId is required' }, 400)
          }
          return jsonResponse({
            content: [{ id: 'v-uuid-1', sku: 'RING-GOLD-S' }],
            page: { number: 0, size: 200, totalPages: 1, totalElements: 1 },
          })
        }

        return jsonResponse({ content: [], page: { number: 0, size: 200, totalPages: 1, totalElements: 0 } })
      }),
    )

    const index = await loadStoreIndex(['products', 'variants'])
    expect(index.products?.get('gold-ring')).toBe('p-uuid-1')
    expect(index.variants?.get('RING-GOLD-S')).toBe('v-uuid-1')
  })
})
