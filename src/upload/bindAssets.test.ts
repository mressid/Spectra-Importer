import { describe, expect, it } from 'vitest'
import type { LibraryImage } from '../core/types'
import { StoreApiError, type MediaBindingStatusDto } from './api'
import { bindAssets } from './bindAssets'
import type { ParsedMediaAsset } from './mediaFolderParser'

const asset = (relativePath: string, names: string[]): ParsedMediaAsset =>
  ({
    relativePath,
    fileName: relativePath.split('/').pop(),
    bindings: names.map((name) => ({ target: 'product', name, role: 'GALLERY', order: 1 })),
  }) as unknown as ParsedMediaAsset

const library = (entries: Record<string, string | undefined>) =>
  new Map(Object.entries(entries).map(([key, id]) => [key, { id } as unknown as LibraryImage]))

const reply = (status: 'APPLIED' | 'WAITING') => (payload: { bindings: { target: string; name: string }[] }) =>
  Promise.resolve(payload.bindings.map((b) => ({ ...b, role: 'GALLERY', order: 1, status }) as unknown as MediaBindingStatusDto))

describe('bindAssets', () => {
  it('counts what was applied now and what waits for its place', async () => {
    const bind = (payload: { uploadedFileId: string | number; bindings: { target: string; name: string }[] }) =>
      reply(payload.bindings[0]?.name.startsWith('new-') ? 'WAITING' : 'APPLIED')(payload)
    const report = await bindAssets(
      [asset('a/one.png', ['ring-a']), asset('a/two.png', ['new-ring', 'new-chain'])],
      library({ 'a/one.png': 'f1', 'a/two.png': 'f2' }),
      bind as never,
    )
    expect(report).toMatchObject({ applied: 1, waiting: 2, failed: [] })
    expect(report.statuses.get('f2')).toHaveLength(2)
    expect(report.statuses.get('a/two.png')).toHaveLength(2)
  })

  it('reports the store message of a refused file and carries on with the others', async () => {
    const bind = async (payload: { uploadedFileId: string | number; bindings: { target: string; name: string }[] }) => {
      if (payload.uploadedFileId === 'f1') throw new StoreApiError(400, 'A variant has no thumbnail', ['role:invalid'])
      return reply('APPLIED')(payload)
    }
    const report = await bindAssets([asset('a/bad.png', ['x']), asset('a/good.png', ['y'])], library({ 'a/bad.png': 'f1', 'a/good.png': 'f2' }), bind as never)
    expect(report.failed).toEqual([{ fileName: 'a/bad.png', message: 'A variant has no thumbnail: role:invalid' }])
    expect(report.applied).toBe(1)
  })

  it('leaves out files that were not uploaded (their upload error is reported elsewhere)', async () => {
    let calls = 0
    const bind = async (payload: { uploadedFileId: string | number; bindings: { target: string; name: string }[] }) => {
      calls++
      return reply('APPLIED')(payload)
    }
    const report = await bindAssets([asset('a/x.png', ['x']), asset('a/y.png', ['y'])], library({ 'a/y.png': undefined }), bind as never)
    expect(calls).toBe(0)
    expect(report).toMatchObject({ applied: 0, waiting: 0, failed: [] })
  })
})
