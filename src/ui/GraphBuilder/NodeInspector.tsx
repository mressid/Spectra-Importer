import { useState } from 'react'
import { getNodeDisplayTitle, type GraphEdge, type GraphNode } from '../../graph/types'
import {
  IconClose,
  IconLink,
  IconSearch,
  IconTrash,
  IconUnlink,
} from '../Icons'

interface NodeInspectorProps {
  node: GraphNode | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  onUpdateNode: (nodeId: string, updatedData: Record<string, unknown>) => void
  onDeleteNode: (nodeId: string) => void
  onAddEdge: (sourceId: string, targetId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onOpenSearch?: () => void
  onClose: () => void
}

export function NodeInspector({
  node,
  nodes,
  edges,
  onUpdateNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
  onOpenSearch,
  onClose,
}: NodeInspectorProps) {
  const [connectTargetId, setConnectTargetId] = useState('')

  if (!node) return null

  const nodeEdges = edges.filter((e) => e.source === node.id || e.target === node.id)
  const otherNodes = nodes.filter((n) => n.id !== node.id)

  const handleFieldChange = (field: string, val: unknown) => {
    onUpdateNode(node.id, {
      ...node.data,
      [field]: val,
    })
  }

  const handleConnect = () => {
    if (connectTargetId) {
      onAddEdge(node.id, connectTargetId)
      setConnectTargetId('')
    }
  }

  return (
    <aside
      style={{
        width: '320px',
        borderLeft: '1px solid var(--ds-color-border)',
        background: 'var(--ds-color-surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--ds-color-border)',
          background: 'var(--ds-color-surface-muted)',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)', textTransform: 'capitalize' }}>
            {node.type} Node
          </div>
          <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)', fontFamily: 'monospace' }}>
            ID: {node.id}
          </div>
        </div>

        <button
          type="button"
          className="small"
          onClick={onClose}
          style={{ padding: '4px', border: 'none', background: 'transparent' }}
          title="Close Inspector"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
        {/* Common identifier / name fields */}
        {'name' in node.data && (
          <div>
            <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
              Name
            </label>
            <input
              type="text"
              value={String(node.data.name ?? '')}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {'slug' in node.data && (
          <div>
            <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
              Slug (Identifier)
            </label>
            <input
              type="text"
              value={String(node.data.slug ?? '')}
              onChange={(e) => handleFieldChange('slug', e.target.value.toLowerCase().trim())}
              style={{ width: '100%', fontFamily: 'monospace' }}
            />
          </div>
        )}

        {'isAutoCreate' in node.data && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--ds-font-size-small)' }}>
            <input
              type="checkbox"
              checked={Boolean(node.data.isAutoCreate)}
              onChange={(e) => handleFieldChange('isAutoCreate', e.target.checked)}
            />
            <span>Auto-create via <code>create:</code> prefix</span>
          </label>
        )}

        {/* Product-specific fields */}
        {node.type === 'product' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                SKU (Simple products only)
              </label>
              <input
                type="text"
                value={String(node.data.sku ?? '')}
                onChange={(e) => handleFieldChange('sku', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Price in Dinars (TND)
              </label>
              <input
                type="number"
                step="0.001"
                value={node.data.price ?? ''}
                onChange={(e) => handleFieldChange('price', e.target.value ? Number(e.target.value) : undefined)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Stock Quantity
              </label>
              <input
                type="number"
                value={node.data.stockQuantity ?? ''}
                onChange={(e) => handleFieldChange('stockQuantity', e.target.value ? Number(e.target.value) : undefined)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Short Description
              </label>
              <textarea
                rows={2}
                value={String(node.data.shortDescription ?? '')}
                onChange={(e) => handleFieldChange('shortDescription', e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--ds-font-size-small)' }}>
              <input
                type="checkbox"
                checked={Boolean(node.data.isActive ?? true)}
                onChange={(e) => handleFieldChange('isActive', e.target.checked)}
              />
              <span>Active in Store</span>
            </label>
          </>
        )}

        {/* Variant-specific fields */}
        {node.type === 'variant' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                SKU
              </label>
              <input
                type="text"
                value={String(node.data.sku ?? '')}
                onChange={(e) => handleFieldChange('sku', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Price in Dinars (TND)
              </label>
              <input
                type="number"
                step="0.001"
                value={node.data.price ?? ''}
                onChange={(e) => handleFieldChange('price', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Stock Quantity
              </label>
              <input
                type="number"
                value={node.data.stockQuantity ?? ''}
                onChange={(e) => handleFieldChange('stockQuantity', e.target.value ? Number(e.target.value) : undefined)}
                style={{ width: '100%' }}
              />
            </div>
          </>
        )}

        {/* Media-specific fields */}
        {node.type === 'media' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                File Name
              </label>
              <input
                type="text"
                value={String(node.data.fileName ?? '')}
                onChange={(e) => handleFieldChange('fileName', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Role
              </label>
              <select
                value={node.data.role ?? 'thumbnail'}
                onChange={(e) => handleFieldChange('role', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="thumbnail">Main Thumbnail</option>
                <option value="gallery">Gallery Image</option>
              </select>
            </div>
          </>
        )}

        {/* Brand-specific fields */}
        {node.type === 'brand' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Website
              </label>
              <input
                type="url"
                value={String(node.data.website ?? '')}
                onChange={(e) => handleFieldChange('website', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '4px' }}>
                Country
              </label>
              <input
                type="text"
                value={String(node.data.country ?? '')}
                onChange={(e) => handleFieldChange('country', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </>
        )}

        {/* Connections Section */}
        <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--ds-color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-small)' }}>
              Connections ({nodeEdges.length})
            </span>
          </div>

          {onOpenSearch && (
            <button
              type="button"
              className="small"
              onClick={onOpenSearch}
              style={{
                width: '100%',
                marginBottom: '10px',
                gap: '6px',
                justifyContent: 'center',
                background: 'var(--ds-color-surface-muted)',
                border: '1px solid var(--ds-color-border)',
                color: 'var(--ds-color-text-primary)',
                fontWeight: 500,
                padding: '6px 10px',
              }}
              title="Search existing tags, collections, media, brands, categories from the Store API"
            >
              <IconSearch size={13} style={{ color: 'var(--ds-color-primary)' }} />
              Search & Link from Store API...
            </button>
          )}

          {nodeEdges.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {nodeEdges.map((edge) => {
                const otherId = edge.source === node.id ? edge.target : edge.source
                const other = nodes.find((n) => n.id === otherId)
                const otherName = other ? getNodeDisplayTitle(other) : otherId

                return (
                  <div
                    key={edge.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      background: 'var(--ds-color-surface-muted)',
                      borderRadius: 'var(--ds-radius-chip)',
                      fontSize: 'var(--ds-font-size-caption)',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--ds-color-accent)' }}>{edge.type.replace('-', ' ')}</strong>:{' '}
                      {otherName}
                    </span>
                    <button
                      type="button"
                      className="small"
                      onClick={() => onDeleteEdge(edge.id)}
                      style={{ padding: '2px 4px', border: 'none', background: 'transparent' }}
                      title="Disconnect"
                    >
                      <IconUnlink size={12} style={{ color: 'var(--ds-color-error)' }} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)', marginBottom: '12px' }}>
              No connections. Connect this node to assemble dependencies.
            </div>
          )}

          {/* Connect to another canvas node */}
          {otherNodes.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                value={connectTargetId}
                onChange={(e) => setConnectTargetId(e.target.value)}
                style={{ flex: 1, fontSize: 'var(--ds-font-size-small)' }}
              >
                <option value="">Connect with canvas node...</option>
                {otherNodes.map((n) => {
                  const label = getNodeDisplayTitle(n)
                  return (
                    <option key={n.id} value={n.id}>
                      [{n.type}] {label}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                className="small primary"
                disabled={!connectTargetId}
                onClick={handleConnect}
                style={{ gap: '4px', flexShrink: 0, height: '32px' }}
              >
                <IconLink size={13} />
                Connect
              </button>
            </div>
          )}
        </div>

        {/* Delete node action */}
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button
            type="button"
            className="small danger"
            onClick={() => onDeleteNode(node.id)}
            style={{ width: '100%', gap: '6px' }}
          >
            <IconTrash size={14} />
            Delete Node
          </button>
        </div>
      </div>
    </aside>
  )
}
