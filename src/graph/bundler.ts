import type { ImportDocument, ResourceKind } from '../core/types'
import type {
  BrandNode,
  BrandNodeData,
  BundleResult,
  CategoryNode,
  CategoryNodeData,
  CollectionNode,
  CollectionNodeData,
  GraphEdge,
  GraphNode,
  MediaNode,
  ProductGraph,
  ProductManifest,
  ProductNode,
  ProductNodeData,
  TagNode,
  TagNodeData,
  VariantNode,
  VariantNodeData,
} from './types'

/**
 * Validates and compiles a ProductGraph into structured ImportDocuments and a ProductManifest.
 */
export function bundleGraph(graph: ProductGraph): BundleResult {
  const issues: string[] = []
  const nodeMap = new Map<string, GraphNode>()
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node)
  }

  // Pre-validate node identifiers
  const seenSlugs = new Map<string, string>()
  for (const node of graph.nodes) {
    const rawId =
      'slug' in node.data
        ? String(node.data.slug ?? '').trim()
        : 'sku' in node.data
          ? String(node.data.sku ?? '').trim()
          : 'fileName' in node.data
            ? String(node.data.fileName ?? '').trim()
            : ''

    if (!rawId) {
      issues.push(`Node "${node.id}" (${node.type}) is missing an identifier (slug / sku / fileName)`)
      continue
    }

    const key = `${node.type}:${rawId}`
    if (seenSlugs.has(key)) {
      issues.push(`Duplicate identifier "${rawId}" found in multiple ${node.type} nodes`)
    } else {
      seenSlugs.set(key, node.id)
    }
  }

  // Build adjacency helper
  const connectedEdges = (nodeId: string) =>
    graph.edges.filter((e) => e.source === nodeId || e.target === nodeId)

  const findConnectedNodes = <T extends GraphNode>(
    nodeId: string,
    edgeType: string,
    expectedNodeType: string,
  ): T[] => {
    const results: T[] = []
    for (const edge of connectedEdges(nodeId)) {
      if (edge.type === edgeType) {
        const otherId = edge.source === nodeId ? edge.target : edge.source
        const other = nodeMap.get(otherId)
        if (other && other.type === expectedNodeType) {
          results.push(other as T)
        }
      }
    }
    return results
  }

  const productNodes = graph.nodes.filter((n): n is ProductNode => n.type === 'product')
  const brandNodes = graph.nodes.filter((n): n is BrandNode => n.type === 'brand')
  const categoryNodes = graph.nodes.filter((n): n is CategoryNode => n.type === 'category')
  const collectionNodes = graph.nodes.filter((n): n is CollectionNode => n.type === 'collection')
  const tagNodes = graph.nodes.filter((n): n is TagNode => n.type === 'tag')
  const variantNodes = graph.nodes.filter((n): n is VariantNode => n.type === 'variant')
  const mediaNodes = graph.nodes.filter((n): n is MediaNode => n.type === 'media')

  if (productNodes.length === 0) {
    issues.push('Graph contains no product nodes. Add at least one Product node to bundle.')
  }

  // --- 1. Assemble Categories ---
  const categoryRows: Record<string, unknown>[] = []
  for (const catNode of categoryNodes) {
    const data = catNode.data as CategoryNodeData
    // Find parent category connection (category-parent)
    const parents = findConnectedNodes<CategoryNode>(catNode.id, 'category-parent', 'category')
    let parentSlug = ''
    if (parents.length > 0) {
      const parent = parents[0]
      parentSlug = parent.data.isAutoCreate ? `create:${parent.data.slug}` : parent.data.slug
    }

    categoryRows.push({
      slug: data.slug,
      name: data.name,
      parent: parentSlug || undefined,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      imageUrl: data.imageUrl,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
    })
  }

  // --- 2. Assemble Brands ---
  const brandRows: Record<string, unknown>[] = brandNodes.map((b) => {
    const data = b.data as BrandNodeData
    return {
      slug: data.slug,
      name: data.name,
      website: data.website,
      country: data.country,
      logoUrl: data.logoUrl,
    }
  })

  // --- 3. Assemble Tags ---
  const tagRows: Record<string, unknown>[] = tagNodes.map((t) => {
    const data = t.data as TagNodeData
    return {
      slug: data.slug,
      name: data.name,
    }
  })

  // --- 4. Assemble Collections ---
  const collectionRows: Record<string, unknown>[] = collectionNodes.map((c) => {
    const data = c.data as CollectionNodeData
    return {
      slug: data.slug,
      name: data.name,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt,
      isActive: data.isActive ?? true,
    }
  })

  // --- 5. Assemble Products & Connected Variants ---
  const productRows: Record<string, unknown>[] = []
  const variantRows: Record<string, unknown>[] = []

  for (const prodNode of productNodes) {
    const data = prodNode.data as ProductNodeData

    // Connected Brands
    const brands = findConnectedNodes<BrandNode>(prodNode.id, 'product-brand', 'brand')
    let brandVal: string | undefined
    if (brands.length > 0) {
      const b = brands[0].data
      brandVal = b.isAutoCreate ? `create:${b.slug}` : b.slug
      if (brands.length > 1) {
        issues.push(`Product "${data.slug}" is connected to multiple brands. Using "${b.slug}".`)
      }
    }

    // Connected Categories
    const categories = findConnectedNodes<CategoryNode>(
      prodNode.id,
      'product-category',
      'category',
    ).map((c) => (c.data.isAutoCreate ? `create:${c.data.slug}` : c.data.slug))

    // Connected Tags
    const tags = findConnectedNodes<TagNode>(prodNode.id, 'product-tag', 'tag').map((t) =>
      t.data.isAutoCreate ? `create:${t.data.slug}` : t.data.slug,
    )

    // Connected Collections
    const collections = findConnectedNodes<CollectionNode>(
      prodNode.id,
      'product-collection',
      'collection',
    ).map((c) => (c.data.isAutoCreate ? `create:${c.data.slug}` : c.data.slug))

    // Connected Variants
    const variants = findConnectedNodes<VariantNode>(
      prodNode.id,
      'product-variant',
      'variant',
    )
    const hasVariants = variants.length > 0 || Boolean(data.hasVariants)

    // Connected Media
    const allMedia = findConnectedNodes<MediaNode>(prodNode.id, 'product-media', 'media')
    // a reserved image is bound by name in the store already and attached when the product is created: it is not written again
    const media = allMedia.filter((m) => !m.data.reserved)
    const hasReservedThumbnail = allMedia.some((m) => m.data.reserved && m.data.role === 'thumbnail')
    const thumbMedia = media.find((m) => m.data.role === 'thumbnail')
    const galleryMedia = media
      .filter((m) => m.data.role !== 'thumbnail')
      .sort((a, b) => (a.data.sortOrder ?? 0) - (b.data.sortOrder ?? 0))

    const thumbnailUrl =
      thumbMedia?.data.url ||
      (thumbMedia?.data.fileName ? `media:${thumbMedia.data.fileName}` : data.thumbnailUrl)

    const images = galleryMedia.map((m) => m.data.url || `media:${m.data.fileName}`)

    if (!thumbnailUrl && !hasReservedThumbnail) {
      issues.push(`Product "${data.slug}" has no thumbnail image (connect a thumbnail media node or provide thumbnailUrl).`)
    }

    if (hasVariants) {
      for (const vNode of variants) {
        const vData = vNode.data as VariantNodeData
        if (!(vData.price > 0)) {
          issues.push(`Variant "${vData.sku}" has no price yet.`)
        }
        variantRows.push({
          sku: vData.sku,
          product: data.slug,
          name: vData.name,
          price: vData.price,
          compareAtPrice: vData.compareAtPrice,
          barcode: vData.barcode,
          weightGrams: vData.weightGrams ?? 0,
          stockQuantity: vData.stockQuantity,
          safetyStock: vData.safetyStock ?? 0,
          availability: vData.availability ?? 'AUTO',
          leadTimeDays: vData.leadTimeDays,
          isActive: vData.isActive ?? true,
        })
      }
    } else {
      if (data.price === undefined) {
        issues.push(`Simple product "${data.slug}" requires a price.`)
      }
      if (!data.sku) {
        issues.push(`Simple product "${data.slug}" requires a SKU.`)
      }
    }

    productRows.push({
      slug: data.slug,
      name: data.name,
      thumbnailUrl,
      images: images.length > 0 ? images : undefined,
      brand: brandVal,
      categories: categories.length > 0 ? categories : undefined,
      tags: tags.length > 0 ? tags : undefined,
      collections: collections.length > 0 ? collections : undefined,
      shortDescription: data.shortDescription,
      description: data.description,
      descriptionFormat: data.descriptionFormat ?? 'MARKDOWN',
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isActive: data.isActive ?? true,
      hasVariants,
      allowPersonalization: data.allowPersonalization ?? false,
      personalizationInstructions: data.personalizationInstructions,
      sku: hasVariants ? undefined : data.sku,
      barcode: hasVariants ? undefined : data.barcode,
      price: hasVariants ? undefined : data.price,
      compareAtPrice: hasVariants ? undefined : data.compareAtPrice,
      weightGrams: hasVariants ? undefined : data.weightGrams ?? 0,
      stockQuantity: hasVariants ? undefined : data.stockQuantity,
      availability: hasVariants ? undefined : data.availability ?? 'AUTO',
      leadTimeDays: hasVariants ? undefined : data.leadTimeDays,
    })
  }

  // Check for orphan variant nodes (variants not connected to any product)
  for (const vNode of variantNodes) {
    const parentProds = findConnectedNodes<ProductNode>(vNode.id, 'product-variant', 'product')
    if (parentProds.length === 0) {
      issues.push(`Variant "${vNode.data.sku}" is not connected to any product node.`)
    }
  }

  // --- Build ImportDocuments ---
  const documents: Partial<Record<ResourceKind, ImportDocument>> = {}
  if (productRows.length > 0) documents.products = { template: 'products', version: 1, rows: productRows }
  if (variantRows.length > 0) documents.variants = { template: 'variants', version: 1, rows: variantRows }
  if (categoryRows.length > 0) documents.categories = { template: 'categories', version: 1, rows: categoryRows }
  if (brandRows.length > 0) documents.brands = { template: 'brands', version: 1, rows: brandRows }
  if (tagRows.length > 0) documents.tags = { template: 'tags', version: 1, rows: tagRows }
  if (collectionRows.length > 0) documents.collections = { template: 'collections', version: 1, rows: collectionRows }

  // --- Build Manifest ---
  const manifest: ProductManifest = {
    version: 1,
    manifestId: graph.id,
    name: graph.name,
    createdAt: new Date().toISOString(),
    stats: {
      products: productRows.length,
      variants: variantRows.length,
      categories: categoryRows.length,
      brands: brandRows.length,
      tags: tagRows.length,
      collections: collectionRows.length,
      media: mediaNodes.length,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
    },
    bundle: {
      products: productRows.length > 0 ? productRows : undefined,
      variants: variantRows.length > 0 ? variantRows : undefined,
      categories: categoryRows.length > 0 ? categoryRows : undefined,
      brands: brandRows.length > 0 ? brandRows : undefined,
      tags: tagRows.length > 0 ? tagRows : undefined,
      collections: collectionRows.length > 0 ? collectionRows : undefined,
    },
  }

  return {
    documents,
    manifest,
    issues,
    ok: issues.length === 0,
  }
}

