/**
 * Thin client for the store API (the Spring Boot app). Same envelope as the store admin:
 * every answer is { success, statusCode, data, message, errors[] }.
 * In dev, /api is proxied to the store (vite.config.ts); in production serve this tool on the same
 * origin as the API or set VITE_STORE_API_URL.
 */
const BASE = import.meta.env.VITE_STORE_API_URL ?? ''

export class StoreApiError extends Error {
  readonly status: number
  readonly fieldErrors: string[]
  constructor(status: number, message: string, fieldErrors: string[] = []) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export interface AuthSession {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
  userEmail: string | null
}

const STORAGE_KEY = 'store_importer_auth'

let session: AuthSession = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  userEmail: null,
}

function loadInitialSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AuthSession>
        if (parsed.accessToken) {
          session = {
            accessToken: parsed.accessToken ?? null,
            refreshToken: parsed.refreshToken ?? null,
            expiresAt: parsed.expiresAt ?? null,
            userEmail: parsed.userEmail ?? null,
          }
        }
      }
    }
  } catch {
    // Ignore storage issues
  }
}

loadInitialSession()

function persistSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (session.accessToken) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch {
    // Ignore storage issues
  }
}

export interface LoginResponseDto {
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  user: {
    role: string
    email?: string
  }
}

export async function login(email: string, password: string): Promise<void> {
  const data = await request<LoginResponseDto>(
    'POST',
    '/api/v1/auth/login',
    { email, password },
    false,
  )
  if (data.user.role !== 'ADMIN' && data.user.role !== 'STAFF') {
    throw new StoreApiError(403, 'This account cannot manage the store')
  }

  session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null,
    expiresAt: data.expiresAt ?? null,
    userEmail: data.user.email ?? email,
  }
  persistSession()
}

export function logout(): void {
  session = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    userEmail: null,
  }
  persistSession()
}

export const isLoggedIn = () => session.accessToken !== null

export const getCurrentUserEmail = () => session.userEmail

export const getAccessToken = () => session.accessToken

export async function refreshAuthToken(): Promise<{ accessToken: string; userEmail: string | null }> {
  if (!session.refreshToken) {
    throw new StoreApiError(401, 'No refresh token available. Please log in again.')
  }

  const data = await request<LoginResponseDto>(
    'POST',
    '/api/v1/auth/refresh',
    { refreshToken: session.refreshToken },
    false,
  )

  session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? session.refreshToken,
    expiresAt: data.expiresAt ?? null,
    userEmail: data.user?.email ?? session.userEmail,
  }
  persistSession()
  return { accessToken: data.accessToken, userEmail: session.userEmail }
}

export interface TokenCheckResult {
  valid: boolean
  refreshed: boolean
  message: string
  userEmail: string | null
  expiresAt: string | null
}

/**
 * Checks if the current auth token is valid. If expired or expiring soon, automatically attempts
 * to refresh it using the stored refresh token.
 */
export async function checkAndRefreshToken(): Promise<TokenCheckResult> {
  if (!session.accessToken) {
    return {
      valid: false,
      refreshed: false,
      message: 'No active session. Please connect store.',
      userEmail: null,
      expiresAt: null,
    }
  }

  let needsRefresh = false

  // Check expiration if expiresAt is known (refresh if expired or expires within 60s)
  if (session.expiresAt) {
    const expiresMs = new Date(session.expiresAt).getTime()
    if (!Number.isNaN(expiresMs) && Date.now() >= expiresMs - 60000) {
      needsRefresh = true
    }
  }

  // If not time-expired, probe the server
  if (!needsRefresh) {
    try {
      await request<{ id?: number; email?: string }>('GET', '/api/v1/users/me')
      return {
        valid: true,
        refreshed: false,
        message: 'Token is valid and active',
        userEmail: session.userEmail,
        expiresAt: session.expiresAt,
      }
    } catch (err) {
      if (err instanceof StoreApiError && err.status === 401) {
        needsRefresh = true
      } else {
        // Non-auth error (e.g. temporary 5xx or offline)
        return {
          valid: true,
          refreshed: false,
          message: err instanceof Error ? err.message : 'Server check returned warning',
          userEmail: session.userEmail,
          expiresAt: session.expiresAt,
        }
      }
    }
  }

  // Attempt refresh
  if (needsRefresh) {
    if (!session.refreshToken) {
      logout()
      return {
        valid: false,
        refreshed: false,
        message: 'Token expired and no refresh token available. Please reconnect.',
        userEmail: null,
        expiresAt: null,
      }
    }

    try {
      await refreshAuthToken()
      return {
        valid: true,
        refreshed: true,
        message: 'Token expired and was successfully refreshed',
        userEmail: session.userEmail,
        expiresAt: session.expiresAt,
      }
    } catch (refreshErr) {
      logout()
      return {
        valid: false,
        refreshed: false,
        message:
          refreshErr instanceof Error
            ? `Refresh failed: ${refreshErr.message}`
            : 'Refresh failed. Please log in again.',
        userEmail: null,
        expiresAt: null,
      }
    }
  }

  return {
    valid: true,
    refreshed: false,
    message: 'Token is valid',
    userEmail: session.userEmail,
    expiresAt: session.expiresAt,
  }
}

