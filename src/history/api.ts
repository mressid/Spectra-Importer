import { request } from '../upload/api'
import type { RecordRun, RunDetail, RunPage, RunSource, RunStatus, RunSummary } from './types'

const BASE = '/api/v1/admin/import-runs'

/** POST: keep a finished run in the store's history. */
export const recordRun = (run: RecordRun): Promise<RunSummary> => request<RunSummary>('POST', BASE, run)

export interface RunFilter {
  source?: RunSource
  status?: RunStatus
  page?: number
  size?: number
}

/** GET: newest first. */
export function listRuns(filter: RunFilter = {}): Promise<RunPage> {
  const params = new URLSearchParams()
  if (filter.source) params.set('source', filter.source)
  if (filter.status) params.set('status', filter.status)
  params.set('page', String(filter.page ?? 0))
  params.set('size', String(filter.size ?? 20))
  return request<RunPage>('GET', `${BASE}?${params.toString()}`)
}

export const getRun = (id: string): Promise<RunDetail> => request<RunDetail>('GET', `${BASE}/${encodeURIComponent(id)}`)
