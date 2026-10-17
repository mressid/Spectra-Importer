import type { ConflictMode, Operation, OperationResult, RunReport } from '../core/types'
import { request, StoreApiError } from './api'

export interface RunOptions {
  signal?: AbortSignal
  onProgress?: (results: OperationResult[]) => void
  /** Custom request runner for unit tests or mocking. */
  requestFn?: (method: string, path: string, body?: unknown) => Promise<unknown>
  /** Known identifier -> store UUID mappings (from storeIndex). */
  initialStoreIds?: Partial<Record<string, string>>
  conflictMode?: ConflictMode
}

const CONCURRENCY = 3
const MAX_NETWORK_RETRIES = 2
const PLACEHOLDER_REGEX = /\{([a-z0-9_-]+:[^}]+)\}/g

function resolvePlaceholders(text: string, storeIds: Map<string, string>): { text: string; missing: string[] } {
  const missing: string[] = []
  const replaced = text.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    const val = storeIds.get(key)
    if (val === undefined) {
      missing.push(key)
      return match
    }
    return val
  })
  return { text: replaced, missing }
}

function resolveValue(val: unknown, storeIds: Map<string, string>, missing: string[]): unknown {
  if (typeof val === 'string') {
    const res = resolvePlaceholders(val, storeIds)
    missing.push(...res.missing)
    return res.text
  }
  if (Array.isArray(val)) {
    return val.map((item) => resolveValue(item, storeIds, missing))
  }
  if (val && typeof val === 'object') {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val)) {
      obj[k] = resolveValue(v, storeIds, missing)
    }
    return obj
  }
  return val
}

/**
 * Executes a plan against the store API with ordering, placeholder substitution,
 * concurrency, and failure propagation.
 */
export async function runPlan(plan: Operation[], options: RunOptions = {}): Promise<RunReport> {
  const req = options.requestFn ?? request
  const conflictMode = options.conflictMode ?? 'skip'
  const startedAt = new Date().toISOString()

  const results = new Map<string, OperationResult>()
  const storeIds = new Map<string, string>()

  if (options.initialStoreIds) {
    for (const [k, v] of Object.entries(options.initialStoreIds)) {
      if (v) storeIds.set(k, v)
    }
  }

  // Initialize all operations as pending
  for (const op of plan) {
    results.set(op.key, { key: op.key, status: 'pending' })
  }

  const notify = () => {
    options.onProgress?.(Array.from(results.values()))
  }
  notify()

  const pendingKeys = new Set(plan.map((op) => op.key))
  const runningKeys = new Set<string>()

  async function executeOp(op: Operation): Promise<void> {
    if (options.signal?.aborted) {
      results.set(op.key, {
        key: op.key,
        status: 'blocked',
        error: { status: 0, message: 'Import was cancelled' },
      })
      pendingKeys.delete(op.key)
      return
    }

    // Check dependencies
    const failedDep = op.after.find((depKey) => {
      const dep = results.get(depKey)
      return dep && (dep.status === 'failed' || dep.status === 'blocked')
    })

    if (failedDep) {
      results.set(op.key, {
        key: op.key,
        status: 'blocked',
        error: { status: 0, message: `Blocked by failed dependency "${failedDep}"` },
      })
      pendingKeys.delete(op.key)
      notify()
      return
    }

    // Check if any dependency is still pending or running
    const incompleteDep = op.after.some((depKey) => {
      const dep = results.get(depKey)
      return !dep || dep.status === 'pending' || dep.status === 'running'
    })

    if (incompleteDep) {
      return // Wait for next tick
    }

    // Conflict check (skip if already exists)
    const isRootRecord = op.key === `${op.template}:${op.rowId}`
    const existingId = storeIds.get(`${op.template}:${op.rowId}`)
    if (conflictMode === 'skip' && existingId && isRootRecord) {
      results.set(op.key, {
        key: op.key,
        status: 'skipped',
        storeId: existingId,
      })
      pendingKeys.delete(op.key)
      notify()
      return
    }

    // Resolve placeholders in path and body
    const missing: string[] = []
    const resolvedPathRes = resolvePlaceholders(op.path, storeIds)
    missing.push(...resolvedPathRes.missing)

    const resolvedBody = op.body !== undefined ? resolveValue(op.body, storeIds, missing) : undefined

    if (missing.length > 0) {
      results.set(op.key, {
        key: op.key,
        status: 'blocked',
        error: { status: 0, message: `Missing required ID for placeholders: ${missing.join(', ')}` },
      })
      pendingKeys.delete(op.key)
      notify()
      return
    }

    // Mark as running
    runningKeys.add(op.key)
    pendingKeys.delete(op.key)
    results.set(op.key, { key: op.key, status: 'running' })
    notify()

    let attempt = 0
    while (true) {
      try {
        const data = await req<Record<string, unknown>>(op.method, resolvedPathRes.text, resolvedBody)
        const storeId = data && typeof data === 'object' && 'id' in data ? String(data.id) : undefined

        if (storeId) {
          storeIds.set(op.key, storeId)
          if (!op.key.includes(':') || op.key === `${op.template}:${op.rowId}`) {
            storeIds.set(`${op.template}:${op.rowId}`, storeId)
          }
        }

        results.set(op.key, {
          key: op.key,
          status: op.method === 'PUT' ? 'updated' : 'created',
          storeId,
        })
        break
      } catch (err: unknown) {
        if (err instanceof StoreApiError) {
          // HTTP error from store
          results.set(op.key, {
            key: op.key,
            status: 'failed',
            error: {
              status: err.status,
              message: err.message,
              fieldErrors: err.fieldErrors,
            },
          })
          break
        }

        // Network error retry
        attempt++
        if (attempt <= MAX_NETWORK_RETRIES && !options.signal?.aborted) {
          continue
        }

        results.set(op.key, {
          key: op.key,
          status: 'failed',
          error: {
            status: 0,
            message: err instanceof Error ? err.message : String(err),
          },
        })
        break
      }
    }

    runningKeys.delete(op.key)
    notify()
  }

  // Dispatcher loop with concurrency
  const opMap = new Map(plan.map((op) => [op.key, op]))
  while (pendingKeys.size > 0 || runningKeys.size > 0) {
    if (options.signal?.aborted) {
      for (const k of pendingKeys) {
        results.set(k, {
          key: k,
          status: 'blocked',
          error: { status: 0, message: 'Cancelled' },
        })
      }
      pendingKeys.clear()
      notify()
      break
    }

    const availableSlots = CONCURRENCY - runningKeys.size
    if (availableSlots <= 0 || pendingKeys.size === 0) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      continue
    }

    const candidates = Array.from(pendingKeys)
      .map((k) => opMap.get(k)!)
      .filter((op) => {
        return op.after.every((depKey) => {
          const dep = results.get(depKey)
          return dep && dep.status !== 'pending' && dep.status !== 'running'
        })
      })
      .slice(0, availableSlots)

    if (candidates.length === 0 && runningKeys.size === 0 && pendingKeys.size > 0) {
      // Deadlock or unresolvable cycle
      for (const k of pendingKeys) {
        results.set(k, {
          key: k,
          status: 'blocked',
          error: { status: 0, message: 'Unresolvable dependency cycle' },
        })
      }
      pendingKeys.clear()
      notify()
      break
    }

    if (candidates.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      continue
    }

    // Launch candidates
    for (const op of candidates) {
      executeOp(op)
    }

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  const finishedAt = new Date().toISOString()
  return {
    startedAt,
    finishedAt,
    results: plan.map((op) => results.get(op.key)!),
  }
}