/** JSON call. Throws StoreApiError with the store's own message and per-field errors ("slug:already used"). */
export async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const token = session.accessToken
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const envelope = (await response.json().catch(() => null)) as { data?: T; message?: string; errors?: string[] } | null
  if (!response.ok) throw new StoreApiError(response.status, envelope?.message || response.statusText, envelope?.errors ?? [])
  return envelope?.data as T
}

/** What the store answers to an upload (UploadedFileResponseDto, the fields we use). */
export interface UploadedFile {
  id?: string | number
  url: string
  mediaType: 'IMAGE' | 'VIDEO'
  width: number | null
  height: number | null
  sizeBytes: number
  /** The exact same file was uploaded before: url is the existing one, nothing new was stored. */
  duplicate: boolean
}

/** POST /api/v1/admin/uploads (multipart `file`). Returns the public url to put in the records. */
export async function uploadFile(file: Blob, name: string): Promise<UploadedFile> {
  const token = session.accessToken
  const form = new FormData()
  form.append('file', file, name)
  const response = await fetch(`${BASE}/api/v1/admin/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const envelope = (await response.json().catch(() => null)) as {
    data?: UploadedFile & { id?: string | number; uploadedFileId?: string | number }
    message?: string
    errors?: string[]
  } | null
  if (!response.ok || !envelope?.data) {
    throw new StoreApiError(response.status, envelope?.message || response.statusText, envelope?.errors ?? [])
  }
  const data = envelope.data
  return {
    id: data.id ?? data.uploadedFileId,
    url: data.url,
    mediaType: data.mediaType,
    width: data.width,
    height: data.height,
    sizeBytes: data.sizeBytes,
    duplicate: data.duplicate,
  }
}

export interface MediaBindingDto {
  target: string
  name: string
  role: string
  order?: number
  altText?: string
}

export interface SetMediaBindingsRequest {
  uploadedFileId: string | number
  bindings: MediaBindingDto[]
}

export interface MediaBindingStatusDto {
  id?: number | string
  uploadedFileId: string | number
  target: string
  name: string
  role: string
  order: number
  altText?: string
  status: 'APPLIED' | 'WAITING'
}

/**
 * PUT /api/v1/admin/media/bindings
 * Binds an uploaded file to any number of named target places (existing or pending).
 * The store answers `{ results: [...] }`; a bare array is accepted too.
 */
export async function setMediaBindings(payload: SetMediaBindingsRequest): Promise<MediaBindingStatusDto[]> {
  const data = await request<MediaBindingStatusDto[] | { results?: MediaBindingStatusDto[] }>('PUT', '/api/v1/admin/media/bindings', payload)
  return Array.isArray(data) ? data : (data?.results ?? [])
}

/** A file reserved for a place that does not exist yet (WaitingMediaDto of the store). */
export interface WaitingMedia {
  /** product, variant, category or brand */
  target: string
  /** The slug or SKU it waits for. */
  name: string
  role: 'THUMBNAIL' | 'GALLERY'
  order: number
  altText: string | null
  uploadedFileId: string
  url: string
  mediaType: 'IMAGE' | 'VIDEO'
  reservedAt: string
}

/** GET /api/v1/admin/media/bindings/waiting: every reservation still waiting for its product, variant, category or brand. */
export async function listWaitingMedia(): Promise<WaitingMedia[]> {
  return (await request<WaitingMedia[]>('GET', '/api/v1/admin/media/bindings/waiting')) ?? []
}
