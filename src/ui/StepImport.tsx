import { useMemo, useRef, useState } from 'react'
import type { OperationResult, RunReport } from '../core/types'
import type { PlanInput } from '../upload/plan'
import { buildPlan } from '../upload/plan'
import { dataRun, recordSafely } from '../history/record'
import { runPlan } from '../upload/run'
import { useToast } from './toastContext'
import {
  IconAlertCircle,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconClose,
  IconFileText,
  IconPlay,
  IconXCircle,
} from './Icons'

interface StepImportProps {
  inputs: PlanInput[]
  initialStoreIds?: Partial<Record<string, string>>
  onBack: () => void
  onRunningChange?: (running: boolean) => void
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

export function StepImport({ inputs, initialStoreIds, onBack, onRunningChange }: StepImportProps) {
  const plan = useMemo(() => buildPlan(inputs), [inputs])
  const toast = useToast()

  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<OperationResult[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  /** Whether the finished run was kept in the store's history (null while it is being saved or nothing ran). */
  const [saved, setSaved] = useState<boolean | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleStart = async () => {
    setIsRunning(true)
    onRunningChange?.(true)
    setReport(null)
    setSaved(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await runPlan(plan, {
        signal: controller.signal,
        initialStoreIds,
        conflictMode: inputs[0]?.onConflict ?? 'skip',
        onProgress: (live) => {
          setResults([...live])
        },
      })
      setReport(res)
      // kept in the store's history; a problem there never undoes the import that just ran
      const conflictMode = inputs[0]?.onConflict ?? 'skip'
      const stored = await recordSafely(dataRun(plan, res, { conflictMode, cancelled: controller.signal.aborted }))
      setSaved(stored?.ok ?? null)
      if (stored && !stored.ok) toast.error(`The import ran, but it could not be saved in the History: ${stored.error}`)
    } finally {
      setIsRunning(false)
      onRunningChange?.(false)
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
            <IconChevronLeft size={16} />
            Back to Check
          </button>
          {!isRunning && !report && (
            <button className="primary" type="button" onClick={handleStart} disabled={plan.length === 0}>
              <IconPlay size={16} />
              Start Import
            </button>
          )}
          {isRunning && (
            <button className="danger" type="button" onClick={handleCancel}>
              <IconClose size={16} />
              Cancel Import
            </button>
          )}
          {report && (
            <button className="primary" type="button" onClick={() => downloadReport(report)}>
              <IconFileText size={16} />
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
              {saved === true && ' · saved in History'}
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
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((op) => {
                const result = (report ? report.results : results).find((r) => r.key === op.key)
                const status = result?.status ?? 'pending'

                let badgeClass = ''
                let StatusIcon = IconClock
                if (status === 'created' || status === 'updated') {
                  badgeClass = 'success'
                  StatusIcon = IconCheckCircle
                } else if (status === 'failed') {
                  badgeClass = 'error'
                  StatusIcon = IconXCircle
                } else if (status === 'blocked') {
                  badgeClass = 'warning'
                  StatusIcon = IconAlertCircle
                } else if (status === 'running') {
                  badgeClass = 'info'
                  StatusIcon = IconClock
                }

                return (
                  <tr key={op.key}>
                    <td>
                      <span className={`badge ${badgeClass}`} style={{ gap: '4px' }}>
                        <StatusIcon size={12} />
                        {status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{op.label}</td>
                    <td>
                      {result?.error ? (
                        <span style={{ color: 'var(--ds-color-error)', fontSize: 'var(--ds-font-size-caption)' }}>
                          {result.error.message}
                          {result.error.fieldErrors && result.error.fieldErrors.length > 0 && (
                            <div>{result.error.fieldErrors.join(', ')}</div>
                          )}
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
