import { describe, expect, it, vi } from 'vitest'
import type { Operation, OperationResult } from '../core/types'
import type { BindReport } from '../upload/bindAssets'
import type { UploadOutcome } from '../upload/imageLibrary'
import type { ParsedMediaAsset } from '../upload/mediaFolderParser'
import { bindingRun, dataRun, dataRunLabel, mediaRun, operationItems, recordSafely } from './record'

const op = (template: Operation['template'], rowId: string, suffix = ''): Operation => ({
  key: `${template}:${rowId}${suffix}`,
  template,
  rowId,
  label: `Create ${template} ${rowId}`,
  method: 'POST',
  path: `/api/v1/${template}`,
  after: [],
})

describe('operationItems', () => {
  const plan = [op('brands', 'acme'), op('products', 'ring'), op('products', 'ring', ':images'), op('tags', 'sale')]
  const results: OperationResult[] = [
    { key: 'brands:acme', status: 'created', storeId: 'b-1' },
    { key: 'products:ring', status: 'failed', error: { status: 400, message: 'Validation failed', fieldErrors: ['slug:already used'] } },
    { key: 'products:ring:images', status: 'blocked' },
  ]

  it('keeps the plan order, the store ids and the store messages', () => {
    const items = operationItems(plan, results)
    expect(items.map((i) => [i.key, i.status])).toEqual([
      ['brands:acme', 'CREATED'],
      ['products:ring', 'FAILED'],
      ['products:ring:images', 'BLOCKED'],
      ['tags:sale', 'CANCELLED'],
    ])
    expect(items[0]).toMatchObject({ kind: 'OPERATION', label: 'Create brands acme', storeId: 'b-1' })
    expect(items[1]).toMatchObject({ httpStatus: 400, message: 'Validation failed', fieldErrors: ['slug:already used'] })
  })

  it('records an operation that never ran (a stopped run) as cancelled', () => {
    expect(operationItems(plan, [])[0].status).toBe('CANCELLED')
    expect(operationItems(plan, [{ key: 'brands:acme', status: 'running' }])[0].status).toBe('CANCELLED')
  })

  it('cuts a very long message and the number of field errors to what the store accepts', () => {
    const long = 'x'.repeat(5000)
    const item = operationItems([op('tags', 'a')], [{ key: 'tags:a', status: 'failed', error: { status: 500, message: long, fieldErrors: Array.from({ length: 80 }, () => long) } }])[0]
    expect(item.message?.length).toBe(1000)
    expect(item.fieldErrors).toHaveLength(50)
    expect(item.fieldErrors?.[0].length).toBe(500)
  })
})

describe('dataRun', () => {
  const plan = [op('products', 'a'), op('brands', 'b'), op('products', 'c')]

  it('labels the run by what it contains', () => {
    expect(dataRunLabel(plan)).toBe('Data import: brands 1, products 2')
  })

  it('carries the times, the conflict mode and whether the user stopped it', () => {
    const run = dataRun(plan, { startedAt: '2026-10-18T10:00:00Z', finishedAt: '2026-10-18T10:00:02Z', results: [] }, { conflictMode: 'update', cancelled: true })
    expect(run).toMatchObject({ source: 'IMPORTER', conflictMode: 'UPDATE', cancelled: true, startedAt: '2026-10-18T10:00:00Z', finishedAt: '2026-10-18T10:00:02Z' })
    expect(run.items).toHaveLength(3)
    expect(dataRun(plan, { startedAt: 'a', finishedAt: 'b', results: [] }, { conflictMode: 'skip', cancelled: false }).conflictMode).toBe('SKIP')
  })
})

