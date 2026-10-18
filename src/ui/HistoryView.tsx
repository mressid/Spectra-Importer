import { Fragment, useEffect, useState } from 'react'
import { getRun, listRuns } from '../history/api'
import { badgeClass, describeCounts, formatDuration, isProblem } from '../history/format'
import type { RunDetail, RunPage, RunSource, RunStatus } from '../history/types'
import { IconDownload, IconRefresh } from './Icons'
import { useToast } from './toastContext'

const PAGE_SIZE = 15
const small = { fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' } as const

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function downloadJson(detail: RunDetail) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `import-run-${detail.run.startedAt.slice(0, 19).replace(/:/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function RunDetailPanel({ id }: { id: string }) {
  const toast = useToast()
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRun(id)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e: Error) => toast.error(`The run could not be loaded: ${e.message}`))
    return () => {
      cancelled = true
    }
  }, [id, toast])

  if (!detail) return <p style={{ ...small, margin: 0 }}>Loading…</p>

  const items = onlyProblems ? detail.items.filter((i) => isProblem(i.status)) : detail.items
  const problems = detail.items.filter((i) => isProblem(i.status)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={small}>
          Started {when(detail.run.startedAt)} · {formatDuration(detail.run.durationMs)}
          {detail.run.conflictMode && ` · if a record exists: ${detail.run.conflictMode.toLowerCase()}`}
        </span>
        <span style={{ flex: 1 }} />
        {problems > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...small }}>
            <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
            Only the {problems} that need a look
          </label>
        )}
        <button type="button" className="small" onClick={() => downloadJson(detail)}>
          <IconDownload size={13} /> Download JSON
        </button>
      </div>
      <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Status</th>
              <th style={{ width: '90px' }}>Kind</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.position}>
                <td>
                  <span className={`badge ${badgeClass(item.status)}`}>{item.status.toLowerCase()}</span>
                </td>
                <td style={small}>{item.kind.toLowerCase()}</td>
                <td>
                  <code style={{ fontSize: 'var(--ds-font-size-caption)' }}>{item.key}</code>
                  {item.label && item.label !== item.key && <div style={small}>{item.label}</div>}
                </td>
                <td>
                  {item.message ? (
                    <span style={{ color: 'var(--ds-color-error)', fontSize: 'var(--ds-font-size-caption)' }}>
                      {item.httpStatus ? `${item.httpStatus}: ` : ''}
                      {item.message}
                      {item.fieldErrors.length > 0 && <div>{item.fieldErrors.join(', ')}</div>}
                    </span>
                  ) : item.storeId ? (
                    <span style={small}>ID: {item.storeId}</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Every import and media drop kept by the store: who, when, what happened to each call, file and image placement. */
export function HistoryView({ connected }: { connected: boolean }) {
  const toast = useToast()
  const [source, setSource] = useState<RunSource | ''>('')
  const [status, setStatus] = useState<RunStatus | ''>('')
  const [page, setPage] = useState(0)
  /** The last answer and the query it belongs to: "loading" is simply "the answer is not for what is asked now". */
  const [answer, setAnswer] = useState<{ key: string; page: RunPage } | null>(null)
  const [refreshes, setRefreshes] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  const key = `${source}|${status}|${page}|${refreshes}`
  const loading = connected && answer?.key !== key
  const data = answer?.page ?? null

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    listRuns({ source: source || undefined, status: status || undefined, page, size: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setAnswer({ key, page: result })
      })
      .catch((error: Error) => {
        if (cancelled) return
        toast.error(`The history could not be loaded: ${error.message}`)
        // keep what was shown, but stop the "Loading…"
        setAnswer((current) => ({ key, page: current?.page ?? { content: [], page: { size: PAGE_SIZE, number: 0, totalElements: 0, totalPages: 0 } } }))
      })
    return () => {
      cancelled = true
    }
  }, [connected, source, status, page, key, toast])

  if (!connected) {
    return (
      <div className="card">
        <h2>History</h2>
        <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>Connect to the store to see the imports it has kept (Connect tab).</p>
      </div>
    )
  }

  const runs = data?.content ?? []
  const totalPages = data?.page.totalPages ?? 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h2 style={{ marginBottom: '4px' }}>History</h2>
          <p style={{ ...small, margin: 0 }}>
            Every data import and media drop, kept by the store. {data ? `${data.page.totalElements} run${data.page.totalElements === 1 ? '' : 's'}.` : ''}
          </p>
        </div>
        <select aria-label="Filter by source" value={source} onChange={(e) => { setSource(e.target.value as RunSource | ''); setPage(0) }}>
          <option value="">All sources</option>
          <option value="IMPORTER">Importer</option>
          <option value="CLI">CLI</option>
          <option value="API">API</option>
        </select>
        <select aria-label="Filter by result" value={status} onChange={(e) => { setStatus(e.target.value as RunStatus | ''); setPage(0) }}>
          <option value="">Any result</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="PARTIAL">Partial</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="button" onClick={() => setRefreshes(refreshes + 1)} disabled={loading}>
          <IconRefresh size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {data && runs.length === 0 ? (
        <p style={{ ...small, margin: 0 }}>{source || status ? 'No run matches these filters.' : 'Nothing has been imported yet. A run appears here when it ends.'}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '150px' }}>When</th>
                <th style={{ width: '110px' }}>Result</th>
                <th>What</th>
                <th>Outcome</th>
                <th style={{ width: '90px' }}>Took</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <Fragment key={run.id}>
                  <tr onClick={() => setOpen(open === run.id ? null : run.id)} style={{ cursor: 'pointer' }} aria-expanded={open === run.id}>
                    <td>{when(run.startedAt)}</td>
                    <td>
                      <span className={`badge ${badgeClass(run.status)}`}>{run.status.toLowerCase()}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{run.label ?? 'Import'}</div>
                      <div style={small}>
                        {run.source.toLowerCase()}
                        {run.actorEmail && ` · ${run.actorEmail}`}
                      </div>
                    </td>
                    <td style={{ fontSize: 'var(--ds-font-size-small)' }}>{describeCounts(run.counts)}</td>
                    <td style={small}>{formatDuration(run.durationMs)}</td>
                  </tr>
                  {open === run.id && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--ds-color-surface-muted)' }}>
                        <RunDetailPanel id={run.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="small" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <span style={small}>
            Page {page + 1} of {totalPages}
          </span>
          <button type="button" className="small" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(page + 1)}>
            Older
          </button>
        </div>
      )}
    </div>
  )
}
