import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAndRefreshToken,
  getCurrentUserEmail,
  isLoggedIn,
  login,
  logout,
  refreshAuthToken,
  listWaitingMedia,
  setMediaBindings,
  uploadFile,
} from './api'

describe('api auth and token management', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    logout()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('login saves access token and user info', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
          user: { role: 'ADMIN', email: 'admin@store.local' },
        },
      }),
    })

    await login('admin@store.local', 'secret')
    expect(isLoggedIn()).toBe(true)
    expect(getCurrentUserEmail()).toBe('admin@store.local')
  })

  it('checkAndRefreshToken reports valid when token is active', async () => {
    globalThis.fetch = vi.fn()
      // First call: login
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            accessToken: 'token-123',
            refreshToken: 'refresh-123',
            expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
            user: { role: 'ADMIN', email: 'admin@store.local' },
          },
        }),
      })
      // Second call: /api/v1/users/me
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 1, email: 'admin@store.local' },
        }),
      })

    await login('admin@store.local', 'secret')
    const result = await checkAndRefreshToken()

    expect(result.valid).toBe(true)
    expect(result.refreshed).toBe(false)
    expect(result.userEmail).toBe('admin@store.local')
  })

  it('checkAndRefreshToken automatically refreshes when token is expired or receives 401', async () => {
    globalThis.fetch = vi.fn()
      // 1. login
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            accessToken: 'expired-access',
            refreshToken: 'valid-refresh',
            expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
            user: { role: 'ADMIN', email: 'admin@store.local' },
          },
        }),
      })
      // 2. refresh call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            accessToken: 'new-fresh-access',
            refreshToken: 'next-refresh',
            expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
            user: { role: 'ADMIN', email: 'admin@store.local' },
          },
        }),
      })

    await login('admin@store.local', 'secret')
    const result = await checkAndRefreshToken()

    expect(result.valid).toBe(true)
    expect(result.refreshed).toBe(true)
    expect(result.message).toContain('successfully refreshed')
  })

  it('refreshAuthToken throws if no refresh token exists', async () => {
    logout()
    await expect(refreshAuthToken()).rejects.toThrow('No refresh token available')
  })

  it('logout clears session', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          accessToken: 'token-abc',
          user: { role: 'ADMIN', email: 'admin@store.local' },
        },
      }),
    })

    await login('admin@store.local', 'secret')
    expect(isLoggedIn()).toBe(true)

    logout()
    expect(isLoggedIn()).toBe(false)
    expect(getCurrentUserEmail()).toBeNull()
  })

  it('uploadFile extracts uploaded file details including id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'file-12345',
          url: 'http://localhost:9000/store/test.jpg',
          mediaType: 'IMAGE',
          width: 800,
          height: 1000,
          sizeBytes: 45000,
          duplicate: false,
        },
      }),
    })

    const blob = new Blob(['test'], { type: 'image/jpeg' })
    const result = await uploadFile(blob, 'test.jpg')

    expect(result.id).toBe('file-12345')
    expect(result.url).toBe('http://localhost:9000/store/test.jpg')
    expect(result.width).toBe(800)
    expect(result.height).toBe(1000)
    expect(result.duplicate).toBe(false)
  })

  it('setMediaBindings sends bindings payload to backend', async () => {
    let capturedBody: string | undefined
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = init.body
      return {
        ok: true,
        // the shape the store really answers: { results: [...] } (BindMediaResponseDto)
        json: async () => ({
          data: {
            results: [
              { target: 'product', name: 'ring-a', role: 'THUMBNAIL', order: 1, status: 'APPLIED' },
              { target: 'product', name: 'ring-b', role: 'THUMBNAIL', order: 1, status: 'WAITING' },
            ],
          },
        }),
      }
    })

    const res = await setMediaBindings({
      uploadedFileId: 'file-123',
      bindings: [
        { target: 'product', name: 'ring-a', role: 'THUMBNAIL', order: 1 },
        { target: 'product', name: 'ring-b', role: 'THUMBNAIL', order: 1 },
      ],
    })

    expect(res).toHaveLength(2)
    expect(res[0].status).toBe('APPLIED')
    expect(res[1].status).toBe('WAITING')
    expect(JSON.parse(capturedBody!)).toEqual({
      uploadedFileId: 'file-123',
      bindings: [
        { target: 'product', name: 'ring-a', role: 'THUMBNAIL', order: 1 },
        { target: 'product', name: 'ring-b', role: 'THUMBNAIL', order: 1 },
      ],
    })
  })

  it('setMediaBindings also accepts a bare array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ target: 'product', name: 'a', role: 'GALLERY', order: 1, status: 'WAITING' }] }),
    })
    const res = await setMediaBindings({ uploadedFileId: 'f', bindings: [{ target: 'product', name: 'a', role: 'GALLERY' }] })
    expect(res.map((r) => r.status)).toEqual(['WAITING'])
  })

  it('listWaitingMedia reads the reservations', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ target: 'variant', name: 'SKU-1', role: 'GALLERY', order: 1, url: 'http://x/a.png' }] }),
    })
    globalThis.fetch = fetchMock
    const res = await listWaitingMedia()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/admin/media/bindings/waiting')
    expect(res[0].name).toBe('SKU-1')
  })
})