describe('mediaRun', () => {
  const image = (fileName: string, duplicate: boolean, id: string | number | undefined = 'u-1') => ({
    fileName, url: 'http://x/' + fileName, mediaType: 'IMAGE' as const, width: 10, height: 10, sizeBytes: 5, duplicate, uploadedAt: 't', id,
  })
  const outcomes: UploadOutcome[] = [
    { fileName: 'product/ring/thumbnail/cover.png', ok: true, replaced: false, image: image('product/ring/thumbnail/cover.png', false, 'u-1') },
    { fileName: 'product/ring/gallery/01.png', ok: true, replaced: false, image: image('product/ring/gallery/01.png', true, undefined) },
    { fileName: 'product/ring/gallery/02.png', ok: false, error: 'File too large' },
  ]
  const asset = (relativePath: string): ParsedMediaAsset => ({ file: new File([], 'f'), relativePath, fileName: relativePath, extension: 'png', mediaType: 'IMAGE', bindings: [] })
  const bind: BindReport = {
    statuses: new Map([
      ['product/ring/thumbnail/cover.png', [{ uploadedFileId: 'u-1', target: 'product', name: 'ring', role: 'THUMBNAIL', order: 1, status: 'WAITING' as const }]],
      ['product/ring/gallery/01.png', [
        { uploadedFileId: 'u-2', target: 'product', name: 'ring', role: 'GALLERY', order: 1, status: 'APPLIED' as const },
        { uploadedFileId: 'u-2', target: 'variant', name: 'SKU-1', role: 'GALLERY', order: 2, status: 'WAITING' as const },
      ]],
    ]),
    applied: 1, waiting: 2, failed: [{ fileName: 'product/ring/gallery/03.png', message: 'No such place kind' }],
  }
  const times = { startedAt: '2026-10-18T10:00:00Z', finishedAt: '2026-10-18T10:00:05Z' }
  const assets = ['product/ring/thumbnail/cover.png', 'product/ring/gallery/01.png'].map(asset)

  it('records each file as new, already there or refused, then each placement', () => {
    const run = mediaRun(outcomes, assets, bind, times)
    expect(run.label).toBe('Media drop: 3 files with bindings')
    expect(run.items.map((i) => [i.kind, i.key, i.status])).toEqual([
      ['UPLOAD', 'product/ring/thumbnail/cover.png', 'UPLOADED'],
      ['UPLOAD', 'product/ring/gallery/01.png', 'DUPLICATE'],
      ['UPLOAD', 'product/ring/gallery/02.png', 'FAILED'],
      ['BINDING', 'product/ring/thumbnail/1', 'WAITING'],
      ['BINDING', 'product/ring/gallery/1', 'APPLIED'],
      ['BINDING', 'variant/SKU-1/gallery/2', 'WAITING'],
      ['BINDING', 'product/ring/gallery/03.png', 'FAILED'],
    ])
    expect(run.items[0].storeId).toBe('u-1')
    expect(run.items[2].message).toBe('File too large')
    expect(run.items[4].label).toBe('product/ring/gallery/01.png')
    expect(run.items[6].message).toBe('No such place kind')
  })

  it('records an upload without bindings, and bindings alone', () => {
    expect(mediaRun(outcomes.slice(0, 1), [], null, times).label).toBe('Media drop: 1 file')
    const run = bindingRun(assets, bind, times)
    expect(run.label).toBe('Media bindings: 2 files')
    expect(run.items.every((i) => i.kind === 'BINDING')).toBe(true)
  })
})

describe('recordSafely', () => {
  const run = { source: 'IMPORTER' as const, startedAt: 'a', finishedAt: 'b', items: [{ kind: 'OPERATION' as const, key: 'k', status: 'CREATED' as const }] }

  it('returns the stored run', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'r-1' })
    expect(await recordSafely(run, send)).toEqual({ ok: true, run: { id: 'r-1' } })
  })

  it('returns the failure instead of throwing, so a finished import is never undone by a history problem', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Not Found'))
    expect(await recordSafely(run, send)).toEqual({ ok: false, error: 'Not Found' })
  })

  it('sends nothing when there is nothing to record', async () => {
    const send = vi.fn()
    expect(await recordSafely({ ...run, items: [] }, send)).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})
