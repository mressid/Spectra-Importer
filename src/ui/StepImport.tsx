import { useMemo, useRef, useState } from 'react'
import type { OperationResult, RunReport } from '../core/types'
import type { PlanInput } from '../upload/plan'
import { buildPlan } from '../upload/plan'
import { runPlan } from '../upload/run'

interface StepImportProps {
  inputs: PlanInput[]
  initialStoreIds?: Partial<Record<string, string>>
  onBack: () => void
}

function downloadReport(report: RunReport) {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `import-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function StepImport({ inputs, initialStoreIds, onBack }: StepImportProps) {
  const plan = useMemo(() => buildPlan(inputs), [inputs])

  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<OperationResult[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleStart = async () => {
    setIsRunning(true)
    setReport(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await runPlan(plan, {
        signal: controller.signal,
        initialStoreIds,
        conflictMode: inputs[0]?.onConflict ?? 'skip',
        onProgress: (live) => setResults([...live]),
      })
      setReport(res)
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const totals = useMemo(() => {
    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    let blocked = 0

    const currentResults = report ? report.results : results
    for (const r of currentResults) {
      if (r.status === 'created') created++
      else if (r.status === 'updated') updated++
      else if (r.status === 'skipped') skipped++
      else if (r.status === 'failed') failed++
      else if (r.status === 'blocked') blocked++
    }

    return { created, updated, skipped, failed, blocked }
  }, [report, results])

  const doneCount = totals.created + totals.updated + totals.skipped + totals.failed + totals.blocked
  const percent = plan.length > 0 ? Math.round((doneCount / plan.length) * 100) : 0

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2>5. Execute Import</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            {plan.length} operations prepared across {inputs.length} resource types.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onBack} disabled={isRunning}>
            Back to Check
          </button>
          {!isRunning && !report && (
            <button className="primary" type="button" onClick={handleStart} disabled={plan.length === 0}>
              Start Import
            </button>
          )}
          {isRunning && (
            <button className="danger" type="button" onClick={handleCancel}>
              Cancel Import
            </button>
          )}
          {report && (
            <button className="primary" type="button" onClick={() => downloadReport(report)}>
              Download Report (JSON)
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isRunning || report) && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-small)' }}>
              {isRunning ? 'Importing in progress...' : 'Import finished'} ({doneCount} / {plan.length})
            </span>
            <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
              {percent}%
            </span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {/* Totals Summary */}
      {(isRunning || report) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '20px' }}>
          <div style={{ padding: '8px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Created</span>
            <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600, color: 'var(--ds-color-accent)' }}>{totals.created}</div>
          </div>
          <div style={{ padding: '8px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Updated</span>
            <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600, color: 'var(--ds-color-accent)' }}>{totals.updated}</div>
          </div>
          <div style={{ padding: '8px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Skipped</span>
            <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600, color: 'var(--ds-color-text-secondary)' }}>{totals.skipped}</div>
          </div>
          <div style={{ padding: '8px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Failed</span>
            <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600, color: 'var(--ds-color-error)' }}>{totals.failed}</div>
          </div>
          <div style={{ padding: '8px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Blocked</span>
            <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600, color: 'var(--ds-color-warning)' }}>{totals.blocked}</div>
          </div>
        </div>
      )}

      {/* Operations List */}
      <div>
        <h3 style={{ marginBottom: '8px' }}>Execution Plan & Progress</h3>
        <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Status</th>
                <th>Operation</th>
                <th style={{ width: '80px' }}>Method</th>
                <th>Path</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((op) => {
                const result = (report ? report.results : results).find((r) => r.key === op.key)
                const status = result?.status ?? 'pending'

                let badgeClass = ''
                if (status === 'created' || status === 'updated') badgeClass = 'success'
                else if (status === 'failed') badgeClass = 'error'
                else if (status === 'blocked' || status === 'pending') badgeClass = 'warning'
                else if (status === 'running') badgeClass = 'info'

                return (
                  <tr key={op.key}>
                    <td>
                      <span className={`badge ${badgeClass}`}>{status}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{op.label}</td>
                    <td>
                      <code>{op.method}</code>
                    </td>
                    <td>
                      <code style={{ fontSize: 'var(--ds-font-size-caption)' }}>{op.path}</code>
                    </td>
                    <td>
                      {result?.error ? (
                        <span style={{ color: 'var(--ds-color-error)', fontSize: 'var(--ds-font-size-caption)' }}>
                          {result.error.message}
                          {result.error.fieldErrors && result.error.fieldErrors.length > 0 && (
                            <div>{result.error.fieldErrors.join(', ')}</div>
                          )}
                        </span>
                      ) : result?.storeId ? (
                        <span style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-caption)' }}>
                          ID: {result.storeId}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
