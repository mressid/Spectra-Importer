import type { CSSProperties, MouseEvent } from 'react'
import {
  getNodeDisplaySubtitle,
  getNodeDisplayTitle,
  type GraphNode,
  type GraphNodeType,
} from '../../graph/types'
import {
  IconBrand,
  IconCategory,
  IconCollection,
  IconLink,
  IconMedia,
  IconProduct,
  IconTag,
  IconTrash,
  IconVariant,
} from '../Icons'

interface NodeCardProps {
  node: GraphNode
  isSelected: boolean
  isConnectingSource: boolean
  onSelect: (node: GraphNode) => void
  onDelete: (nodeId: string) => void
  onStartConnect: (node: GraphNode) => void
  onCompleteConnect: (targetNode: GraphNode) => void
  onMouseDownDrag: (e: MouseEvent, node: GraphNode) => void
}

function getNodeIcon(type: GraphNodeType) {
  switch (type) {
    case 'product':
      return <IconProduct size={16} style={{ color: 'var(--ds-color-accent)' }} />
    case 'brand':
      return <IconBrand size={16} style={{ color: 'var(--ds-color-info)' }} />
    case 'category':
      return <IconCategory size={16} style={{ color: 'var(--ds-status-confirmed)' }} />
    case 'collection':
      return <IconCollection size={16} style={{ color: 'var(--ds-status-shipped)' }} />
    case 'tag':
      return <IconTag size={16} style={{ color: 'var(--ds-status-pending)' }} />
    case 'variant':
      return <IconVariant size={16} style={{ color: 'var(--ds-color-primary)' }} />
    case 'media':
      return <IconMedia size={16} style={{ color: 'var(--ds-color-text-secondary)' }} />
  }
}

function getNodeTypeName(type: GraphNodeType) {
  switch (type) {
    case 'product':
      return 'Product'
    case 'brand':
      return 'Brand'
    case 'category':
      return 'Category'
    case 'collection':
      return 'Collection'
    case 'tag':
      return 'Tag'
    case 'variant':
      return 'Variant'
    case 'media':
      return 'Media'
  }
}

export function NodeCard({
  node,
  isSelected,
  isConnectingSource,
  onSelect,
  onDelete,
  onStartConnect,
  onCompleteConnect,
  onMouseDownDrag,
}: NodeCardProps) {
  const cardStyle: CSSProperties = {
    position: 'absolute',
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: '240px',
    background: 'var(--ds-color-surface)',
    border: `1px solid ${
      isSelected
        ? 'var(--ds-color-accent)'
        : isConnectingSource
          ? 'var(--ds-color-info)'
          : 'var(--ds-color-border)'
    }`,
    boxShadow: isSelected
      ? '0 0 0 2px var(--ds-color-accent)'
      : '0 2px 6px rgba(0,0,0,0.06)',
    borderRadius: 'var(--ds-radius-card)',
    userSelect: 'none',
    zIndex: isSelected ? 10 : 2,
    transition: 'border-color var(--ds-motion-fast), box-shadow var(--ds-motion-fast)',
  }

  const title = getNodeDisplayTitle(node)
  const subtitle = getNodeDisplaySubtitle(node)
  const isAuto = 'isAutoCreate' in node.data && Boolean(node.data.isAutoCreate)

  return (
    <div
      style={cardStyle}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node)
      }}
    >
      {/* Node Header */}
      <div
        onMouseDown={(e) => onMouseDownDrag(e, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--ds-color-border)',
          background: 'var(--ds-color-surface-muted)',
          borderTopLeftRadius: 'var(--ds-radius-card)',
          borderTopRightRadius: 'var(--ds-radius-card)',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {getNodeIcon(node.type)}
          <span
            style={{
              fontSize: 'var(--ds-font-size-caption)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--ds-color-text-secondary)',
            }}
          >
            {getNodeTypeName(node.type)}
          </span>
          {isAuto && (
            <span
              className="badge info"
              style={{ padding: '1px 5px', fontSize: 'var(--ds-font-size-caption)' }}
              title="Auto-created in plan via create: prefix"
            >
              auto
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="small"
            style={{ padding: '2px 4px', border: 'none', background: 'transparent' }}
            title="Connect node to another node"
            onClick={(e) => {
              e.stopPropagation()
              if (isConnectingSource) {
                // already connecting
              } else {
                onStartConnect(node)
              }
            }}
          >
            <IconLink size={13} style={{ color: 'var(--ds-color-text-secondary)' }} />
          </button>
          <button
            type="button"
            className="small"
            style={{ padding: '2px 4px', border: 'none', background: 'transparent' }}
            title="Delete node"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node.id)
            }}
          >
            <IconTrash size={13} style={{ color: 'var(--ds-color-error)' }} />
          </button>
        </div>
      </div>

      {/* Node Body Details */}
      <div style={{ padding: '10px 12px' }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 'var(--ds-font-size-small)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '4px',
          }}
          title={title}
        >
          {title}
        </div>

        {subtitle && (
          <div
            style={{
              fontSize: 'var(--ds-font-size-caption)',
              color: 'var(--ds-color-text-secondary)',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '6px',
            }}
            title={subtitle}
          >
            {subtitle}
          </div>
        )}

        {/* Node-specific metadata pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {node.type === 'product' && (
            <>
              {node.data.price !== undefined && (
                <span className="badge success">{node.data.price} TND</span>
              )}
              {node.data.sku && (
                <span className="badge">{node.data.sku}</span>
              )}
              {node.data.hasVariants && <span className="badge info">Variants</span>}
            </>
          )}

          {node.type === 'variant' && (
            <>
              <span className="badge success">{node.data.price} TND</span>
              {node.data.stockQuantity !== undefined && (
                <span className="badge">Stock: {node.data.stockQuantity}</span>
              )}
            </>
          )}

          {node.type === 'media' && (
            <span className="badge info">
              {node.data.role === 'thumbnail' ? 'Thumbnail' : 'Gallery'}
            </span>
          )}

          {node.type === 'brand' && node.data.country && (
            <span className="badge">{node.data.country}</span>
          )}
        </div>
      </div>

      {/* Visual Port Handles */}
      {/* Left Input Port */}
      <div
        style={{
          position: 'absolute',
          left: '-7px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px',
          borderRadius: 'var(--ds-radius-chip)',
          background: 'var(--ds-color-surface)',
          border: '2px solid var(--ds-color-accent)',
          cursor: 'pointer',
        }}
        title="Input connection port"
        onClick={(e) => {
          e.stopPropagation()
          onCompleteConnect(node)
        }}
      />

      {/* Right Output Port */}
      <div
        style={{
          position: 'absolute',
          right: '-7px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px',
          borderRadius: 'var(--ds-radius-chip)',
          background: 'var(--ds-color-surface)',
          border: '2px solid var(--ds-color-primary)',
          cursor: 'pointer',
        }}
        title="Output connection port (click to connect)"
        onClick={(e) => {
          e.stopPropagation()
          onStartConnect(node)
        }}
      />
    </div>
  )
}
