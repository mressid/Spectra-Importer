import type { OperationResult, ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import type { LoadedFile } from './StepFiles'
import type { TabId } from './Sidebar'

interface DashboardOverviewProps {
  files: Partial<Record<ResourceKind, LoadedFile>>
  imageCount: number
  connectedUser: string | null
  operationResults: OperationResult[]
  totalOperations: number
  isRunning: boolean
  onSelectTab: (tab: TabId) => void
  onRunImport: () => void
}

const RESOURCE_ICONS: Record<ResourceKind, string> = {
  tags: '🏷️',
  brands: '🏢',
  categories: '📁',
  collections: '📦',
  products: '🛍️',
  variants: '🔀',
}

export function DashboardOverview({
  files,
  imageCount,
  connectedUser,
  operationResults,
  totalOperations,
  isRunning,
  onSelectTab,
  onRunImport,
}: DashboardOverviewProps) {
  let totalRows = 0
  let filesLoadedCount = 0
  for (const f of Object.values(files)) {
    if (f?.document) {
      filesLoadedCount++
      totalRows += f.document.rows.length
    }
  }

  let completedOps = 0
  let failedOps = 0
  let runningOps = 0
  for (const r of operationResults) {
    if (r.status === 'created' || r.status === 'updated') completedOps++
    else if (r.status === 'failed') failedOps++
    else if (r.status === 'running') runningOps++
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Banner */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2>Dashboard Overview</h2>
            <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
              Bulk upload products, categories, brands, tags, and collections into the store.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="primary"
              type="button"
              onClick={onRunImport}
              disabled={filesLoadedCount === 0 || isRunning}
            >
              {isRunning ? 'Import Running...' : 'Run Full Import'}
            </button>
            <button type="button" onClick={() => onSelectTab('media')}>
              Upload Media
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => onSelectTab('products')}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Total Rows Staged
          </span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600, color: 'var(--ds-color-primary)' }}>
            {totalRows}
          </div>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Across {filesLoadedCount} loaded files
          </span>
        </div>

        <div className="stat-card" onClick={() => onSelectTab('media')}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Image Library Assets
          </span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600 }}>
            {imageCount}
          </div>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Photos & videos uploaded
          </span>
        </div>

        <div className="stat-card" onClick={() => onSelectTab('operations')}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Operations Completed
          </span>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600, color: 'var(--ds-color-accent)' }}>
            {completedOps}
          </div>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            {runningOps > 0 ? `${runningOps} ongoing` : 'No ongoing calls'}
          </span>
        </div>

        <div className="stat-card" onClick={() => onSelectTab('connect')}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Store API Connection
          </span>
          <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600, marginTop: '4px' }}>
            {connectedUser ? 'Connected' : 'Offline'}
          </div>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: connectedUser ? 'var(--ds-color-accent)' : 'var(--ds-color-warning)' }}>
            {connectedUser ?? 'Login required'}
          </span>
        </div>
      </div>

      {/* Catalogue Resources Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>Catalogue Resources</h3>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Click any resource to upload data or view schema
          </span>
        </div>

        <div className="resource-cards-grid">
          {RESOURCE_KINDS.map((kind) => {
            const tmpl = TEMPLATES[kind]
            const loaded = files[kind]
            const rowsCount = loaded?.document?.rows.length ?? 0
            const hasError = Boolean(loaded?.error)

            return (
              <div
                key={kind}
                className="resource-card"
                onClick={() => onSelectTab(kind as TabId)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--ds-font-size-title)' }}>{RESOURCE_ICONS[kind]}</span>
                    <div>
                      <h4 style={{ margin: 0 }}>{tmpl.title}</h4>
                      <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                        Key: <code>{tmpl.idField}</code>
                      </span>
                    </div>
                  </div>

                  {hasError ? (
                    <span className="badge error">Parse error</span>
                  ) : rowsCount > 0 ? (
                    <span className="badge success">{rowsCount} rows</span>
                  ) : (
                    <span className="badge">Empty</span>
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                    {tmpl.endpoint}
                  </span>
                  <button className="small" type="button" onClick={(e) => {
                    e.stopPropagation()
                    onSelectTab(kind as TabId)
                  }}>
                    {rowsCount > 0 ? 'Manage' : 'Upload'} →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Operations live status if any */}
      {totalOperations > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0 }}>Active Pipeline Operations</h3>
            <button className="small" type="button" onClick={() => onSelectTab('operations')}>
              View Live Pipeline →
            </button>
          </div>
          <p style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            {completedOps} created/updated, {failedOps} failed across {totalOperations} total operations.
          </p>
        </div>
      )}
    </div>
  )
}
