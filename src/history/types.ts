/** Contracts of the store's import history (`/api/v1/admin/import-runs`, feature `importrun`). Statuses are upper case, as the store sends them. */
export type RunSource = 'IMPORTER' | 'CLI' | 'API'
export type RunStatus = 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
export type ItemKind = 'OPERATION' | 'UPLOAD' | 'BINDING'
export type ItemStatus = 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED' | 'BLOCKED' | 'CANCELLED' | 'UPLOADED' | 'DUPLICATE' | 'APPLIED' | 'WAITING'

/** What the tool sends once, when a run ends. The store works out the totals and the status itself. */
export interface RecordRunItem {
  kind: ItemKind
  key: string
  label?: string
  status: ItemStatus
  storeId?: string
  httpStatus?: number
  message?: string
  fieldErrors?: string[]
}

export interface RecordRun {
  source: RunSource
  label?: string
  conflictMode?: 'SKIP' | 'UPDATE'
  startedAt: string
  finishedAt: string
  cancelled?: boolean
  items: RecordRunItem[]
}

export interface RunCounts {
  items: number
  created: number
  updated: number
  skipped: number
  failed: number
  blocked: number
  uploaded: number
  bound: number
}

export interface RunSummary {
  id: string
  source: RunSource
  label: string | null
  conflictMode: 'SKIP' | 'UPDATE' | null
  status: RunStatus
  actorEmail: string | null
  startedAt: string
  finishedAt: string
  durationMs: number
  counts: RunCounts
}

export interface RunItem {
  position: number
  kind: ItemKind
  key: string
  label: string | null
  status: ItemStatus
  storeId: string | null
  httpStatus: number | null
  message: string | null
  fieldErrors: string[]
}

export interface RunDetail {
  run: RunSummary
  items: RunItem[]
}

export interface RunPage {
  content: RunSummary[]
  page: { size: number; number: number; totalElements: number; totalPages: number }
}