/**
 * Automatically calculates tidy grid coordinates for graph nodes grouped by role.
 */
export function autoLayoutGraph(graph: ProductGraph): ProductGraph {
  const brandNodes = graph.nodes.filter((n) => n.type === 'brand')
  const collectionNodes = graph.nodes.filter((n) => n.type === 'collection')
  const categoryNodes = graph.nodes.filter((n) => n.type === 'category')
  const productNodes = graph.nodes.filter((n) => n.type === 'product')
  const variantNodes = graph.nodes.filter((n) => n.type === 'variant')
  const tagNodes = graph.nodes.filter((n) => n.type === 'tag')
  const mediaNodes = graph.nodes.filter((n) => n.type === 'media')

  const updatedNodes = graph.nodes.map((n) => ({ ...n }))
  const updatePos = (id: string, x: number, y: number) => {
    const target = updatedNodes.find((n) => n.id === id)
    if (target) {
      target.x = x
      target.y = y
    }
  }

  // Left Column 1: Brands & Collections (x: 40)
  let yLeft1 = 60
  for (const n of brandNodes) {
    updatePos(n.id, 40, yLeft1)
    yLeft1 += 180
  }
  for (const n of collectionNodes) {
    updatePos(n.id, 40, yLeft1)
    yLeft1 += 180
  }

  // Left Column 2: Categories (x: 320)
  let yLeft2 = 60
  for (const n of categoryNodes) {
    updatePos(n.id, 320, yLeft2)
    yLeft2 += 180
  }

  // Center Column: Products (x: 600)
  let yCenter = 60
  for (const n of productNodes) {
    updatePos(n.id, 600, yCenter)
    yCenter += 240
  }

  // Right Column 1: Variants & Media (x: 880)
  let yRight1 = 60
  for (const n of variantNodes) {
    updatePos(n.id, 880, yRight1)
    yRight1 += 180
  }
  for (const n of mediaNodes) {
    updatePos(n.id, 880, yRight1)
    yRight1 += 180
  }

  // Right Column 2: Tags (x: 1140)
  let yRight2 = 60
  for (const n of tagNodes) {
    updatePos(n.id, 1140, yRight2)
    yRight2 += 160
  }

  return {
    ...graph,
    nodes: updatedNodes,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Creates built-in workflow graph templates.
 */
export function createPresetGraph(preset: 'simple' | 'variants' | 'hierarchy' | 'empty'): ProductGraph {
  const now = new Date().toISOString()
  if (preset === 'empty') {
    return {
      id: `graph-${Date.now()}`,
      preset: 'empty',
      name: 'New Product Workflow',
      nodes: [],
      edges: [],
      updatedAt: now,
    }
  }

  if (preset === 'simple') {
    const nodes: GraphNode[] = [
      {
        id: 'node-prod-1',
        type: 'product',
        x: 600,
        y: 80,
        data: {
          slug: 'solitaire-gold-ring',
          name: 'Solitaire Gold Ring',
          sku: 'RING-GLD-01',
          price: 450,
          compareAtPrice: 520,
          weightGrams: 5,
          stockQuantity: 15,
          shortDescription: 'Classic handcrafted 18k gold solitaire ring.',
          description: 'A timeless solitaire ring featuring premium artisan crafting.',
          descriptionFormat: 'MARKDOWN',
          isActive: true,
          hasVariants: false,
        },
      },
      {
        id: 'node-brand-1',
        type: 'brand',
        x: 40,
        y: 80,
        data: {
          slug: 'aurum-lux',
          name: 'Aurum Lux',
          website: 'https://aurumlux.example',
          country: 'TN',
          isAutoCreate: true,
        },
      },
      {
        id: 'node-cat-1',
        type: 'category',
        x: 320,
        y: 80,
        data: {
          slug: 'fine-rings',
          name: 'Fine Rings',
          sortOrder: 1,
          isActive: true,
          isAutoCreate: true,
        },
      },
      {
        id: 'node-col-1',
        type: 'collection',
        x: 40,
        y: 260,
        data: {
          slug: 'bridal-2026',
          name: 'Bridal 2026',
          isActive: true,
          isAutoCreate: true,
        },
      },
      {
        id: 'node-tag-1',
        type: 'tag',
        x: 1140,
        y: 80,
        data: {
          slug: 'bestseller',
          name: 'Bestseller',
          isAutoCreate: true,
        },
      },
      {
        id: 'node-tag-2',
        type: 'tag',
        x: 1140,
        y: 240,
        data: {
          slug: 'handcrafted',
          name: 'Handcrafted',
          isAutoCreate: true,
        },
      },
      {
        id: 'node-media-1',
        type: 'media',
        x: 880,
        y: 80,
        data: {
          fileName: 'solitaire-main.jpg',
          role: 'thumbnail',
          mediaType: 'IMAGE',
        },
      },
      {
        id: 'node-media-2',
        type: 'media',
        x: 880,
        y: 260,
        data: {
          fileName: 'solitaire-detail.jpg',
          role: 'gallery',
          mediaType: 'IMAGE',
          sortOrder: 1,
        },
      },
    ]

    const edges: GraphEdge[] = [
      { id: 'edge-1', source: 'node-brand-1', target: 'node-prod-1', type: 'product-brand' },
      { id: 'edge-2', source: 'node-cat-1', target: 'node-prod-1', type: 'product-category' },
      { id: 'edge-3', source: 'node-col-1', target: 'node-prod-1', type: 'product-collection' },
      { id: 'edge-4', source: 'node-tag-1', target: 'node-prod-1', type: 'product-tag' },
      { id: 'edge-5', source: 'node-tag-2', target: 'node-prod-1', type: 'product-tag' },
      { id: 'edge-6', source: 'node-media-1', target: 'node-prod-1', type: 'product-media' },
      { id: 'edge-7', source: 'node-media-2', target: 'node-prod-1', type: 'product-media' },
    ]

    return {
      id: `graph-${Date.now()}`,
      preset: 'simple',
      name: 'Solitaire Ring Bundle',
      description: 'Single product assembled with brand, category, tags, collection, and media.',
      nodes,
      edges,
      updatedAt: now,
    }
  }

  if (preset === 'variants') {
    const nodes: GraphNode[] = [
      {
        id: 'node-prod-var',
        type: 'product',
        x: 600,
        y: 100,
        data: {
          slug: 'classic-chain-bracelet',
          name: 'Classic Chain Bracelet',
          hasVariants: true,
          shortDescription: 'Sterling silver chain bracelet in multiple sizes.',
          isActive: true,
        },
      },
      {
        id: 'node-brand-v',
        type: 'brand',
        x: 40,
        y: 100,
        data: {
          slug: 'argento',
          name: 'Argento Studio',
          isAutoCreate: true,
        },
      },
      {
        id: 'node-cat-v',
        type: 'category',
        x: 320,
        y: 100,
        data: {
          slug: 'bracelets',
          name: 'Bracelets',
          isAutoCreate: true,
        },
      },
      {
        id: 'node-v1',
        type: 'variant',
        x: 880,
        y: 60,
        data: {
          sku: 'CHAIN-16CM',
          name: 'Silver / 16 cm',
          price: 120,
          stockQuantity: 20,
          isActive: true,
        },
      },
      {
        id: 'node-v2',
        type: 'variant',
        x: 880,
        y: 240,
        data: {
          sku: 'CHAIN-18CM',
          name: 'Silver / 18 cm',
          price: 135,
          stockQuantity: 15,
          isActive: true,
        },
      },
      {
        id: 'node-m-thumb',
        type: 'media',
        x: 880,
        y: 420,
        data: {
          fileName: 'chain-thumb.jpg',
          role: 'thumbnail',
          mediaType: 'IMAGE',
        },
      },
    ]

    const edges: GraphEdge[] = [
      { id: 'edge-v-brand', source: 'node-brand-v', target: 'node-prod-var', type: 'product-brand' },
      { id: 'edge-v-cat', source: 'node-cat-v', target: 'node-prod-var', type: 'product-category' },
      { id: 'edge-v-1', source: 'node-prod-var', target: 'node-v1', type: 'product-variant' },
      { id: 'edge-v-2', source: 'node-prod-var', target: 'node-v2', type: 'product-variant' },
      { id: 'edge-v-m', source: 'node-m-thumb', target: 'node-prod-var', type: 'product-media' },
    ]

    return {
      id: `graph-${Date.now()}`,
      preset: 'variants',
      name: 'Variant Product Workflow',
      description: 'Product assembled with multiple variant combinations.',
      nodes,
      edges,
      updatedAt: now,
    }
  }

  // hierarchy preset: Parent category -> Subcategory -> Product
  const nodes: GraphNode[] = [
    {
      id: 'node-cat-parent',
      type: 'category',
      x: 40,
      y: 100,
      data: {
        slug: 'jewelry',
        name: 'Jewelry',
        isAutoCreate: true,
      },
    },
    {
      id: 'node-cat-child',
      type: 'category',
      x: 320,
      y: 100,
      data: {
        slug: 'necklaces',
        name: 'Necklaces',
        isAutoCreate: true,
      },
    },
    {
      id: 'node-prod-h',
      type: 'product',
      x: 600,
      y: 100,
      data: {
        slug: 'pearl-pendant-necklace',
        name: 'Pearl Pendant Necklace',
        sku: 'PEARL-NCK-01',
        price: 280,
        hasVariants: false,
        isActive: true,
      },
    },
    {
      id: 'node-media-h',
      type: 'media',
      x: 880,
      y: 100,
      data: {
        fileName: 'pearl-necklace.jpg',
        role: 'thumbnail',
        mediaType: 'IMAGE',
      },
    },
  ]

  const edges: GraphEdge[] = [
    { id: 'edge-h-cat', source: 'node-cat-parent', target: 'node-cat-child', type: 'category-parent' },
    { id: 'edge-h-prod', source: 'node-cat-child', target: 'node-prod-h', type: 'product-category' },
    { id: 'edge-h-media', source: 'node-media-h', target: 'node-prod-h', type: 'product-media' },
  ]

  return {
    id: `graph-${Date.now()}`,
    preset: 'hierarchy',
    name: 'Hierarchy Workflow',
    description: 'Hierarchical category tree linked to product.',
    nodes,
    edges,
    updatedAt: now,
  }
}
