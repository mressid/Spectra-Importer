import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import {
  IconFileText,
  IconHistory,
  IconLogo,
  IconMedia,
  IconOperations,
  IconOverview,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconSettings,
  IconWorkflow,
  ResourceIcon,
} from './Icons'

export type TabId =
  | 'overview'
  | 'builder'
  | 'docs'
  | 'tags'
  | 'brands'
  | 'categories'
  | 'collections'
  | 'products'
  | 'variants'
  | 'media'
  | 'operations'
  | 'history'
  | 'connect'

interface SidebarProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ activeTab, onSelectTab, collapsed = false, onToggleCollapse }: SidebarProps) {
  return (
    <aside className={`dashboard-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand header */}
      <div className="sidebar-header">
        {collapsed ? (
          <div
            title="Store Importer"
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
          title="Graph Builder"
        >
          <IconWorkflow size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Graph Builder</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => onSelectTab('media')}
          title="Image Library"
        >
          <IconMedia size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Image Library</span>
        </button>

        <div className="sidebar-section-title">Catalogue Resources</div>

        {RESOURCE_KINDS.map((kind) => {
          const tmpl = TEMPLATES[kind]
          const isActive = activeTab === kind
          return (
            <button
              key={kind}
              type="button"
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(kind as TabId)}
              title={tmpl.title}
            >
              <ResourceIcon kind={kind} size={18} className="sidebar-icon" />
              <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>{tmpl.title}</span>
            </button>
          )
        })}

        <div className="sidebar-section-title">Pipeline</div>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'operations' ? 'active' : ''}`}
          onClick={() => onSelectTab('operations')}
          title="Operations"
        >
          <IconOperations size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Operations</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
          title="History of imports"
        >
          <IconHistory size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>History</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => onSelectTab('connect')}
          title="Settings"
        >
          <IconSettings size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Settings</span>
        </button>

        <div className="sidebar-section-title">Reference</div>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => onSelectTab('docs')}
          title="Documentation & Reference Hub"
        >
          <IconFileText size={18} className="sidebar-icon" />
          <span className="sidebar-item-text" style={{ flex: 1, textAlign: 'left' }}>Documentation</span>
        </button>
      </nav>

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
