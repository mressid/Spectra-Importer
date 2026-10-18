/**
 * Turns what the tool just did into the record the store keeps: a data import (the plan and its report) or a media drop
 * (the uploads and the image placements). Pure; `recordSafely` is the only function that talks to the store.
 */
import type { ConflictMode, Operation, OperationResult, OperationStatus, RunReport } from '../core/types'
import type { BindReport } from '../upload/bindAssets'
import type { UploadOutcome } from '../upload/imageLibrary'
import type { ParsedMediaAsset } from '../upload/mediaFolderParser'
import { recordRun } from './api'
import type { ItemStatus, RecordRun, RecordRunItem, RunSummary } from './types'

const OPERATION_STATUS: Record<OperationStatus, ItemStatus> = {
  created: 'CREATED',
  updated: 'UPDATED',
  skipped: 'SKIPPED',
  failed: 'FAILED',
  blocked: 'BLOCKED',
  // never reached: the user stopped the run
  pending: 'CANCELLED',
  running: 'CANCELLED',
}

const MAX_MESSAGE = 1000
const MAX_FIELD_ERRORS = 50
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** One item per operation of the plan, in plan order; an operation without a result did not run. */
export function operationItems(plan: Operation[], results: OperationResult[]): RecordRunItem[] {
  const byKey = new Map(results.map((r) => [r.key, r]))
  return plan.map((op) => {
    const result = byKey.get(op.key)
    const item: RecordRunItem = { kind: 'OPERATION', key: op.key, label: op.label, status: OPERATION_STATUS[result?.status ?? 'pending'] }
    if (result?.storeId) item.storeId = result.storeId
    if (result?.error) {
      item.httpStatus = result.error.status
      item.message = clip(result.error.message, MAX_MESSAGE)
      if (result.error.fieldErrors?.length) item.fieldErrors = result.error.fieldErrors.slice(0, MAX_FIELD_ERRORS).map((e) => clip(e, 500))
    }
    return item
  })
}

/** "Data import: brands 1, products 2" */
export function dataRunLabel(plan: Operation[]): string {
  const perTemplate = new Map<string, number>()
  for (const op of plan) perTemplate.set(op.template, (perTemplate.get(op.template) ?? 0) + 1)
  const parts = [...perTemplate].sort(([a], [b]) => a.localeCompare(b)).map(([template, n]) => `${template} ${n}`)
  return `Data import: ${parts.join(', ')}`
}

export function dataRun(plan: Operation[], report: RunReport, options: { conflictMode: ConflictMode; cancelled: boolean }): RecordRun {
  return {
    source: 'IMPORTER',
    label: dataRunLabel(plan),
    conflictMode: options.conflictMode === 'update' ? 'UPDATE' : 'SKIP',
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    cancelled: options.cancelled,
    items: operationItems(plan, report.results),
  }
}

/**
 * A media drop: one UPLOAD per file (new, already in the store, or refused with the store's message), then one BINDING per
 * image placement (set now, or reserved until the place exists) and one per file the store refused to bind.
 * `assets` and `bind` are what the folder parser and `bindAssets` returned; both may be missing (upload only).
 */
export function mediaRun(
  outcomes: UploadOutcome[],
  assets: ParsedMediaAsset[],
  bind: BindReport | null,
  times: { startedAt: string; finishedAt: string },
  label?: string,
): RecordRun {
  const items: RecordRunItem[] = outcomes.map((outcome) =>
    outcome.ok
      ? { kind: 'UPLOAD', key: outcome.fileName, status: outcome.image.duplicate ? 'DUPLICATE' : 'UPLOADED', ...(outcome.image.id !== undefined ? { storeId: String(outcome.image.id) } : {}) }
      : { kind: 'UPLOAD', key: outcome.fileName, status: 'FAILED', message: clip(outcome.error, MAX_MESSAGE) },
  )
  if (bind) items.push(...bindingItems(assets, bind))
  return {
    source: 'IMPORTER',
    label: label ?? mediaRunLabel(outcomes.length, assets.length > 0),
    startedAt: times.startedAt,
    finishedAt: times.finishedAt,
    items,
  }
}

/** Bindings alone, for "bind again" after a place was created. */
export function bindingRun(assets: ParsedMediaAsset[], bind: BindReport, times: { startedAt: string; finishedAt: string }): RecordRun {
  return { source: 'IMPORTER', label: `Media bindings: ${assets.length} file${assets.length === 1 ? '' : 's'}`, startedAt: times.startedAt, finishedAt: times.finishedAt, items: bindingItems(assets, bind) }
}

export function mediaRunLabel(files: number, bound: boolean): string {
  return `Media drop: ${files} file${files === 1 ? '' : 's'}${bound ? ' with bindings' : ''}`
}

function bindingItems(assets: ParsedMediaAsset[], bind: BindReport): RecordRunItem[] {
  const items: RecordRunItem[] = []
  for (const asset of assets) {
    for (const status of bind.statuses.get(asset.relativePath) ?? []) {
      items.push({
        kind: 'BINDING',
        key: `${status.target}/${status.name}/${status.role.toLowerCase()}/${status.order}`,
        label: asset.relativePath,
        status: status.status,
      })
    }
  }
  for (const failure of bind.failed) {
    items.push({ kind: 'BINDING', key: failure.fileName, label: failure.fileName, status: 'FAILED', message: clip(failure.message, MAX_MESSAGE) })
  }
  return items
}

/**
 * Sends the record; a store that is down, an expired login or an old store without the history must never break the import
 * that just succeeded, so the failure is returned, not thrown. Nothing to record (an empty list) is not an error either.
 */
export async function recordSafely(run: RecordRun, send: typeof recordRun = recordRun): Promise<{ ok: true; run: RunSummary } | { ok: false; error: string } | null> {
  if (run.items.length === 0) return null
  try {
    return { ok: true, run: await send(run) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
