import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react'
import type { GraphEdge, GraphNode } from '../../graph/types'
import {
  getFullyCoveredNodeIds,
  NODE_HEIGHT,
  NODE_WIDTH,
} from '../../graph/selectionUtils'
import { NodeCard } from './NodeCard'
import { IconMinus, IconPlus, IconRefresh } from '../Icons'

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeIds: string[]
  onSelectNodes: (nodeIds: string[]) => void
  onToggleSelectNode: (nodeId: string) => void
  onUpdateNodesPositions: (updates: { id: string; x: number; y: number }[]) => void
  onDeleteNodes: (nodeIds: string[]) => void
  onAddEdge: (sourceId: string, targetId: string) => void
  onDeleteEdge: (edgeId: string) => void
}

export function GraphCanvas({
  nodes,
  edges,
  selectedNodeIds,
  onSelectNodes,
  onToggleSelectNode,
  onUpdateNodesPositions,
  onDeleteNodes,
  onAddEdge,
  onDeleteEdge,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Dragging state for multiple nodes
  const [draggingNodesState, setDraggingNodesState] = useState<{
    startX: number
    startY: number
    nodePositions: Map<string, { origX: number; origY: number }>
  } | null>(null)

  // Selection box state (Right-click or Shift+Left-click drag marquee)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
    isRightClick: boolean
  } | null>(null)

  // Connecting state between ports
  const [connectingSource, setConnectingSource] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  // Canvas zoom & pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)

  // Refs to allow non-passive wheel event handler to read current values without stale closures
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)

  useEffect(() => {
    zoomRef.current = zoom
    panRef.current = pan
  }, [zoom, pan])

  // Non-passive wheel event listener for smooth touchpad pinch-to-zoom, Ctrl+wheel zoom, and 2-finger scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const currentZoom = zoomRef.current
      const currentPan = panRef.current
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      if (e.ctrlKey || e.metaKey) {
        // Touchpad pinch-to-zoom OR Ctrl + Mouse Wheel: zoom centered at cursor
        const worldX = (mouseX - currentPan.x) / currentZoom
        const worldY = (mouseY - currentPan.y) / currentZoom

        const zoomFactor = -e.deltaY * 0.006
        const nextZoom = Math.min(2.5, Math.max(0.25, currentZoom * Math.exp(zoomFactor)))

        const nextPanX = mouseX - worldX * nextZoom
        const nextPanY = mouseY - worldY * nextZoom

        setZoom(nextZoom)
        setPan({ x: nextPanX, y: nextPanY })
      } else {
        // Trackpad 2-finger swipe OR standard mouse wheel: pan canvas
        let dx = e.deltaX
        let dy = e.deltaY

        if (e.shiftKey && dx === 0) {
          dx = dy
          dy = 0
        }

        setPan({
          x: currentPan.x - dx,
          y: currentPan.y - dy,
        })
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Nodes covered by the current selection box (full element cover)
  const coveredIdsDuringDrag = useMemo(() => {
    if (!selectionBox) return new Set<string>()
    return new Set(getFullyCoveredNodeIds(nodes, selectionBox, NODE_WIDTH, NODE_HEIGHT))
  }, [selectionBox, nodes])

  const handleSelectNode = (node: GraphNode, isMulti: boolean) => {
    if (isMulti) {
      onToggleSelectNode(node.id)
    } else {
      onSelectNodes([node.id])
    }
  }

  const handleMouseDownNode = (e: MouseEvent, node: GraphNode) => {
    if (e.button === 2) {
      // Right-click down on node initiates marquee selection
      handleCanvasMouseDown(e)
      return
    }

    if (isSpacePressed) return // Allow spacebar drag over nodes to pan canvas
    e.stopPropagation()

    const isMultiModifier = e.shiftKey || e.ctrlKey || e.metaKey

    if (isMultiModifier) {
      onToggleSelectNode(node.id)
    } else if (!selectedNodeIds.includes(node.id)) {
      onSelectNodes([node.id])
    }

    const activeIds = selectedNodeIds.includes(node.id)
      ? selectedNodeIds
      : [node.id]

    const positions = new Map<string, { origX: number; origY: number }>()
    for (const id of activeIds) {
      const n = nodes.find((item) => item.id === id)
      if (n) {
        positions.set(id, { origX: n.x, origY: n.y })
      }
    }
    positions.set(node.id, { origX: node.x, origY: node.y })

    setDraggingNodesState({
      startX: e.clientX,
      startY: e.clientY,
      nodePositions: positions,
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
    // 1. Right-click OR Shift+Left-click: Start selection box marquee
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = (e.clientX - rect.left - pan.x) / zoom
      const mouseY = (e.clientY - rect.top - pan.y) / zoom
      setSelectionBox({
        startX: mouseX,
        startY: mouseY,
        currentX: mouseX,
        currentY: mouseY,
        isRightClick: e.button === 2,
      })
      return
    }

    // 2. Middle-click, Space+Left-click, or Left-click on canvas background: Pan
    const isMiddleClick = e.button === 1
    const isSpaceClick = e.button === 0 && isSpacePressed
    const isBackgroundClick =
      e.button === 0 &&
      (e.target === containerRef.current ||
        (e.target as HTMLElement).tagName === 'svg' ||
        (e.target as HTMLElement).tagName === 'rect')

    if (isMiddleClick || isSpaceClick || isBackgroundClick) {
      if (!isSpaceClick && !isMiddleClick) {
        onSelectNodes([])
      }
      if (connectingSource) {
        setConnectingSource(null)
        setMousePos(null)
      }
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // Update selection box
      if (selectionBox && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left - pan.x) / zoom
        const mouseY = (e.clientY - rect.top - pan.y) / zoom
        setSelectionBox((prev) => (prev ? { ...prev, currentX: mouseX, currentY: mouseY } : null))
        return
      }

      // Drag multiple nodes
      if (draggingNodesState) {
        const dx = (e.clientX - draggingNodesState.startX) / zoom
        const dy = (e.clientY - draggingNodesState.startY) / zoom
        const updates: { id: string; x: number; y: number }[] = []
        draggingNodesState.nodePositions.forEach(({ origX, origY }, id) => {
          updates.push({
            id,
            x: Math.max(20, Math.round(origX + dx)),
            y: Math.max(20, Math.round(origY + dy)),
          })
        })
        onUpdateNodesPositions(updates)
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
    [selectionBox, draggingNodesState, isPanning, panStart, pan, zoom, connectingSource, onUpdateNodesPositions],
  )

  const handleMouseUp = (e: MouseEvent) => {
    // Finalize selection box
    if (selectionBox) {
      const dragDist = Math.hypot(
        selectionBox.currentX - selectionBox.startX,
        selectionBox.currentY - selectionBox.startY,
      )

      if (dragDist > 5) {
        // Full element cover selection
        const fullyCoveredIds = getFullyCoveredNodeIds(
          nodes,
          selectionBox,
          NODE_WIDTH,
          NODE_HEIGHT,
        )

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const merged = Array.from(new Set([...selectedNodeIds, ...fullyCoveredIds]))
          onSelectNodes(merged)
        } else {
          onSelectNodes(fullyCoveredIds)
        }
      }
      setSelectionBox(null)
    }

    setDraggingNodesState(null)
    setIsPanning(false)
  }

  // Keypad & keyboard shortcuts
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    const targetTag = (e.target as HTMLElement).tagName
    const isInputActive = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT'

    if (e.code === 'Space' && !isInputActive && !isSpacePressed) {
      e.preventDefault()
      setIsSpacePressed(true)
      return
    }

    if (isInputActive) return

    // Ctrl+A / Cmd+A: Select all nodes
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      onSelectNodes(nodes.map((n) => n.id))
      return
    }

    // Keypad zoom controls
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      e.preventDefault()
      setZoom((z) => Math.min(2.5, +(z * 1.15).toFixed(2)))
    } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault()
      setZoom((z) => Math.max(0.25, +(z * 0.85).toFixed(2)))
    } else if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault()
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    // Arrow keys pan canvas
    else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPan((p) => ({ ...p, x: p.x + (e.shiftKey ? 120 : 40) }))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPan((p) => ({ ...p, x: p.x - (e.shiftKey ? 120 : 40) }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPan((p) => ({ ...p, y: p.y + (e.shiftKey ? 120 : 40) }))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPan((p) => ({ ...p, y: p.y - (e.shiftKey ? 120 : 40) }))
    }
    // Delete/Backspace: delete all selected nodes
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.length > 0) {
      e.preventDefault()
      onDeleteNodes(selectedNodeIds)
    }
    // Escape: cancel connection or clear selection
    else if (e.key === 'Escape') {
      if (connectingSource) {
        setConnectingSource(null)
        setMousePos(null)
      } else {
        onSelectNodes([])
      }
    }
  }

  const handleKeyUp = (e: ReactKeyboardEvent) => {
    if (e.code === 'Space') {
      setIsSpacePressed(false)
    }
  }

  // Calculate Bezier curves for edges
  const nodeMap = new Map<string, GraphNode>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        flex: 1,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--ds-color-canvas)',
        outline: 'none',
        cursor: isPanning
          ? 'grabbing'
          : isSpacePressed
          ? 'grab'
          : connectingSource
          ? 'crosshair'
          : 'default',
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
            isSelected={selectedNodeIds.includes(node.id) || coveredIdsDuringDrag.has(node.id)}
            isConnectingSource={connectingSource?.id === node.id}
            onSelect={handleSelectNode}
            onDelete={(id) => onDeleteNodes([id])}
            onStartConnect={handleStartConnect}
            onCompleteConnect={handleCompleteConnect}
            onMouseDownDrag={handleMouseDownNode}
          />
        ))}

        {/* Marquee Selection Box Layer */}
        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
              border: '1px dashed var(--ds-color-primary)',
              background: 'var(--ds-color-surface-muted)',
              opacity: 0.5,
              pointerEvents: 'none',
              zIndex: 50,
            }}
          />
        )}
      </div>

      {/* Zoom / Pan Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          background: 'var(--ds-color-surface)',
          padding: '4px 8px',
          borderRadius: 'var(--ds-radius-card)',
          border: '1px solid var(--ds-color-border)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          className="small"
          onClick={() => setZoom((z) => Math.min(2.5, +(z * 1.15).toFixed(2)))}
          title="Zoom In (+ / Keypad +)"
        >
          <IconPlus size={14} />
        </button>
        <button
          type="button"
          className="small"
          onClick={() => setZoom((z) => Math.max(0.25, +(z * 0.85).toFixed(2)))}
          title="Zoom Out (- / Keypad -)"
        >
          <IconMinus size={14} />
        </button>
        <button
          type="button"
          className="small"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
          title="Reset Zoom & Pan (0 / Keypad 0)"
        >
          <IconRefresh size={13} />
          {Math.round(zoom * 100)}%
        </button>
        <div style={{ height: '16px', width: '1px', background: 'var(--ds-color-border)', margin: '0 2px' }} />
        <span
          style={{
            fontSize: 'var(--ds-font-size-caption)',
            color: 'var(--ds-color-text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          Pinch / Ctrl+Wheel to Zoom • 2-finger / Space+Drag to Pan
        </span>
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
