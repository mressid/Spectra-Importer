import type { OperationResult, ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import {
  IconAlertCircle,
  IconCheckCircle,
  IconClock,
  IconLogo,
  IconMedia,
  IconOperations,
  IconOverview,
  IconSettings,
  IconXCircle,
  ResourceIcon,
} from './Icons'
import type { LoadedFile } from './StepFiles'

export type TabId =
  | 'overview'
  | 'tags'
  | 'brands'
  | 'categories'
  | 'collections'
  | 'products'
  | 'variants'
  | 'media'
  | 'operations'
  | 'connect'

interface SidebarProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
  connectedUser: string | null
  imageCount: number
  files: Partial<Record<ResourceKind, LoadedFile>>
  operationResults: OperationResult[]
  totalOperations: number
  isRunning: boolean
}

export function Sidebar({
  activeTab,
  onSelectTab,
  connectedUser,
  imageCount,
  files,
  operationResults,
  totalOperations,
  isRunning,
}: SidebarProps) {
  // Compute operations brief
  let created = 0
  let failed = 0
  let running = 0
  let blocked = 0

  for (const r of operationResults) {
    if (r.status === 'created' || r.status === 'updated') created++
    else if (r.status === 'failed') failed++
    else if (r.status === 'running') running++
    else if (r.status === 'blocked') blocked++
  }

  const hasOperations = operationResults.length > 0 || totalOperations > 0

  return (
    <aside className="dashboard-sidebar">
      {/* Brand header */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: 'var(--ds-radius-inner)',
              background: 'var(--ds-color-surface-muted)',
              border: '1px solid var(--ds-color-border)',
              color: 'var(--ds-color-primary)',
            }}
          >
            <IconLogo size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)', lineHeight: 1.2 }}>
              Store Importer
            </div>
            <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
              Bulk Catalogue Hub
            </div>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <span
            className={`badge ${connectedUser ? 'success' : 'warning'}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 8px' }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: 'var(--ds-radius-chip)',
                background: connectedUser ? 'var(--ds-color-accent)' : 'var(--ds-color-warning)',
              }}
            />
            {connectedUser ? connectedUser.split('@')[0] : 'Offline'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Dashboard sections">
        <div className="sidebar-section-title">Dashboard</div>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <IconOverview size={18} className="sidebar-icon" />
          <span style={{ flex: 1, textAlign: 'left' }}>Overview</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => onSelectTab('media')}
        >
          <IconMedia size={18} className="sidebar-icon" />
          <span style={{ flex: 1, textAlign: 'left' }}>Image Library</span>
          {imageCount > 0 && <span className="badge info">{imageCount}</span>}
        </button>

        <div className="sidebar-section-title">Catalogue Resources</div>

        {RESOURCE_KINDS.map((kind) => {
          const tmpl = TEMPLATES[kind]
          const loaded = files[kind]
          const hasError = Boolean(loaded?.error)
          const rowCount = loaded?.document?.rows.length ?? 0
          const isActive = activeTab === kind
          return (
            <button
              key={kind}
              type="button"
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(kind as TabId)}
            >
              <ResourceIcon kind={kind} size={18} className="sidebar-icon" />
              <span style={{ flex: 1, textAlign: 'left' }}>{tmpl.title}</span>
              {hasError ? (
                <span className="badge error">!</span>
              ) : rowCount > 0 ? (
                <span className="badge success">{rowCount}</span>
              ) : null}
            </button>
          )
        })}

        <div className="sidebar-section-title">Pipeline</div>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'operations' ? 'active' : ''}`}
          onClick={() => onSelectTab('operations')}
        >
          <IconOperations size={18} className="sidebar-icon" />
          <span style={{ flex: 1, textAlign: 'left' }}>Operations</span>
          {isRunning ? (
            <span className="badge warning">running</span>
          ) : failed > 0 ? (
            <span className="badge error">{failed} err</span>
          ) : totalOperations > 0 ? (
            <span className="badge info">{totalOperations}</span>
          ) : null}
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => onSelectTab('connect')}
        >
          <IconSettings size={18} className="sidebar-icon" />
          <span style={{ flex: 1, textAlign: 'left' }}>Store Settings</span>
        </button>
      </nav>

      {/* Operations Brief Widget */}
      <div className="sidebar-brief">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-caption)' }}>
            Operations Brief
          </span>
          {isRunning && <span className="badge warning">live</span>}
        </div>

        {hasOperations ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ds-font-size-caption)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ds-color-text-secondary)' }}>
                <IconClock size={13} style={{ color: 'var(--ds-color-info)' }} />
                Ongoing
              </span>
              <strong style={{ color: running > 0 ? 'var(--ds-color-info)' : 'var(--ds-color-text-primary)' }}>
                {running}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ds-font-size-caption)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ds-color-text-secondary)' }}>
                <IconCheckCircle size={13} style={{ color: 'var(--ds-color-accent)' }} />
                Completed
              </span>
              <strong style={{ color: 'var(--ds-color-accent)' }}>{created}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ds-font-size-caption)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ds-color-text-secondary)' }}>
                <IconXCircle size={13} style={{ color: 'var(--ds-color-error)' }} />
                Failed
              </span>
              <strong style={{ color: failed > 0 ? 'var(--ds-color-error)' : 'var(--ds-color-text-secondary)' }}>
                {failed}
              </strong>
            </div>

            {blocked > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ds-font-size-caption)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ds-color-text-secondary)' }}>
                  <IconAlertCircle size={13} style={{ color: 'var(--ds-color-warning)' }} />
                  Blocked
                </span>
                <strong style={{ color: 'var(--ds-color-warning)' }}>{blocked}</strong>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            No active operations. Select a resource to upload data.
          </div>
        )}
      </div>
    </aside>
  )
}
