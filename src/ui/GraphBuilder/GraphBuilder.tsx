import { useMemo, useState } from 'react'
import type { ImportDocument, ResourceKind } from '../../core/types'
import { autoLayoutGraph, bundleGraph, createPresetGraph } from '../../graph/bundler'
import type {
  GraphEdge,
  GraphEdgeType,
  GraphNode,
  GraphNodeType,
  ProductGraph,
} from '../../graph/types'
import {
  IconAlertCircle,
  IconBrand,
  IconCategory,
  IconCheckCircle,
  IconCollection,
  IconLayout,
  IconMedia,
  IconProduct,
  IconTag,
  IconVariant,
  IconWorkflow,
} from '../Icons'
import { GraphCanvas } from './GraphCanvas'
import { ManifestModal } from './ManifestModal'
import { NodeInspector } from './NodeInspector'

interface GraphBuilderProps {
  onStageDocuments: (documents: Partial<Record<ResourceKind, ImportDocument>>) => void
}

export function GraphBuilder({ onStageDocuments }: GraphBuilderProps) {
  const [graph, setGraph] = useState<ProductGraph>(() => createPresetGraph('simple'))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-prod-1')
  const [showManifestModal, setShowManifestModal] = useState(false)

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  )

  const bundleResult = useMemo(() => bundleGraph(graph), [graph])

  // --- Graph Mutators ---

  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleUpdateNodeData = (nodeId: string, updatedData: Record<string, unknown>) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, data: updatedData as never } : n)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleAddNode = (type: GraphNodeType) => {
    const id = `node-${type}-${Date.now().toString().slice(-4)}`
    let data: Record<string, unknown> = {}

    switch (type) {
      case 'product':
        data = {
          slug: `product-${Date.now().toString().slice(-4)}`,
          name: 'New Product',
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          price: 100,
          isActive: true,
          hasVariants: false,
        }
        break
      case 'brand':
        data = {
          slug: `brand-${Date.now().toString().slice(-4)}`,
          name: 'New Brand',
          isAutoCreate: true,
        }
        break
      case 'category':
        data = {
          slug: `category-${Date.now().toString().slice(-4)}`,
          name: 'New Category',
          sortOrder: 0,
          isActive: true,
          isAutoCreate: true,
        }
        break
      case 'collection':
        data = {
          slug: `collection-${Date.now().toString().slice(-4)}`,
          name: 'New Collection',
          isActive: true,
          isAutoCreate: true,
        }
        break
      case 'tag':
        data = {
          slug: `tag-${Date.now().toString().slice(-4)}`,
          name: 'New Tag',
          isAutoCreate: true,
        }
        break
      case 'variant':
        data = {
          sku: `VAR-${Date.now().toString().slice(-4)}`,
          name: 'New Option',
          price: 100,
          stockQuantity: 10,
          isActive: true,
        }
        break
      case 'media':
        data = {
          fileName: `image-${Date.now().toString().slice(-4)}.jpg`,
          role: 'gallery',
          mediaType: 'IMAGE',
        }
        break
    }

    const newNode: GraphNode = {
      id,
      type,
      x: 350 + Math.floor(Math.random() * 80),
      y: 120 + Math.floor(Math.random() * 80),
      data: data as never,
    }

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      updatedAt: new Date().toISOString(),
    }))

    setSelectedNodeId(id)
  }

  const handleDeleteNode = (nodeId: string) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      updatedAt: new Date().toISOString(),
    }))
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
    }
  }

  const handleAddEdge = (sourceId: string, targetId: string) => {
    const src = graph.nodes.find((n) => n.id === sourceId)
    const tgt = graph.nodes.find((n) => n.id === targetId)
    if (!src || !tgt || src.id === tgt.id) return

    // Infer edge type based on connected nodes
    let edgeType: GraphEdgeType | null = null

    if (
      (src.type === 'product' && tgt.type === 'brand') ||
      (src.type === 'brand' && tgt.type === 'product')
    ) {
      edgeType = 'product-brand'
    } else if (
      (src.type === 'product' && tgt.type === 'category') ||
      (src.type === 'category' && tgt.type === 'product')
    ) {
      edgeType = 'product-category'
    } else if (src.type === 'category' && tgt.type === 'category') {
      edgeType = 'category-parent'
    } else if (
      (src.type === 'product' && tgt.type === 'collection') ||
      (src.type === 'collection' && tgt.type === 'product')
    ) {
      edgeType = 'product-collection'
    } else if (
      (src.type === 'product' && tgt.type === 'tag') ||
      (src.type === 'tag' && tgt.type === 'product')
    ) {
      edgeType = 'product-tag'
    } else if (
      (src.type === 'product' && tgt.type === 'variant') ||
      (src.type === 'variant' && tgt.type === 'product')
    ) {
      edgeType = 'product-variant'
    } else if (
      (src.type === 'product' && tgt.type === 'media') ||
      (src.type === 'media' && tgt.type === 'product')
    ) {
      edgeType = 'product-media'
    }

    if (!edgeType) return

    const edgeId = `edge-${src.id}-${tgt.id}`
    const existing = graph.edges.find((e) => e.id === edgeId || (e.source === tgt.id && e.target === src.id))
    if (existing) return

    const newEdge: GraphEdge = {
      id: edgeId,
      source: src.id,
      target: tgt.id,
      type: edgeType,
    }

    setGraph((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleDeleteEdge = (edgeId: string) => {
    setGraph((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleApplyPreset = (preset: 'simple' | 'variants' | 'hierarchy' | 'empty') => {
    const newGraph = createPresetGraph(preset)
    setGraph(newGraph)
    setSelectedNodeId(newGraph.nodes[0]?.id ?? null)
  }

  const handleAutoLayout = () => {
    setGraph((prev) => autoLayoutGraph(prev))
  }

  const handleStageToImporter = () => {
    onStageDocuments(bundleResult.documents)
    setShowManifestModal(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - var(--ds-layout-topbar) - 32px)',
        background: 'var(--ds-color-surface)',
        borderRadius: 'var(--ds-radius-card)',
        border: '1px solid var(--ds-color-border)',
        overflow: 'hidden',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--ds-color-border)',
          background: 'var(--ds-color-surface)',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {/* Left: Title & Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--ds-radius-chip)',
                background: 'var(--ds-color-surface-muted)',
                color: 'var(--ds-color-accent)',
              }}
            >
              <IconWorkflow size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)', lineHeight: 1.2 }}>
                Product Graph Builder
              </div>
              <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                Assemble catalogue nodes & compile import manifests
              </div>
            </div>
          </div>

          <div style={{ height: '24px', width: '1px', background: 'var(--ds-color-border)', margin: '0 4px' }} />

          {/* Preset Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
              Preset:
            </span>
            <select
              style={{ fontSize: 'var(--ds-font-size-small)', padding: '4px 8px' }}
              onChange={(e) => handleApplyPreset(e.target.value as never)}
              defaultValue="simple"
            >
              <option value="simple">Solitaire Ring (Simple)</option>
              <option value="variants">Bracelet (Options / Variants)</option>
              <option value="hierarchy">Hierarchy (Category Tree)</option>
              <option value="empty">Empty Canvas</option>
            </select>
          </div>
        </div>

        {/* Center: Add Node Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('product')}
            title="Add Product Node"
            style={{ gap: '4px' }}
          >
            <IconProduct size={13} style={{ color: 'var(--ds-color-accent)' }} />
            + Product
          </button>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('brand')}
            title="Add Brand Node"
            style={{ gap: '4px' }}
          >
            <IconBrand size={13} style={{ color: 'var(--ds-color-info)' }} />
            + Brand
          </button>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('category')}
            title="Add Category Node"
            style={{ gap: '4px' }}
          >
            <IconCategory size={13} style={{ color: 'var(--ds-status-confirmed)' }} />
            + Category
          </button>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('tag')}
            title="Add Tag Node"
            style={{ gap: '4px' }}
          >
            <IconTag size={13} style={{ color: 'var(--ds-status-pending)' }} />
            + Tag
          </button>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('collection')}
            title="Add Collection Node"
            style={{ gap: '4px' }}
          >
            <IconCollection size={13} style={{ color: 'var(--ds-status-shipped)' }} />
            + Collection
          </button>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('variant')}
            title="Add Variant Node"
            style={{ gap: '4px' }}
          >
            <IconVariant size={13} style={{ color: 'var(--ds-color-primary)' }} />
            + Variant
          </button>
          <button
            type="button"
            className="small"
            onClick={() => handleAddNode('media')}
            title="Add Media Node"
            style={{ gap: '4px' }}
          >
            <IconMedia size={13} style={{ color: 'var(--ds-color-text-secondary)' }} />
            + Media
          </button>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="small"
            onClick={handleAutoLayout}
            title="Automatically arrange nodes neatly"
            style={{ gap: '4px' }}
          >
            <IconLayout size={13} />
            Auto Layout
          </button>

          <button
            type="button"
            className="small primary"
            onClick={() => setShowManifestModal(true)}
            style={{ gap: '6px' }}
          >
            {bundleResult.ok ? (
              <IconCheckCircle size={13} style={{ color: 'var(--ds-color-accent)' }} />
            ) : (
              <IconAlertCircle size={13} style={{ color: 'var(--ds-color-warning)' }} />
            )}
            Compile & Bundle ({graph.nodes.length} nodes)
          </button>
        </div>
      </div>

      {/* Main Graph Workspace Area */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GraphCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={(node) => setSelectedNodeId(node ? node.id : null)}
          onUpdateNodePosition={handleUpdateNodePosition}
          onDeleteNode={handleDeleteNode}
          onAddEdge={handleAddEdge}
          onDeleteEdge={handleDeleteEdge}
        />

        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            nodes={graph.nodes}
            edges={graph.edges}
            onUpdateNode={handleUpdateNodeData}
            onDeleteNode={handleDeleteNode}
            onAddEdge={handleAddEdge}
            onDeleteEdge={handleDeleteEdge}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      {/* Manifest & Bundle Modal */}
      {showManifestModal && (
        <ManifestModal
          bundleResult={bundleResult}
          onStageToImporter={handleStageToImporter}
          onClose={() => setShowManifestModal(false)}
        />
      )}
    </div>
  )
}
