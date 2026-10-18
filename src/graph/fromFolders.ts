/**
 * Starts a configuration in the Graph Builder from product folders: a product node per folder, its thumbnail and gallery as media
 * nodes (connected, in order) and its variants as variant nodes. What a folder cannot say (price, brand, categories, tags…) is
 * left to be set on the canvas; the graph's own checks say what is still missing.
 */
import { getRelativePath, isImageFile, type StructuredProductFolder } from '../upload/folderStructure'
import type { ImageLibrary } from '../upload/imageLibrary'
import type { GraphEdge, GraphNode, MediaNode, ProductGraph } from './types'

export interface FolderGraph {
  graph: ProductGraph
  products: number
  media: number
  variants: number
  /** Photos in `variants/<v>/` folders: the graph has no variant images, so they are not part of it. */
  variantPhotos: number
}

const COLUMN = { product: 600, media: 880, variant: 1140 }
const ROW = 250

export function graphFromProductFolders(folders: StructuredProductFolder[], library: ImageLibrary): FolderGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  let y = 60
  let media = 0
  let variants = 0
  let variantPhotos = 0

  folders.forEach((folder, p) => {
    const productId = `node-product-${p}`
    const hasVariants = folder.variants.length > 0
    nodes.push({
      id: productId,
      type: 'product',
      x: COLUMN.product,
      y,
      data: {
        slug: folder.slug,
        name: folder.name,
        isActive: true,
        hasVariants,
        // a simple product needs a SKU and a price: the SKU is suggested, the price is for the user to set
        ...(hasVariants ? {} : { sku: `${folder.slug.toUpperCase()}-01` }),
      },
    })

    const mediaFiles: { file: File; role: 'thumbnail' | 'gallery'; sortOrder?: number }[] = [
      ...(folder.thumbnailFile ? [{ file: folder.thumbnailFile, role: 'thumbnail' as const }] : []),
      ...folder.galleryFiles.map((file, i) => ({ file, role: 'gallery' as const, sortOrder: i + 1 })),
    ]
    mediaFiles.forEach(({ file, role, sortOrder }, m) => {
      const key = getRelativePath(file)
      const mediaId = `node-media-${p}-${m}`
      const node: MediaNode = {
        id: mediaId,
        type: 'media',
        x: COLUMN.media,
        y: y + m * ROW,
        // the library key is what `media:<key>` resolves; the store address is used directly when the file is already uploaded
        data: { fileName: key, url: library.get(key)?.url, mediaType: isImageFile(file.name) ? 'IMAGE' : 'VIDEO', role, sortOrder },
      }
      nodes.push(node)
      edges.push({ id: `edge-${mediaId}`, source: mediaId, target: productId, type: 'product-media' })
      media++
    })

    folder.variants.forEach((variant, v) => {
      const variantId = `node-variant-${p}-${v}`
      nodes.push({
        id: variantId,
        type: 'variant',
        x: COLUMN.variant,
        y: y + v * ROW,
        data: { sku: `${folder.slug.toUpperCase()}-${variant.slug.toUpperCase()}`, name: variant.name, price: 0, isActive: true },
      })
      edges.push({ id: `edge-${variantId}`, source: variantId, target: productId, type: 'product-variant' })
      variants++
      variantPhotos += variant.images.length
    })

    y += Math.max(mediaFiles.length, folder.variants.length, 1) * ROW + 60
  })

  return {
    graph: {
      id: `graph-${Date.now()}`,
      name: folders.length === 1 ? `${folders[0]?.name ?? 'Product'} (from folder)` : `${folders.length} products (from folders)`,
      description: 'Started from dropped folders: set the price, brand, categories and tags, then stage the result for import.',
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
    products: folders.length,
    media,
    variants,
    variantPhotos,
  }
}
