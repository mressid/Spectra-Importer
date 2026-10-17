import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAndRefreshToken,
  getCurrentUserEmail,
  isLoggedIn,
  login,
  logout,
  refreshAuthToken,
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
})
