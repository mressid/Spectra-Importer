import { describe, expect, it } from 'vitest'
import {
  generateRowsFromStructuredProduct,
  parseStructuredFolder,
} from './folderStructure'

function createFakeFile(path: string): File {
  const name = path.split('/').pop()!
  const file = new File(['fake-content'], name, { type: 'image/png' })
  Object.defineProperty(file, 'webkitRelativePath', {
    value: path,
    writable: false,
  })
  return file
}

describe('folderStructure', () => {
  it('parses structured product folder with thumbnail, gallery images, and variants', () => {
    const files = [
      createFakeFile('gold-ring/thumbnail.png'),
      createFakeFile('gold-ring/images/front.jpg'),
      createFakeFile('gold-ring/images/side.webp'),
      createFakeFile('gold-ring/variants/size-52/images/ring-52.png'),
      createFakeFile('gold-ring/variants/size-54/images/ring-54.png'),
    ]

    const result = parseStructuredFolder(files)
    expect(result.products).toHaveLength(1)

    const product = result.products[0]
    expect(product.slug).toBe('gold-ring')
    expect(product.name).toBe('Gold Ring')
    expect(product.thumbnailFile?.name).toBe('thumbnail.png')
    expect(product.galleryFiles.map((f) => f.name)).toEqual(['front.jpg', 'side.webp'])
    expect(product.variants).toHaveLength(2)
    expect(product.variants[0].slug).toBe('size-52')
    expect(product.variants[0].images).toHaveLength(1)
    expect(product.variants[1].slug).toBe('size-54')
  })

  it('generates product and variant rows from structured folder', () => {
    const files = [
      createFakeFile('vintage-watch/thumb.jpg'),
      createFakeFile('vintage-watch/images/dial.png'),
      createFakeFile('vintage-watch/variants/leather-strap/images/strap.png'),
    ]

    const result = parseStructuredFolder(files)
    const product = result.products[0]
    const { productRow, variantRows } = generateRowsFromStructuredProduct(product)

    expect(productRow.slug).toBe('vintage-watch')
    expect(productRow.hasVariants).toBe(true)
    expect(productRow.thumbnailUrl).toBe('media:thumb.jpg')
    expect(productRow.images).toEqual(['media:images/dial.png'])

    expect(variantRows).toHaveLength(1)
    expect(variantRows[0].sku).toBe('VINTAGE-WATCH-LEATHER-STRAP')
    expect(variantRows[0].product).toBe('vintage-watch')
    expect(variantRows[0].name).toBe('Leather Strap')
  })
})
