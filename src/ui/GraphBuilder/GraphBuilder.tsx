import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ImportDocument, ResourceKind } from '../../core/types'
import { autoLayoutGraph, bundleGraph, createPresetGraph } from '../../graph/bundler'
import { graphFromDocuments, type RowDocuments } from '../../graph/fromDocuments'
import { mergeGraphs } from '../../graph/mergeGraph'
import type { ImageLibrary } from '../../upload/imageLibrary'
import { applySnapshot, lookupProduct } from '../../graph/fromStore'
import { isLoggedIn } from '../../upload/api'
import { useToast } from '../toastContext'
import type { CatalogueSearchItem } from '../../graph/catalogueSearch'
import type {
  GraphEdge,
  GraphEdgeType,
  GraphNode,
  GraphNodeType,
  ProductGraph,
} from '../../graph/types'
import { CatalogueSearchModal } from './CatalogueSearchModal'
import { GraphCanvas } from './GraphCanvas'
import { ManifestModal } from './ManifestModal'
import { NodeInspector } from './NodeInspector'
import { IconDownload, IconLayout, IconPlay, IconSearch, IconTrash } from '../Icons'

interface GraphBuilderProps {
  onStageDocuments: (documents: Partial<Record<ResourceKind, ImportDocument>>) => void
  /** The graph lives in the app, so what is added from other steps (auto-configure) is here when this one opens. */
  graph: ProductGraph
  onGraphChange: Dispatch<SetStateAction<ProductGraph>>
  /** The rows that are loaded as files: "Load rows" moves them into the graph. */
  documents: RowDocuments
  library: ImageLibrary
}

export function GraphBuilder({ onStageDocuments, graph, onGraphChange: setGraph, documents, library }: GraphBuilderProps) {
  const toast = useToast()
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() => {
    const first = graph.nodes.find((n) => n.type === 'product') ?? graph.nodes[0]
    return first ? [first.id] : []
  })
  const [showManifestModal, setShowManifestModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  /** A product is being read from the store (Apply, next to its slug or SKU). */
  const [applying, setApplying] = useState(false)
  // the graph as it is when the store answers, not as it was when the button was pressed
  const graphRef = useRef(graph)
  useEffect(() => {
    graphRef.current = graph
  })

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

  const handleClearCanvas = () => {
    if (graph.nodes.length === 0) return
    if (!window.confirm('Remove everything from the canvas?')) return
    setGraph(createPresetGraph('empty'))
    setSelectedNodeIds([])
    toast.info('The canvas is empty.')
  }

  /** Apply, next to a product's slug or SKU: read that product from the store and fill the node from it. */
  const handleApplyFromStore = async (node: GraphNode, by: 'slug' | 'sku') => {
    if (node.type !== 'product' || applying) return
    const data = node.data as { slug?: string; sku?: string }
    if (!isLoggedIn()) {
      toast.error('Connect to the store first (Settings).')
      return
    }
    setApplying(true)
    try {
      const snapshot = await lookupProduct({ slug: data.slug, sku: data.sku, first: by })
      if (!snapshot) {
        toast.error(by === 'slug' ? `The store has no product with the slug "${data.slug}".` : `The store has no product with the SKU "${data.sku}".`)
        return
      }
      const result = applySnapshot(graphRef.current, node.id, snapshot)
      setGraph(result.graph)
      const { brands, categories, tags, collections, images, variants } = result.applied
      const added = [
        brands && `${brands} brand`,
        categories && `${categories} categor${categories === 1 ? 'y' : 'ies'}`,
        tags && `${tags} tag${tags === 1 ? '' : 's'}`,
        collections && `${collections} collection${collections === 1 ? '' : 's'}`,
        images && `${images} image${images === 1 ? '' : 's'}`,
        variants && `${variants} variant${variants === 1 ? '' : 's'}`,
      ].filter(Boolean)
      toast.success(`Filled from "${String(snapshot.product.name)}"${added.length > 0 ? `, added ${added.join(', ')}` : ''}.`)
    } catch (error) {
      toast.error(`The store could not be read: ${(error as Error).message}`)
    } finally {
      setApplying(false)
    }
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

  const rowsLoaded = Object.values(documents).some((doc) => doc && doc.rows.length > 0)

  /** Moves the rows that are loaded as files into the graph (matching nodes are updated, new ones added), to edit them here. */
  const handleLoadRows = () => {
    const loaded = graphFromDocuments(documents, library)
    if (loaded.graph.nodes.length === 0) {
      toast.info('There are no product rows to load: load or auto-configure some first.')
      return
    }
    const merged = mergeGraphs(graph, loaded.graph)
    setGraph(merged.graph)
    setSelectedNodeIds(merged.touched.slice(0, 1))
    const c = loaded.counts
    toast.success(
      `Rows moved into the graph: ${c.products} product${c.products === 1 ? '' : 's'}, ${c.variants} variant${c.variants === 1 ? '' : 's'}, ${c.media} photo${c.media === 1 ? '' : 's'}` +
        (merged.updated > 0 ? ` (${merged.updated} already there, updated)` : '') +
        '. Stage the graph to move the edits back into the rows.',
    )
    if (loaded.unsupported.length > 0) {
      toast.info(`The graph has no place for ${loaded.unsupported.join(', ')}: they stay in the rows but are not in the graph.`)
    }
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
      {/* Top Toolbar: one row, the node types in a single list */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--ds-color-border)',
          background: 'var(--ds-color-surface)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <strong style={{ whiteSpace: "nowrap" }}>Graph builder</strong>
          <select
            aria-label="Preset"
            onChange={(e) => handleApplyPreset(e.target.value as never)}
            defaultValue="simple"
          >
            <option value="simple">Ring (simple)</option>
            <option value="variants">Bracelet (variants)</option>
            <option value="hierarchy">Category tree</option>
            <option value="empty">Empty canvas</option>
          </select>
          <select
            aria-label="Add a node"
            value=""
            onChange={(e) => {
              if (e.target.value) handleAddNode(e.target.value as never)
            }}
          >
            <option value="">Add a node…</option>
            <option value="product">Product</option>
            <option value="brand">Brand</option>
            <option value="category">Category</option>
            <option value="tag">Tag</option>
            <option value="collection">Collection</option>
            <option value="variant">Variant</option>
            <option value="media">Media</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="small"
            onClick={() => setShowSearchModal(true)}
            title="Search existing tags, collections, media, brands and categories in the store"
          >
            <IconSearch size={13} />
            Search the store
          </button>
          <button
            type="button"
            className="small"
            onClick={handleLoadRows}
            disabled={!rowsLoaded}
            title={rowsLoaded ? 'Move the rows loaded as files into the graph' : 'No rows are loaded: load files or auto-configure products first'}
          >
            <IconDownload size={13} />
            Load rows
          </button>
          <button type="button" className="small" onClick={handleAutoLayout} title="Arrange the nodes neatly">
            <IconLayout size={13} />
            Auto layout
          </button>
          <button type="button" className="small" onClick={handleClearCanvas} disabled={graph.nodes.length === 0} title="Remove everything from the canvas">
            <IconTrash size={13} />
            Clear canvas
          </button>
          <button type="button" className="small primary" onClick={() => setShowManifestModal(true)}>
            <IconPlay size={13} />
            Compile & bundle
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
            onApplyFromStore={handleApplyFromStore}
            applying={applying}
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
