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
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconSettings,
  IconWorkflow,
  IconXCircle,
  ResourceIcon,
} from './Icons'
import type { LoadedFile } from './StepFiles'

export type TabId =
  | 'overview'
  | 'builder'
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
  collapsed?: boolean
  onToggleCollapse?: () => void
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
  collapsed = false,
  onToggleCollapse,
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
    <aside className={`dashboard-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand header */}
      <div className="sidebar-header">
        {collapsed ? (
          <div
            title={connectedUser ? `Store Importer (${connectedUser})` : 'Store Importer (Offline)'}
            style={{
              position: 'relative',
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
            <span
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: 'var(--ds-radius-chip)',
                background: connectedUser ? 'var(--ds-color-accent)' : 'var(--ds-color-warning)',
                border: '2px solid var(--ds-color-surface)',
              }}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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

              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Collapse sidebar (Ctrl+B)"
                  aria-label="Collapse sidebar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--ds-radius-chip)',
                    color: 'var(--ds-color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <IconPanelLeftClose size={16} />
                </button>
              )}
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
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Dashboard sections">
        <div className="sidebar-section-title">Dashboard</div>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
          title="Overview"
        >
          <IconOverview size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Overview</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => onSelectTab('builder')}
          title="Graph Builder (New)"
        >
          <IconWorkflow size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Graph Builder</span>
          <span
            className="badge"
            style={{
              background: 'var(--ds-color-accent)',
              color: 'var(--ds-color-on-accent)',
              fontWeight: 600,
              padding: '1px 5px',
            }}
          >
            New
          </span>
          {collapsed && <span className="sidebar-badge-dot success" />}
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => onSelectTab('media')}
          title={`Image Library${imageCount > 0 ? ` (${imageCount})` : ''}`}
        >
          <IconMedia size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Image Library</span>
          {imageCount > 0 && <span className="badge info">{imageCount}</span>}
          {collapsed && imageCount > 0 && <span className="sidebar-badge-dot info" />}
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
              title={`${tmpl.title}${hasError ? ' (Error)' : rowCount > 0 ? ` (${rowCount} rows)` : ''}`}
            >
              <ResourceIcon kind={kind} size={18} className="sidebar-icon" />
              <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>{tmpl.title}</span>
              {hasError ? (
                <span className="badge error">!</span>
              ) : rowCount > 0 ? (
                <span className="badge success">{rowCount}</span>
              ) : null}
              {collapsed && (hasError ? (
                <span className="sidebar-badge-dot error" />
              ) : rowCount > 0 ? (
                <span className="sidebar-badge-dot success" />
              ) : null)}
            </button>
          )
        })}

        <div className="sidebar-section-title">Pipeline</div>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'operations' ? 'active' : ''}`}
          onClick={() => onSelectTab('operations')}
          title={`Operations${isRunning ? ' (Running)' : failed > 0 ? ` (${failed} failed)` : totalOperations > 0 ? ` (${totalOperations})` : ''}`}
        >
          <IconOperations size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Operations</span>
          {isRunning ? (
            <span className="badge warning">running</span>
          ) : failed > 0 ? (
            <span className="badge error">{failed} err</span>
          ) : totalOperations > 0 ? (
            <span className="badge info">{totalOperations}</span>
          ) : null}
          {collapsed && (isRunning ? (
            <span className="sidebar-badge-dot warning" />
          ) : failed > 0 ? (
            <span className="sidebar-badge-dot error" />
          ) : totalOperations > 0 ? (
            <span className="sidebar-badge-dot info" />
          ) : null)}
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => onSelectTab('connect')}
          title="Store Settings"
        >
          <IconSettings size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Store Settings</span>
        </button>
      </nav>

      {/* Operations Brief Widget */}
      {collapsed ? (
        <div
          onClick={() => onSelectTab('operations')}
          title={`Operations: ${created} completed, ${running} running, ${failed} failed${blocked > 0 ? `, ${blocked} blocked` : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 4px',
            margin: '8px 6px',
            borderRadius: 'var(--ds-radius-card)',
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-border)',
            cursor: 'pointer',
          }}
        >
          <IconOperations
            size={16}
            style={{
              color: isRunning
                ? 'var(--ds-color-warning)'
                : failed > 0
                ? 'var(--ds-color-error)'
                : 'var(--ds-color-text-secondary)',
            }}
          />
          {running > 0 ? (
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-info)', fontWeight: 600 }}>
              {running}
            </span>
          ) : failed > 0 ? (
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-error)', fontWeight: 600 }}>
              {failed}
            </span>
          ) : created > 0 ? (
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-accent)', fontWeight: 600 }}>
              {created}
            </span>
          ) : null}
        </div>
      ) : (
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
      )}

      {/* Collapse/Expand Toggle Footer */}
      {onToggleCollapse && (
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-footer-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <IconPanelLeftOpen size={16} /> : <IconPanelLeftClose size={16} />}
            {!collapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      )}
    </aside>
  )
}
