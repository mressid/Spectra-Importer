import { useMemo, useState } from 'react'
import type { ImportDocument, ResourceKind } from '../../core/types'
import { autoLayoutGraph, bundleGraph, createPresetGraph } from '../../graph/bundler'
import type { CatalogueSearchItem } from '../../graph/catalogueSearch'
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
  IconSearch,
  IconTag,
  IconVariant,
  IconWorkflow,
} from '../Icons'
import { CatalogueSearchModal } from './CatalogueSearchModal'
import { GraphCanvas } from './GraphCanvas'
import { ManifestModal } from './ManifestModal'
import { NodeInspector } from './NodeInspector'

interface GraphBuilderProps {
  onStageDocuments: (documents: Partial<Record<ResourceKind, ImportDocument>>) => void
}

export function GraphBuilder({ onStageDocuments }: GraphBuilderProps) {
  const [graph, setGraph] = useState<ProductGraph>(() => createPresetGraph('simple'))
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(['node-prod-1'])
  const [showManifestModal, setShowManifestModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)

  const selectedNodes = useMemo(
    () => graph.nodes.filter((n) => selectedNodeIds.includes(n.id)),
    [graph.nodes, selectedNodeIds],
  )
  const primarySelectedNode = selectedNodes[0] ?? null

  const bundleResult = useMemo(() => bundleGraph(graph), [graph])

  // --- Graph Mutators ---

  const handleUpdateNodesPositions = (updates: { id: string; x: number; y: number }[]) => {
    const map = new Map(updates.map((u) => [u.id, u]))
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        const u = map.get(n.id)
        return u ? { ...n, x: u.x, y: u.y } : n
      }),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleSelectNodes = (nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds)
  }

  const handleToggleSelectNode = (nodeId: string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

  const handleDeleteNodes = (nodeIds: string[]) => {
    const idSet = new Set(nodeIds)
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => !idSet.has(n.id)),
      edges: prev.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedNodeIds((prev) => prev.filter((id) => !idSet.has(id)))
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

    setSelectedNodeIds([id])
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
    setSelectedNodeIds(newGraph.nodes[0] ? [newGraph.nodes[0].id] : [])
  }

  const handleAutoLayout = () => {
    setGraph((prev) => autoLayoutGraph(prev))
  }

  const handleSelectCatalogueResource = (item: CatalogueSearchItem, connectToSelected: boolean) => {
    const existing = graph.nodes.find((n) => {
      if (n.type !== item.kind) return false
      if (item.kind === 'media') {
        return (n.data as { fileName?: string }).fileName === item.slug
      }
      return (n.data as { slug?: string }).slug === item.slug
    })

    const targetNode: GraphNode =
      existing ?? {
        id: `node-${item.kind}-${Date.now().toString().slice(-4)}`,
        type: item.kind as GraphNodeType,
        x: primarySelectedNode ? primarySelectedNode.x + 280 : 360 + Math.floor(Math.random() * 80),
        y: primarySelectedNode ? primarySelectedNode.y + Math.floor(Math.random() * 60) - 30 : 160 + Math.floor(Math.random() * 80),
        data: item.data as never,
      }

    if (!existing) {
      setGraph((prev) => ({
        ...prev,
        nodes: [...prev.nodes, targetNode],
        updatedAt: new Date().toISOString(),
      }))
    }

    if (connectToSelected && primarySelectedNode && targetNode.id !== primarySelectedNode.id) {
      handleAddEdge(primarySelectedNode.id, targetNode.id)
    }

    setSelectedNodeIds([targetNode.id])
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

          <div style={{ height: '24px', width: '1px', background: 'var(--ds-color-border)', margin: '0 4px' }} />

          {/* Search Store API Button */}
          <button
            type="button"
            className="small"
            onClick={() => setShowSearchModal(true)}
            title="Search existing tags, collections, media, brands, categories from the Store API"
            style={{
              gap: '6px',
              background: 'var(--ds-color-surface-muted)',
              border: '1px solid var(--ds-color-border)',
              color: 'var(--ds-color-text-primary)',
              fontWeight: 500,
            }}
          >
            <IconSearch size={13} style={{ color: 'var(--ds-color-primary)' }} />
            Search Store API
          </button>
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
          selectedNodeIds={selectedNodeIds}
          onSelectNodes={handleSelectNodes}
          onToggleSelectNode={handleToggleSelectNode}
          onUpdateNodesPositions={handleUpdateNodesPositions}
          onDeleteNodes={handleDeleteNodes}
          onAddEdge={handleAddEdge}
          onDeleteEdge={handleDeleteEdge}
        />

        {selectedNodes.length > 0 && (
          <NodeInspector
            selectedNodes={selectedNodes}
            nodes={graph.nodes}
            edges={graph.edges}
            onUpdateNode={handleUpdateNodeData}
            onDeleteNodes={handleDeleteNodes}
            onAddEdge={handleAddEdge}
            onDeleteEdge={handleDeleteEdge}
            onOpenSearch={() => setShowSearchModal(true)}
            onClose={() => setSelectedNodeIds([])}
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

      {/* Store Catalogue Search Modal */}
      {showSearchModal && (
        <CatalogueSearchModal
          selectedNode={primarySelectedNode}
          onSelectResource={handleSelectCatalogueResource}
          onClose={() => setShowSearchModal(false)}
        />
      )}
    </div>
  )
}
