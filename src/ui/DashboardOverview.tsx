import type { ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import {
  IconArrowRight,
  IconClock,
  IconFileText,
  IconMedia,
  IconPlay,
  IconUpload,
} from './Icons'
import type { LoadedFile } from './StepFiles'
import type { TabId } from './Sidebar'

interface DashboardOverviewProps {
  files: Partial<Record<ResourceKind, LoadedFile>>
  imageCount: number
  isRunning: boolean
  onSelectTab: (tab: TabId) => void
  onRunImport: () => void
}

export function DashboardOverview({
  files,
  imageCount,
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
              {isRunning ? (
                <>
                  <IconClock size={16} /> Import Running...
                </>
              ) : (
                <>
                  <IconPlay size={16} /> Run Full Import
                </>
              )}
            </button>
            <button type="button" onClick={() => onSelectTab('media')}>
              <IconUpload size={16} /> Upload Media
            </button>
            <button type="button" onClick={() => onSelectTab('docs')}>
              <IconFileText size={16} /> Documentation
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => onSelectTab('products')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
              Total Rows Staged
            </span>
            <IconFileText size={16} style={{ color: 'var(--ds-color-text-secondary)' }} />
          </div>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600, color: 'var(--ds-color-primary)' }}>
            {totalRows}
          </div>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Across {filesLoadedCount} loaded files
          </span>
        </div>

        <div className="stat-card" onClick={() => onSelectTab('media')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
              Image Library Assets
            </span>
            <IconMedia size={16} style={{ color: 'var(--ds-color-text-secondary)' }} />
          </div>
          <div style={{ fontSize: 'var(--ds-font-size-kpi)', fontWeight: 600 }}>
            {imageCount}
          </div>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Photos & videos uploaded
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{tmpl.title}</h4>
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

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button className="small" type="button" onClick={(e) => {
                    e.stopPropagation()
                    onSelectTab(kind as TabId)
                  }}>
                    {rowsCount > 0 ? 'Manage' : 'Upload'}
                    <IconArrowRight size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
