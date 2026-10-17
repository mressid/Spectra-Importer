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

let accessToken: string | null = null

export async function login(email: string, password: string): Promise<void> {
  const data = await request<{ accessToken: string; user: { role: string } }>('POST', '/api/v1/auth/login', { email, password }, false)
  if (data.user.role !== 'ADMIN' && data.user.role !== 'STAFF') throw new StoreApiError(403, 'This account cannot manage the store')
  accessToken = data.accessToken
}

export const isLoggedIn = () => accessToken !== null

/** JSON call. Throws StoreApiError with the store's own message and per-field errors ("slug:already used"). */
export async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const envelope = (await response.json().catch(() => null)) as { data?: T; message?: string; errors?: string[] } | null
  if (!response.ok) throw new StoreApiError(response.status, envelope?.message || response.statusText, envelope?.errors ?? [])
  return envelope?.data as T
}

/** What the store answers to an upload (UploadedFileResponseDto, the fields we use). */
export interface UploadedFile {
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
  const form = new FormData()
  form.append('file', file, name)
  const response = await fetch(`${BASE}/api/v1/admin/uploads`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  })
  const envelope = (await response.json().catch(() => null)) as { data?: UploadedFile; message?: string; errors?: string[] } | null
  if (!response.ok || !envelope?.data) throw new StoreApiError(response.status, envelope?.message || response.statusText, envelope?.errors ?? [])
  return envelope.data
}
