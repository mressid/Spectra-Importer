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
  selectedNodes: GraphNode[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  onUpdateNode: (nodeId: string, updatedData: Record<string, unknown>) => void
  onDeleteNodes: (nodeIds: string[]) => void
  onAddEdge: (sourceId: string, targetId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onOpenSearch?: () => void
  onClose: () => void
}

export function NodeInspector({
  selectedNodes,
  nodes,
  edges,
  onUpdateNode,
  onDeleteNodes,
  onAddEdge,
  onDeleteEdge,
  onOpenSearch,
  onClose,
}: NodeInspectorProps) {
  const [connectTargetId, setConnectTargetId] = useState('')
  const [batchConnectTargetId, setBatchConnectTargetId] = useState('')

  if (selectedNodes.length === 0) return null

  // MULTI-SELECTION VIEW
  if (selectedNodes.length > 1) {
    const selectedIdsSet = new Set(selectedNodes.map((n) => n.id))
    const nonSelectedNodes = nodes.filter((n) => !selectedIdsSet.has(n.id))
    const typeCounts = selectedNodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.type] = (acc[n.type] ?? 0) + 1
      return acc
    }, {})

    const handleBatchConnect = () => {
      if (batchConnectTargetId) {
        selectedNodes.forEach((n) => {
          onAddEdge(n.id, batchConnectTargetId)
        })
        setBatchConnectTargetId('')
      }
    }

    const handleBatchDelete = () => {
      onDeleteNodes(selectedNodes.map((n) => n.id))
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
        {/* Multi-Selection Header */}
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
            <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)' }}>
              Multi-Selection
            </div>
            <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
              {selectedNodes.length} nodes selected
            </div>
          </div>

          <button
            type="button"
            className="small"
            onClick={onClose}
            style={{ padding: '4px', border: 'none', background: 'transparent' }}
            title="Clear Selection"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          {/* Summary Breakdown Pills */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '6px' }}>
              Selected Types
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(typeCounts).map(([type, count]) => (
                <span key={type} className="badge">
                  <strong>{count}</strong> {type}{count > 1 ? 's' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* List of Selected Nodes */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--ds-font-size-caption)', fontWeight: 600, marginBottom: '6px' }}>
              Selected Nodes
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
              {selectedNodes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    background: 'var(--ds-color-surface-muted)',
                    borderRadius: 'var(--ds-radius-chip)',
                    fontSize: 'var(--ds-font-size-caption)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span className="badge" style={{ padding: '1px 5px', fontSize: 'var(--ds-font-size-caption)' }}>
                      {n.type}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getNodeDisplayTitle(n)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="small"
                    onClick={() => onDeleteNodes([n.id])}
                    style={{ padding: '2px 4px', border: 'none', background: 'transparent' }}
                    title="Delete this node"
                  >
                    <IconTrash size={12} style={{ color: 'var(--ds-color-error)' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Batch Connect to Node */}
          {nonSelectedNodes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '12px', borderTop: '1px solid var(--ds-color-border)' }}>
              <label style={{ fontSize: 'var(--ds-font-size-caption)', fontWeight: 600 }}>
                Connect All to Canvas Node
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={batchConnectTargetId}
                  onChange={(e) => setBatchConnectTargetId(e.target.value)}
                  style={{ flex: 1, fontSize: 'var(--ds-font-size-small)' }}
                >
                  <option value="">Select target node...</option>
                  {nonSelectedNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.type}] {getNodeDisplayTitle(n)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="small primary"
                  disabled={!batchConnectTargetId}
                  onClick={handleBatchConnect}
                  style={{ gap: '4px', flexShrink: 0, height: '32px' }}
                >
                  <IconLink size={13} />
                  Connect
                </button>
              </div>
            </div>
          )}

          {/* Delete All Selected Nodes */}
          <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
            <button
              type="button"
              className="small danger"
              onClick={handleBatchDelete}
              style={{ width: '100%', gap: '6px' }}
            >
              <IconTrash size={14} />
              Delete All ({selectedNodes.length}) Selected Nodes
            </button>
          </div>
        </div>
      </aside>
    )
  }

  // SINGLE NODE VIEW
  const node = selectedNodes[0]!
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
            {/* Visual Media Preview */}
            {node.data.url && (
              <div
                style={{
                  width: '100%',
                  height: '140px',
                  borderRadius: 'var(--ds-radius-card)',
                  overflow: 'hidden',
                  background: 'var(--ds-color-surface-muted)',
                  border: '1px solid var(--ds-color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                }}
              >
                <img
                  src={node.data.url}
                  alt={node.data.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
            )}

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
                Image URL (Preview)
              </label>
              <input
                type="url"
                value={String(node.data.url ?? '')}
                onChange={(e) => handleFieldChange('url', e.target.value)}
                placeholder="https://... or auto-filled from library"
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
            onClick={() => onDeleteNodes([node.id])}
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
