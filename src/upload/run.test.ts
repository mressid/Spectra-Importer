import { describe, expect, it, vi } from 'vitest'
import type { Operation } from '../core/types'
import { StoreApiError } from './api'
import { runPlan } from './run'

describe('runPlan', () => {
  it('covers successful execution and fills placeholders for downstream operations', async () => {
    const plan: Operation[] = [
      {
        key: 'brands:acme',
        template: 'brands',
        rowId: 'acme',
        label: 'Create brand acme',
        method: 'POST',
        path: '/api/v1/brands',
        body: { slug: 'acme', name: 'Acme' },
        after: [],
      },
      {
        key: 'products:ring',
        template: 'products',
        rowId: 'ring',
        label: 'Create product ring',
        method: 'POST',
        path: '/api/v1/products',
        body: { slug: 'ring', brandId: '{brands:acme}' },
        after: ['brands:acme'],
      },
    ]

    const calls: { method: string; path: string; body: unknown }[] = []
    const fakeRequest = vi.fn(async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body })
      if (path === '/api/v1/brands') return { id: 'uuid-b1' }
      if (path === '/api/v1/products') return { id: 'uuid-p1' }
      return {}
    })

    const report = await runPlan(plan, { requestFn: fakeRequest })

    expect(report.results.map((r) => [r.key, r.status])).toEqual([
      ['brands:acme', 'created'],
      ['products:ring', 'created'],
    ])

    expect(calls[1].body).toEqual({ slug: 'ring', brandId: 'uuid-b1' })
  })

  it('covers a 400 with field errors', async () => {
    const plan: Operation[] = [
      {
        key: 'tags:sale',
        template: 'tags',
        rowId: 'sale',
        label: 'Create tag sale',
        method: 'POST',
        path: '/api/v1/tags',
        body: { slug: 'sale' },
        after: [],
      },
    ]

    const fakeRequest = vi.fn(async () => {
      throw new StoreApiError(400, 'Validation failed', ['name:is required'])
    })

    const report = await runPlan(plan, { requestFn: fakeRequest })
    const res = report.results[0]
    expect(res.status).toBe('failed')
    expect(res.error?.status).toBe(400)
    expect(res.error?.message).toBe('Validation failed')
    expect(res.error?.fieldErrors).toEqual(['name:is required'])
  })

  it('blocks children when a parent operation fails', async () => {
    const plan: Operation[] = [
      {
        key: 'products:ring',
        template: 'products',
        rowId: 'ring',
        label: 'Create product ring',
        method: 'POST',
        path: '/api/v1/products',
        body: {},
        after: [],
      },
      {
        key: 'products:ring:images:0',
        template: 'products',
        rowId: 'ring',
        label: 'Add image',
        method: 'POST',
        path: '/api/v1/media',
        body: { productId: '{products:ring}' },
        after: ['products:ring'],
      },
    ]

    const fakeRequest = vi.fn(async (_method: string, path: string) => {
      if (path === '/api/v1/products') throw new StoreApiError(500, 'Server crashed')
      return {}
    })

    const report = await runPlan(plan, { requestFn: fakeRequest })
    expect(report.results.find((r) => r.key === 'products:ring')?.status).toBe('failed')
    expect(report.results.find((r) => r.key === 'products:ring:images:0')?.status).toBe('blocked')
  })

  it('skips existing items when conflictMode is skip and known from store index', async () => {
    const plan: Operation[] = [
      {
        key: 'brands:acme',
        template: 'brands',
        rowId: 'acme',
        label: 'Create brand acme',
        method: 'POST',
        path: '/api/v1/brands',
        body: { slug: 'acme' },
        after: [],
      },
    ]

    const fakeRequest = vi.fn()
    const report = await runPlan(plan, {
      requestFn: fakeRequest,
      conflictMode: 'skip',
      initialStoreIds: { 'brands:acme': 'uuid-existing-acme' },
    })

    expect(report.results[0].status).toBe('skipped')
    expect(report.results[0].storeId).toBe('uuid-existing-acme')
    expect(fakeRequest).not.toHaveBeenCalled()
  })
})
