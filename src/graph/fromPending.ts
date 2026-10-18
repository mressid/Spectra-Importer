/**
 * Assembles pending images in the graph: the product (or variant, category, brand) a set of images is waiting for becomes a node
 * named by what the images were bound to, and a product's images become media nodes connected to it. Those images are already bound
 * by name in the store and are attached when the product is created, so their nodes are marked `reserved`: they show on the canvas
 * but are not written into the product row (which would attach them twice). The rest of the product is left to be set there.
 */
import { slugToTitle } from '../validate/references'
import type { WaitingPlace } from '../upload/waitingMedia'
import type { GraphEdge, GraphNode, ProductGraph } from './types'

export interface PendingGraph {
  graph: ProductGraph
  products: number
  variants: number
  categories: number
  brands: number
  /** Photos shown as reserved nodes (a product's). */
  photos: number
  /** Photos of variants, categories and brands: the graph has no node for them, the store attaches them when the record is created. */
  otherPhotos: number
}

const ROW = 250

export function graphFromPending(places: WaitingPlace[]): PendingGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const result = { products: 0, variants: 0, categories: 0, brands: 0, photos: 0, otherPhotos: 0 }
  const column = { brand: 40, category: 320, product: 600, media: 880, variant: 1140 }
  const slot = { brand: 60, category: 60, variant: 60 }
  let productY = 60

  for (const place of places) {
    const images = [place.thumbnail, ...place.gallery].filter((m) => m !== null)
    switch (place.target) {
      case 'product': {
        const productId = `node-product-${place.name}`
        nodes.push({
          id: productId,
          type: 'product',
          x: column.product,
          y: productY,
          data: { slug: place.name, name: slugToTitle(place.name), isActive: true, hasVariants: false, sku: `${place.name.toUpperCase()}-01` },
        })
        images.forEach((image, i) => {
          const label = image.role === 'THUMBNAIL' ? 'thumbnail' : `gallery-${image.order}`
          const mediaId = `node-media-${place.name}-${label}`
          nodes.push({
            id: mediaId,
            type: 'media',
            x: column.media,
            y: productY + i * ROW,
            data: {
              fileName: `${place.name}/${label}`,
              url: image.url,
              mediaType: image.mediaType,
              role: image.role === 'THUMBNAIL' ? 'thumbnail' : 'gallery',
              sortOrder: image.role === 'THUMBNAIL' ? undefined : image.order,
              reserved: true,
            },
          })
          edges.push({ id: `edge-${mediaId}`, source: mediaId, target: productId, type: 'product-media' })
          result.photos++
        })
        productY += Math.max(images.length, 1) * ROW + 60
        result.products++
        break
      }
      case 'variant':
        nodes.push({ id: `node-variant-${place.name}`, type: 'variant', x: column.variant, y: slot.variant, data: { sku: place.name, name: place.name, price: 0, isActive: true } })
        slot.variant += ROW
        result.variants++
        result.otherPhotos += images.length
        break
      case 'category':
        nodes.push({ id: `node-category-${place.name}`, type: 'category', x: column.category, y: slot.category, data: { slug: place.name, name: slugToTitle(place.name), isActive: true, isAutoCreate: false } })
        slot.category += ROW
        result.categories++
        result.otherPhotos += images.length
        break
      case 'brand':
        nodes.push({ id: `node-brand-${place.name}`, type: 'brand', x: column.brand, y: slot.brand, data: { slug: place.name, name: slugToTitle(place.name), isAutoCreate: false } })
        slot.brand += ROW
        result.brands++
        result.otherPhotos += images.length
        break
    }
  }

  return {
    graph: {
      id: `graph-${Date.now()}`,
      name: places.length === 1 ? `${places[0]?.name ?? 'Pending'} (pending images)` : `${places.length} places (pending images)`,
      description: 'Assembled from images that wait for their product: set the details here; the images are attached when it is created.',
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
    ...result,
  }
}
