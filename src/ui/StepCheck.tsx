import { useEffect, useMemo, useState } from 'react'
import type { ConflictMode, Issue, ResourceKind } from '../core/types'
import { TEMPLATES } from '../templates'
import type { ImageLibrary } from '../upload/imageLibrary'
import { libraryNames } from '../upload/imageLibrary'
import type { PlanInput } from '../upload/plan'
import { storeIndexToExisting } from '../upload/storeIndex'
import type { ValidationContext, ValidationResult } from '../validate/validate'
import { validateDocument } from '../validate/validate'
import type { LoadedFile } from './StepFiles'

interface StepCheckProps {
  files: Partial<Record<ResourceKind, LoadedFile>>
  library: ImageLibrary
  storeIndex: Partial<Record<ResourceKind, Map<string, string>>>
  storeIndexLoading: boolean
  /** Product slugs with a thumbnail waiting in the store: their thumbnailUrl may be empty. */
  reservedThumbnails: ReadonlySet<string>
  onRefreshStoreIndex: () => Promise<void>
  conflictMode: ConflictMode
  setConflictMode: (mode: ConflictMode) => void
  importOnlyValid: boolean
  setImportOnlyValid: (onlyValid: boolean) => void
  onProceed: (inputs: PlanInput[]) => void
}

