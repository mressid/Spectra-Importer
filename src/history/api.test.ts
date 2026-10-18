import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRun, listRuns, recordRun } from './api'

const answer = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('history api', () => {
  it('lists newest first with the filters and the page in the query', async () => {
    const fetchMock = answer({ data: { content: [], page: { size: 15, number: 2, totalElements: 0, totalPages: 0 } } })
    vi.stubGlobal('fetch', fetchMock)
    await listRuns({ source: 'CLI', status: 'FAILED', page: 2, size: 15 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/import-runs?source=CLI&status=FAILED&page=2&size=15')
    await listRuns()
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/admin/import-runs?page=0&size=20')
  })

  it('posts a finished run and returns the stored summary', async () => {
    const fetchMock = answer({ data: { id: 'r-1', status: 'PARTIAL' } }, 201)
    vi.stubGlobal('fetch', fetchMock)
    const run = { source: 'IMPORTER' as const, startedAt: 'a', finishedAt: 'b', items: [{ kind: 'OPERATION' as const, key: 'k', status: 'CREATED' as const }] }
    expect(await recordRun(run)).toMatchObject({ id: 'r-1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/admin/import-runs')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(run)
  })

  it('reads one run by id and escapes the id', async () => {
    const fetchMock = answer({ data: { run: { id: 'a/b' }, items: [] } })
    vi.stubGlobal('fetch', fetchMock)
    await getRun('a/b')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/import-runs/a%2Fb')
  })

  it("throws the store's own message", async () => {
    vi.stubGlobal('fetch', answer({ message: 'Import run not found', errors: [] }, 404))
    await expect(getRun('x')).rejects.toThrow('Import run not found')
  })
})
