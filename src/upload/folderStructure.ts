import type { RawRow } from '../core/types'

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.avif'] as const
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg'] as const
export const SUPPORTED_MEDIA_EXTENSIONS = [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS] as const

export function isMediaFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return SUPPORTED_MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function isImageFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function getRelativePath(file: File): string {
  if ('relativePath' in file && typeof file.relativePath === 'string' && file.relativePath) {
    return file.relativePath
  }
  if (file.webkitRelativePath) {
    const parts = file.webkitRelativePath.split('/')
    if (parts.length > 1) {
      return parts.slice(1).join('/')
    }
    return file.webkitRelativePath
  }
  return file.name
}

export interface StructuredVariantAssets {
  slug: string
  name: string
  images: File[]
}

export interface StructuredProductFolder {
  folderName: string
  slug: string
  name: string
  thumbnailFile?: File
  galleryFiles: File[]
  variants: StructuredVariantAssets[]
  dataFiles: File[]
  allMediaFiles: File[]
}

export interface StructuredFolderResult {
  products: StructuredProductFolder[]
  standaloneMedia: File[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCase(text: string): string {
  return text
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

/**
 * Parses files selected from a folder structure:
 *  - folder/thumbnail.png (or jpg, webp, etc.)
 *  - folder/images/*.png (gallery images)
 *  - folder/variants/{var1}/images/*.png (variant images)
 */
export function parseStructuredFolder(files: File[]): StructuredFolderResult {
  // Group files by root product folder
  const productFolders = new Map<string, File[]>()
  const standalone: File[] = []

  for (const file of files) {
    const fullPath = file.webkitRelativePath || ('relativePath' in file ? String(file.relativePath) : file.name)
    const parts = fullPath.split('/').filter(Boolean)

    if (parts.length <= 1) {
      if (isMediaFile(file.name)) {
        standalone.push(file)
      }
      continue
    }

    const rootFolder = parts[0]
    if (!productFolders.has(rootFolder)) {
      productFolders.set(rootFolder, [])
    }
    productFolders.get(rootFolder)!.push(file)
  }

  const products: StructuredProductFolder[] = []

  for (const [folderName, folderFiles] of productFolders) {
    let thumbnailFile: File | undefined
    const galleryFiles: File[] = []
    const variantsMap = new Map<string, File[]>()
    const dataFiles: File[] = []
    const allMediaFiles: File[] = []

    for (const file of folderFiles) {
      const relPath = getRelativePath(file)
      const parts = relPath.toLowerCase().split('/')
      const fileNameLower = file.name.toLowerCase()

      if (fileNameLower.endsWith('.json') || fileNameLower.endsWith('.yaml') || fileNameLower.endsWith('.yml') || fileNameLower.endsWith('.csv')) {
        dataFiles.push(file)
        continue
      }

      if (!isMediaFile(file.name)) continue

      allMediaFiles.push(file)

      // Check if it's thumbnail (e.g. thumbnail.png, thumb.jpg, cover.png at root of folder)
      if (parts.length === 1 && (fileNameLower.startsWith('thumbnail.') || fileNameLower.startsWith('thumb.') || fileNameLower.startsWith('cover.') || fileNameLower.startsWith('main.'))) {
        thumbnailFile = file
        continue
      }

      // Check if under variants/{variantName}/...
      const variantIdx = parts.indexOf('variants')
      if (variantIdx !== -1 && variantIdx + 1 < parts.length) {
        const variantSlug = parts[variantIdx + 1]
        if (!variantsMap.has(variantSlug)) {
          variantsMap.set(variantSlug, [])
        }
        variantsMap.get(variantSlug)!.push(file)
        continue
      }

      // Check if under images/ or gallery/
      if (parts.includes('images') || parts.includes('gallery') || parts.includes('photos')) {
        galleryFiles.push(file)
        continue
      }

      // If top-level single image and no thumbnail yet
      if (parts.length === 1 && !thumbnailFile && isImageFile(file.name)) {
        thumbnailFile = file
        continue
      }

      // Default: gallery image
      galleryFiles.push(file)
    }

    // If still no thumbnail, pick the first gallery image or first media
    if (!thumbnailFile && galleryFiles.length > 0) {
      thumbnailFile = galleryFiles.shift()
    } else if (!thumbnailFile && allMediaFiles.length > 0) {
      thumbnailFile = allMediaFiles[0]
    }

    const variants: StructuredVariantAssets[] = Array.from(variantsMap.entries()).map(([slug, imgs]) => ({
      slug,
      name: titleCase(slug),
      images: imgs,
    }))

    const productSlug = slugify(folderName) || 'imported-product'

    products.push({
      folderName,
      slug: productSlug,
      name: titleCase(folderName),
      thumbnailFile,
      galleryFiles,
      variants,
      dataFiles,
      allMediaFiles,
    })
  }

  return { products, standaloneMedia: standalone }
}

/**
 * Creates CleanRow or RawRow for products and variants from a structured folder.
 */
export function generateRowsFromStructuredProduct(product: StructuredProductFolder): {
  productRow: RawRow
  variantRows: RawRow[]
} {
  const thumbKey = product.thumbnailFile ? `media:${getRelativePath(product.thumbnailFile)}` : ''
  const galleryKeys = product.galleryFiles.map((f) => `media:${getRelativePath(f)}`)
  const hasVariants = product.variants.length > 0

  const productRow: RawRow = {
    slug: product.slug,
    name: product.name,
    thumbnailUrl: thumbKey,
    hasVariants,
    images: galleryKeys,
    isActive: true,
  }

  if (!hasVariants) {
    productRow.sku = `${product.slug.toUpperCase()}-01`
    productRow.price = 10.0
  }

  const variantRows: RawRow[] = product.variants.map((v, idx) => ({
    sku: `${product.slug.toUpperCase()}-${v.slug.toUpperCase()}`,
    product: product.slug,
    name: v.name,
    price: 10.0,
    isActive: true,
    sortOrder: idx,
  }))

  return { productRow, variantRows }
}
