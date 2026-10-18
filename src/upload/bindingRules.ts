/**
 * What the store's media library refuses, so it can be said before anything is uploaded (the rules of the shop's
 * CatalogMediaTargets.kt): a thumbnail is one image (position 1) and a variant has none; a category or brand has a single
 * image and no gallery; only two roles exist.
 */
import type { MediaBinding } from './mediaFolderParser'

export const STORE_KINDS = ['product', 'variant', 'category', 'brand'] as const
export type StoreKind = (typeof STORE_KINDS)[number]

export const isStoreKind = (value: string): value is StoreKind => (STORE_KINDS as readonly string[]).includes(value)

const MB = 1024 * 1024
/** What the store accepts, with its size limit per file. */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']
const VIDEO_EXTENSIONS = ['.mp4', '.webm']
export const ACCEPTED_FORMATS = 'JPEG, PNG, WebP, GIF, AVIF, MP4 and WebM'

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase()
}

export function storeMediaType(fileName: string): 'IMAGE' | 'VIDEO' | null {
  const ext = extensionOf(fileName)
  if (IMAGE_EXTENSIONS.includes(ext)) return 'IMAGE'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'VIDEO'
  return null
}

/** Why this file cannot be stored (format or size), or null. */
export function fileProblem(file: File): string | null {
  const type = storeMediaType(file.name)
  if (!type) return `${extensionOf(file.name) || 'this format'} is not accepted by the store (${ACCEPTED_FORMATS})`
  const limit = type === 'IMAGE' ? 5 * MB : 50 * MB
  if (file.size > limit) return `${(file.size / MB).toFixed(1)} MB is over the store's ${limit / MB} MB limit for ${type === 'IMAGE' ? 'images' : 'videos'}`
  return null
}

/** Why the store would refuse this binding, or null. */
export function bindingProblem(binding: MediaBinding, mediaType: 'IMAGE' | 'VIDEO'): string | null {
  const place = `${binding.target} "${binding.name}"`
  if (!isStoreKind(binding.target)) return `unknown kind "${binding.target}" (use ${STORE_KINDS.join(', ')})`
  if (binding.role === 'THUMBNAIL') {
    if (binding.target === 'variant') return `${place}: a variant has no thumbnail, put the photo in gallery/`
    if (mediaType !== 'IMAGE') return `${place}: a thumbnail must be an image`
  } else if (binding.target === 'category' || binding.target === 'brand') {
    return `${place}: a ${binding.target} has a single image, put the photo in thumbnail/`
  }
  return null
}
