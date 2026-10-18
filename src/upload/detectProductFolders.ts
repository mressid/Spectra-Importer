/**
 * The product folders in a drop, for starting a configuration: from the folder layout the importer has always known
 * (`<product>/thumbnail.png`, `<product>/images/…`, `<product>/variants/<variant>/…`) and from the media library layout
 * (`product/<slug>/thumbnail|gallery/…`, `[a, b]/…`). Folders named after a kind (`product/`, `brand/`, `[a, b]/`…) are the library's
 * own structure, not a product, and are never offered as one.
 */
import { getRelativePath, parseStructuredFolder, type StructuredProductFolder } from './folderStructure'
import { parseMediaFolder } from './mediaFolderParser'

const KIND_FOLDERS = new Set(['product', 'products', 'variant', 'variants', 'category', 'categories', 'brand', 'brands', 'collection', 'collections', 'tag', 'tags'])

/** `product`, `brand`… or the multi-name syntax `[a, b]`, `variant[x]`, `*:[a]`: structure, not a product name. */
export const isStructureFolder = (name: string): boolean => KIND_FOLDERS.has(name.toLowerCase()) || /[[\]*:=@]/.test(name)

const titleCase = (text: string): string =>
  text.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim()

/**
 * The folder reader groups by the first folder of `webkitRelativePath` and classifies each file by its path *inside* the product
 * (`thumbnail.png`, `images/a.png`, `variants/<v>/…`). So it is given copies that say both, and the folders it returns are mapped
 * back to the real files, whose library key is the full path.
 */
function readProductLayout(files: File[]): StructuredProductFolder[] {
  const originals = new Map<File, File>()
  const copies = files.flatMap((file) => {
    const parts = pathOf(file).split('/').filter(Boolean)
    if (parts.length < 2) return []
    const copy = new File([file], file.name, { type: file.type })
    Object.defineProperty(copy, 'webkitRelativePath', { value: parts.join('/') })
    Object.defineProperty(copy, 'relativePath', { value: parts.slice(1).join('/') })
    originals.set(copy, file)
    return [copy]
  })
  const back = (file: File | undefined): File | undefined => (file ? originals.get(file) ?? file : file)
  return parseStructuredFolder(copies).products.map((folder) => ({
    ...folder,
    thumbnailFile: back(folder.thumbnailFile),
    galleryFiles: folder.galleryFiles.map((f) => back(f) as File),
    allMediaFiles: folder.allMediaFiles.map((f) => back(f) as File),
    variants: folder.variants.map((v) => ({ ...v, images: v.images.map((f) => back(f) as File) })),
  }))
}

const pathOf = (file: File): string => getRelativePath(file)

export function detectProductFolders(files: File[]): StructuredProductFolder[] {
  const found = new Map<string, StructuredProductFolder>()

  for (const folder of readProductLayout(files)) {
    if (!isStructureFolder(folder.folderName)) found.set(folder.slug, folder)
  }

  // the media library layout: every `product` place with its thumbnail and its gallery in position order
  const parsed = parseMediaFolder(files)
  const byName = new Map<string, { thumbnail?: File; gallery: { file: File; order: number }[] }>()
  for (const asset of parsed.assets) {
    for (const binding of asset.bindings) {
      if (binding.target !== 'product') continue
      const place = byName.get(binding.name) ?? { gallery: [] }
      if (binding.role === 'THUMBNAIL') place.thumbnail = asset.file
      else place.gallery.push({ file: asset.file, order: binding.order })
      byName.set(binding.name, place)
    }
  }
  for (const [name, place] of byName) {
    if (found.has(name) || isStructureFolder(name)) continue
    const gallery = place.gallery.sort((a, b) => a.order - b.order).map((g) => g.file)
    found.set(name, {
      folderName: name,
      slug: name,
      name: titleCase(name),
      thumbnailFile: place.thumbnail,
      galleryFiles: gallery,
      variants: [],
      dataFiles: [],
      allMediaFiles: [...(place.thumbnail ? [place.thumbnail] : []), ...gallery],
    })
  }

  return [...found.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

