import { describe, expect, it } from 'vitest'
import { buildFolderTemplate, buildFolderTemplateForPlaces, EXAMPLE_ROWS, folderTemplateZip, FOLDER_TEMPLATE_ROOT, isPortableFolderName } from './folderTemplate'
import { parseMediaFolder } from './mediaFolderParser'
import { crc32, createZip } from './zip'

function fileAt(relativePath: string): File {
  const file = new File(['x'], relativePath.split('/').pop() ?? '', { type: 'image/jpeg' })
  Object.defineProperty(file, 'relativePath', { value: relativePath })
  return file
}

const source = {
  products: [{ slug: 'ring-a' }, { slug: 'ring-b' }],
  variants: [{ sku: 'RING-A-52' }],
  categories: [{ slug: 'rings' }],
  brands: [{ slug: 'aurum' }],
}

describe('buildFolderTemplate', () => {
  it('makes the slot folders for every row', () => {
    const { folders, skipped, isExample } = buildFolderTemplate(source)
    expect(isExample).toBe(false)
    expect(skipped).toEqual([])
    expect(folders).toEqual([
      'brand/aurum/thumbnail',
      'category/rings/thumbnail',
      'product/ring-a/gallery',
      'product/ring-a/thumbnail',
      'product/ring-b/gallery',
      'product/ring-b/thumbnail',
      'variant/RING-A-52/gallery',
    ])
  })

  it('falls back to an example layout when nothing is loaded', () => {
    const { folders, isExample } = buildFolderTemplate({})
    expect(isExample).toBe(true)
    expect(folders).toContain('product/example-product/thumbnail')
  })

  it('skips, and reports, names that cannot be a folder or would be read as syntax', () => {
    const { folders, skipped } = buildFolderTemplate({
      products: [{ slug: 'ok' }, { slug: 'a/b' }, { slug: 'x:y' }, { slug: 'a@1' }, { slug: 'con' }, { slug: 'end.' }, { slug: '  ' }, { slug: 42 }, { slug: 'ok' }],
    })
    expect(folders).toEqual(['product/ok/gallery', 'product/ok/thumbnail'])
    expect(skipped).toEqual(['product: a/b', 'product: x:y', 'product: a@1', 'product: con', 'product: end.'])
  })

  it('skips a name that differs only by case from an earlier one', () => {
    const { folders, skipped } = buildFolderTemplate({ variants: [{ sku: 'SKU-1' }, { sku: 'sku-1' }] })
    expect(folders).toEqual(['variant/SKU-1/gallery'])
    expect(skipped).toEqual(['variant: sku-1 (same as SKU-1 on Windows and macOS)'])
  })

  it('only makes folder names that are valid on Windows, macOS and Linux', () => {
    for (const folder of buildFolderTemplate(source).folders) {
      for (const part of folder.split('/')) expect(isPortableFolderName(part), part).toBe(true)
    }
  })

  it('produces folders that the parser reads back as the same places and roles', () => {
    const { folders } = buildFolderTemplate(source)
    const fill: Record<string, string> = {
      'product/ring-a/thumbnail': 'IMG_0001.jpg',
      'product/ring-a/gallery': '02_back.jpg',
      'variant/RING-A-52/gallery': 'macro.jpg',
      'category/rings/thumbnail': 'rings.jpg',
      'brand/aurum/thumbnail': 'logo.png',
    }
    const files = folders.filter((f) => fill[f]).map((f) => fileAt(`${FOLDER_TEMPLATE_ROOT}/${f}/${fill[f]}`))
    const bindings = parseMediaFolder(files).assets.flatMap((a) => a.bindings.map(({ target, name, role, order }) => ({ target, name, role, order })))
    expect(bindings).toEqual([
      { target: 'brand', name: 'aurum', role: 'THUMBNAIL', order: 1 },
      { target: 'category', name: 'rings', role: 'THUMBNAIL', order: 1 },
      { target: 'product', name: 'ring-a', role: 'GALLERY', order: 2 },
      { target: 'product', name: 'ring-a', role: 'THUMBNAIL', order: 1 },
      { target: 'variant', name: 'RING-A-52', role: 'GALLERY', order: 1 },
    ])
  })
})

describe('example layout per kind', () => {
  it('gives every kind a placeholder layout, so there is a template to download even with no data loaded', () => {
    expect(buildFolderTemplate({ products: EXAMPLE_ROWS.products }).folders).toEqual(['product/example-product/gallery', 'product/example-product/thumbnail'])
    expect(buildFolderTemplate({ variants: EXAMPLE_ROWS.variants }).folders).toEqual(['variant/EXAMPLE-SKU-01/gallery'])
    expect(buildFolderTemplate({ categories: EXAMPLE_ROWS.categories }).folders).toEqual(['category/example-category/thumbnail'])
    expect(buildFolderTemplate({ brands: EXAMPLE_ROWS.brands }).folders).toEqual(['brand/example-brand/thumbnail'])
  })
})

describe('buildFolderTemplateForPlaces', () => {
  it('only makes the sub-folders asked for and valid for the kind', () => {
    const { folders } = buildFolderTemplateForPlaces([
      { target: 'product', name: 'ring-b', slots: ['gallery'] },
      { target: 'brand', name: 'argent', slots: ['thumbnail'] },
      { target: 'variant', name: 'RING-B-1', slots: ['thumbnail', 'gallery'] }, // a variant has no thumbnail
    ])
    expect(folders).toEqual(['brand/argent/thumbnail', 'product/ring-b/gallery', 'variant/RING-B-1/gallery'])
  })
})

describe('isPortableFolderName', () => {
  it('rejects what Windows rejects', () => {
    for (const bad of ['a:b', '*', 'a?', 'a"b', 'a<b', 'a|b', 'a\\b', 'a/b', 'nul', 'COM1', 'name.', 'name ', '']) {
      expect(isPortableFolderName(bad), bad).toBe(false)
    }
  })

  it('accepts the folder syntax of the importer', () => {
    for (const good of ['[ring-a, ring-b]', 'variant[SKU-1,SKU-2]', '[product=ring-a, category=rings@2]', '4x5', 'order-3', 'solitaire-gold']) {
      expect(isPortableFolderName(good), good).toBe(true)
    }
  })
})

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('writes a well-formed archive with folder entries and a text file', () => {
    const bytes = createZip([{ name: 'a/' }, { name: 'a/hello.txt', data: 'héllo' }], new Date(2026, 9, 18, 10, 30, 0))
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const end = bytes.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2) // entries
    const centralOffset = view.getUint32(end + 16, true)
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)
  })

  it('puts the root folder, every parent folder and the instructions in the template zip', () => {
    const bytes = folderTemplateZip(buildFolderTemplate(source))
    const text = new TextDecoder().decode(bytes)
    for (const name of ['media-drop/', 'media-drop/product/', 'media-drop/product/ring-a/gallery/', 'media-drop/README.txt']) {
      expect(text).toContain(name)
    }
  })
})