export function StepCheck({
  files,
  library,
  storeIndex,
  storeIndexLoading,
  reservedThumbnails,
  onRefreshStoreIndex,
  conflictMode,
  setConflictMode,
  importOnlyValid,
  setImportOnlyValid,
  onProceed,
}: StepCheckProps) {
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<string>('all')

  useEffect(() => {
    // If store index is empty, fetch it
    if (Object.keys(storeIndex).length === 0 && !storeIndexLoading) {
      onRefreshStoreIndex()
    }
  }, [storeIndex, storeIndexLoading, onRefreshStoreIndex])

  const { validationResults, totalRows, totalValid, totalErrors, totalWarnings } = useMemo(() => {
    const results: Partial<Record<ResourceKind, ValidationResult>> = {}
    const pending: Partial<Record<ResourceKind, Set<string>>> = {}

    // Collect pending identifiers
    for (const [k, f] of Object.entries(files)) {
      const kind = k as ResourceKind
      if (f?.document) {
        const tmpl = TEMPLATES[kind]
        pending[kind] = new Set(
          f.document.rows.map((r) => String(r[tmpl.idField] ?? '').trim()).filter(Boolean),
        )
      }
    }

    const context: ValidationContext = {
      pending,
      existing: storeIndexToExisting(storeIndex),
      images: libraryNames(library),
      reservedThumbnails,
    }

    let rowsCount = 0
    let validCount = 0
    let errorsCount = 0
    let warningsCount = 0

    for (const [k, f] of Object.entries(files)) {
      const kind = k as ResourceKind
      if (f?.document) {
        const res = validateDocument(f.document, context)
        results[kind] = res
        rowsCount += f.document.rows.length
        validCount += res.clean.length
        errorsCount += res.issues.filter((i) => i.severity === 'error').length
        warningsCount += res.issues.filter((i) => i.severity === 'warning').length
      }
    }

    return {
      validationResults: results,
      totalRows: rowsCount,
      totalValid: validCount,
      totalErrors: errorsCount,
      totalWarnings: warningsCount,
    }
  }, [files, library, storeIndex, reservedThumbnails])

  const handleStartImport = () => {
    const inputs: PlanInput[] = []
    for (const [k, res] of Object.entries(validationResults)) {
      const kind = k as ResourceKind
      if (res && res.clean.length > 0) {
        inputs.push({
          template: kind,
          rows: res.clean,
          onConflict: conflictMode,
          library,
        })
      }
    }
    onProceed(inputs)
  }

  const canProceed =
    totalValid > 0 &&
    (importOnlyValid || totalErrors === 0) &&
    !storeIndexLoading

  // Group issues by template
  const issuesByTemplate = useMemo(() => {
    const map = new Map<ResourceKind, Issue[]>()
    for (const [k, res] of Object.entries(validationResults)) {
      const kind = k as ResourceKind
      if (res && res.issues.length > 0) {
        map.set(kind, res.issues)
      }
    }
    return map
  }, [validationResults])

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2>4. Validate & Check Data</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            Checking rows against schemas, references, the store index and image library.
          </p>
        </div>
        <button
          className="primary"
          type="button"
          disabled={!canProceed}
          onClick={handleStartImport}
        >
          Proceed to Import
        </button>
      </div>

      {storeIndexLoading && (
        <div style={{ padding: '8px 12px', background: 'var(--ds-color-surface-muted)', borderRadius: 'var(--ds-radius-inner)', marginBottom: '16px' }}>
          Checking existing records in store...
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '12px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Total Rows</span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600 }}>{totalRows}</div>
        </div>
        <div style={{ padding: '12px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Valid Rows</span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600, color: 'var(--ds-color-accent)' }}>{totalValid}</div>
        </div>
        <div style={{ padding: '12px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Errors</span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600, color: 'var(--ds-color-error)' }}>{totalErrors}</div>
        </div>
        <div style={{ padding: '12px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-card)', background: 'var(--ds-color-surface)' }}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Warnings</span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600, color: 'var(--ds-color-warning)' }}>{totalWarnings}</div>
        </div>
      </div>

      {/* Import Settings */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          padding: '16px',
          background: 'var(--ds-color-surface-muted)',
          borderRadius: 'var(--ds-radius-card)',
          marginBottom: '20px',
        }}
      >
        <div>
          <label style={{ fontWeight: 600, marginBottom: '6px' }}>Error Handling</label>
          <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--ds-font-size-small)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--ds-color-text-primary)' }}>
              <input
                type="radio"
                name="importMode"
                checked={importOnlyValid}
                onChange={() => setImportOnlyValid(true)}
              />
              Import valid rows only (skip faulty rows)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--ds-color-text-primary)' }}>
              <input
                type="radio"
                name="importMode"
                checked={!importOnlyValid}
                onChange={() => setImportOnlyValid(false)}
              />
              Stop on any error
            </label>
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 600, marginBottom: '6px' }}>If Record Already Exists</label>
          <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--ds-font-size-small)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--ds-color-text-primary)' }}>
              <input
                type="radio"
                name="conflictMode"
                checked={conflictMode === 'skip'}
                onChange={() => setConflictMode('skip')}
              />
              Skip (safe re-run)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--ds-color-text-primary)' }}>
              <input
                type="radio"
                name="conflictMode"
                checked={conflictMode === 'update'}
                onChange={() => setConflictMode('update')}
              />
              Update
            </label>
          </div>
        </div>
      </div>

      {/* Issues Breakdown */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>Validation Issues</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`small ${selectedTemplateFilter === 'all' ? 'primary' : ''}`}
              type="button"
              onClick={() => setSelectedTemplateFilter('all')}
            >
              All
            </button>
            {Array.from(issuesByTemplate.keys()).map((k) => (
              <button
                key={k}
                className={`small ${selectedTemplateFilter === k ? 'primary' : ''}`}
                type="button"
                onClick={() => setSelectedTemplateFilter(k)}
              >
                {TEMPLATES[k].title} ({issuesByTemplate.get(k)?.length})
              </button>
            ))}
          </div>
        </div>

        {totalErrors === 0 && totalWarnings === 0 ? (
          <div className="badge success" style={{ padding: '8px 12px' }}>
            All {totalRows} rows passed validation cleanly!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from(issuesByTemplate.entries())
              .filter(([k]) => selectedTemplateFilter === 'all' || selectedTemplateFilter === k)
              .map(([kind, issues]) => (
                <div
                  key={kind}
                  style={{
                    border: '1px solid var(--ds-color-border)',
                    borderRadius: 'var(--ds-radius-card)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--ds-color-surface-muted)',
                      padding: '8px 12px',
                      fontWeight: 600,
                      fontSize: 'var(--ds-font-size-small)',
                      borderBottom: '1px solid var(--ds-color-border)',
                    }}
                  >
                    {TEMPLATES[kind].title} ({issues.length} issues)
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>Row</th>
                        <th style={{ width: '140px' }}>Identifier</th>
                        <th style={{ width: '120px' }}>Field</th>
                        <th>Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((issue, idx) => (
                        <tr key={idx}>
                          <td>Row {issue.rowIndex + 1}</td>
                          <td>
                            <strong>{issue.rowId ?? '—'}</strong>
                          </td>
                          <td>
                            <code>{issue.field ?? 'general'}</code>
                          </td>
                          <td>
                            <span className={`badge ${issue.severity === 'error' ? 'error' : 'warning'}`}>
                              {issue.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
