import { describe, expect, it } from 'vitest'
import type { LibraryImage } from '../core/types'
import type { StructuredProductFolder } from '../upload/folderStructure'
import { bundleGraph } from './bundler'
import { graphFromProductFolders } from './fromFolders'

function file(path: string): File {
  const f = new File(['x'], path.split('/').pop() ?? path)
  Object.defineProperty(f, 'relativePath', { value: path })
  return f
}

function folder(slug: string, parts: Partial<StructuredProductFolder> = {}): StructuredProductFolder {
  return {
    folderName: slug,
    slug,
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    galleryFiles: [],
    variants: [],
    dataFiles: [],
    allMediaFiles: [],
    ...parts,
  }
}

const library = (entries: Record<string, string> = {}) =>
  new Map(Object.entries(entries).map(([key, url]) => [key, { url } as unknown as LibraryImage]))

describe('graphFromProductFolders', () => {
  it('makes a product with its thumbnail and gallery connected as media nodes, in order', () => {
    const { graph, products, media } = graphFromProductFolders(
      [folder('gold-ring', { thumbnailFile: file('gold-ring/cover.png'), galleryFiles: [file('gold-ring/images/a.png'), file('gold-ring/images/b.png')] })],
      library(),
    )
    expect(products).toBe(1)
    expect(media).toBe(3)
    const mediaNodes = graph.nodes.filter((n) => n.type === 'media')
    expect(mediaNodes.map((n) => (n.data as { role?: string; sortOrder?: number }).role)).toEqual(['thumbnail', 'gallery', 'gallery'])
    expect(mediaNodes.map((n) => (n.data as { sortOrder?: number }).sortOrder)).toEqual([undefined, 1, 2])
    expect(graph.edges.filter((e) => e.type === 'product-media')).toHaveLength(3)
    expect(graph.edges.every((e) => graph.nodes.some((n) => n.id === e.source) && graph.nodes.some((n) => n.id === e.target))).toBe(true)
  })

  it('uses the store address of a photo that is already uploaded, else its library key', () => {
    const { graph } = graphFromProductFolders([folder('p', { thumbnailFile: file('p/cover.png'), galleryFiles: [file('p/images/a.png')] })], library({ 'p/cover.png': 'http://store/cover.png' }))
    const data = graph.nodes.filter((n) => n.type === 'media').map((n) => n.data as { fileName: string; url?: string })
    expect(data).toEqual([expect.objectContaining({ fileName: 'p/cover.png', url: 'http://store/cover.png' }), expect.objectContaining({ fileName: 'p/images/a.png', url: undefined })])
  })

  it('places variants and says how many variant photos the graph cannot hold', () => {
    const { graph, variants, variantPhotos } = graphFromProductFolders(
      [folder('chain', { variants: [{ slug: 'small', name: 'Small', images: [file('chain/variants/small/1.png'), file('chain/variants/small/2.png')] }, { slug: 'large', name: 'Large', images: [] }] })],
      library(),
    )
    expect(variants).toBe(2)
    expect(variantPhotos).toBe(2)
    const skus = graph.nodes.filter((n) => n.type === 'variant').map((n) => (n.data as { sku: string }).sku)
    expect(skus).toEqual(['CHAIN-SMALL', 'CHAIN-LARGE'])
    const product = graph.nodes.find((n) => n.type === 'product')
    if (!product) throw new Error('a product node is expected')
    expect((product.data as { hasVariants: boolean }).hasVariants).toBe(true)
    expect(graph.edges.filter((e) => e.type === 'product-variant')).toHaveLength(2)
  })

  it('stacks several products without overlapping their nodes', () => {
    const { graph } = graphFromProductFolders(
      [folder('a', { thumbnailFile: file('a/t.png'), galleryFiles: [file('a/1.png'), file('a/2.png')] }), folder('b', { thumbnailFile: file('b/t.png') })],
      library(),
    )
    const [a, b] = graph.nodes.filter((n) => n.type === 'product')
    if (!a || !b) throw new Error('two products expected')
    // the first product has three photos: the second starts below them
    expect(b.y).toBeGreaterThan(a.y + 3 * 250 - 1)
    const positions = graph.nodes.map((n) => `${n.x},${n.y}`)
    expect(new Set(positions).size).toBe(positions.length)
  })

  it('what the folder cannot say is left for the canvas: the graph checks say what is missing', () => {
    const { graph } = graphFromProductFolders([folder('gold-ring', { thumbnailFile: file('gold-ring/cover.png') })], library())
    const result = bundleGraph(graph)
    // the photo is there, the price is not
    expect(result.issues).toEqual(['Simple product "gold-ring" requires a price.'])
    const row = result.documents.products?.rows[0]
    expect(row).toMatchObject({ slug: 'gold-ring', thumbnailUrl: 'media:gold-ring/cover.png', sku: 'GOLD-RING-01' })
  })

  it('a variant without a price is flagged', () => {
    const { graph } = graphFromProductFolders([folder('chain', { thumbnailFile: file('chain/c.png'), variants: [{ slug: 's', name: 'S', images: [] }] })], library())
    expect(bundleGraph(graph).issues).toEqual(['Variant "CHAIN-S" has no price yet.'])
  })
})
