import {
  useCallback,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import type { GraphEdge, GraphNode } from '../../graph/types'
import { NodeCard } from './NodeCard'

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  onSelectNode: (node: GraphNode | null) => void
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void
  onDeleteNode: (nodeId: string) => void
  onAddEdge: (sourceId: string, targetId: string) => void
  onDeleteEdge: (edgeId: string) => void
}

const NODE_WIDTH = 240
const NODE_HEIGHT = 120

export function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Dragging state for nodes
  const [draggingNode, setDraggingNode] = useState<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  // Connecting state between ports
  const [connectingSource, setConnectingSource] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  // Canvas zoom & pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const handleMouseDownNode = (e: MouseEvent, node: GraphNode) => {
    e.stopPropagation()
    onSelectNode(node)
    setDraggingNode({
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.x,
      origY: node.y,
    })
  }

  const handleStartConnect = (node: GraphNode) => {
    setConnectingSource(node)
  }

  const handleCompleteConnect = (targetNode: GraphNode) => {
    if (connectingSource && connectingSource.id !== targetNode.id) {
      onAddEdge(connectingSource.id, targetNode.id)
    }
    setConnectingSource(null)
    setMousePos(null)
  }

  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg')) {
      onSelectNode(null)
      if (connectingSource) {
        setConnectingSource(null)
        setMousePos(null)
      } else {
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingNode) {
        const dx = (e.clientX - draggingNode.startX) / zoom
        const dy = (e.clientY - draggingNode.startY) / zoom
        onUpdateNodePosition(
          draggingNode.id,
          Math.max(20, Math.round(draggingNode.origX + dx)),
          Math.max(20, Math.round(draggingNode.origY + dy)),
        )
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        })
      }

      if (connectingSource && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setMousePos({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom,
        })
      }
    },
    [draggingNode, isPanning, panStart, pan, zoom, connectingSource, onUpdateNodePosition],
  )

  const handleMouseUp = () => {
    setDraggingNode(null)
    setIsPanning(false)
  }

  // Calculate Bezier curves for edges
  const nodeMap = new Map<string, GraphNode>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        flex: 1,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--ds-color-canvas)',
        cursor: isPanning ? 'grabbing' : connectingSource ? 'crosshair' : 'default',
      }}
    >
      {/* Background Grid Pattern */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern id="grid-dots" width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
            <circle cx={2} cy={2} r={1.2} fill="var(--ds-color-border)" />
          </pattern>
          <marker
            id="edge-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--ds-color-text-secondary)" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-dots)" />
      </svg>

      {/* Canvas Viewport (Zoomable & Pannable) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '4000px',
          height: '4000px',
        }}
      >
        {/* SVG Edges Layer */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {edges.map((edge) => {
            const src = nodeMap.get(edge.source)
            const tgt = nodeMap.get(edge.target)
            if (!src || !tgt) return null

            // Connect from right port of source to left port of target (or vice versa if reversed)
            const isTargetLeft = tgt.x < src.x
            const x1 = isTargetLeft ? src.x : src.x + NODE_WIDTH
            const y1 = src.y + NODE_HEIGHT / 2
            const x2 = isTargetLeft ? tgt.x + NODE_WIDTH : tgt.x
            const y2 = tgt.y + NODE_HEIGHT / 2

            const dx = Math.max(40, Math.abs(x2 - x1) * 0.5)
            const pathData = `M ${x1} ${y1} C ${isTargetLeft ? x1 - dx : x1 + dx} ${y1}, ${
              isTargetLeft ? x2 + dx : x2 - dx
            } ${y2}, ${x2} ${y2}`

            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2

            return (
              <g key={edge.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                {/* Thick invisible hover stroke */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteEdge(edge.id)
                  }}
                />
                {/* Visible curve */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="var(--ds-color-text-secondary)"
                  strokeWidth="2"
                  markerEnd="url(#edge-arrow)"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteEdge(edge.id)
                  }}
                />
                {/* Edge relationship tag pill */}
                <rect
                  x={midX - 35}
                  y={midY - 10}
                  width="70"
                  height="20"
                  rx="4"
                  fill="var(--ds-color-surface)"
                  stroke="var(--ds-color-border)"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteEdge(edge.id)
                  }}
                />
                <text
                  x={midX}
                  y={midY + 4}
                  textAnchor="middle"
                  fill="var(--ds-color-text-secondary)"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteEdge(edge.id)
                  }}
                >
                  {edge.type.replace('product-', '').replace('category-', '')}
                </text>
              </g>
            )
          })}

          {/* Dynamic connecting line preview while dragging */}
          {connectingSource && mousePos && (
            <path
              d={`M ${connectingSource.x + NODE_WIDTH} ${connectingSource.y + NODE_HEIGHT / 2} C ${
                connectingSource.x + NODE_WIDTH + 60
              } ${connectingSource.y + NODE_HEIGHT / 2}, ${mousePos.x - 60} ${mousePos.y}, ${mousePos.x} ${
                mousePos.y
              }`}
              fill="none"
              stroke="var(--ds-color-info)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {/* Nodes Layer */}
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            isConnectingSource={connectingSource?.id === node.id}
            onSelect={onSelectNode}
            onDelete={onDeleteNode}
            onStartConnect={handleStartConnect}
            onCompleteConnect={handleCompleteConnect}
            onMouseDownDrag={handleMouseDownNode}
          />
        ))}
      </div>

      {/* Zoom / Pan Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          display: 'flex',
          gap: '6px',
          background: 'var(--ds-color-surface)',
          padding: '4px',
          borderRadius: 'var(--ds-radius-card)',
          border: '1px solid var(--ds-color-border)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          className="small"
          onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          className="small"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          title="Zoom Out"
        >
          -
        </button>
        <button
          type="button"
          className="small"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
          title="Reset Zoom & Pan"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      {/* Floating Instructions when connecting */}
      {connectingSource && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ds-color-surface)',
            border: '1px solid var(--ds-color-info)',
            padding: '6px 14px',
            borderRadius: 'var(--ds-radius-inner)',
            fontSize: 'var(--ds-font-size-small)',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Connecting from <strong>{connectingSource.id}</strong>. Click another node port to connect, or click canvas to cancel.</span>
        </div>
      )}
    </div>
  )
}
