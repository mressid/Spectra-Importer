/**
 * The image library: images (and short videos) uploaded to the store from this tool, kept by file name.
 *
 * The store only returns a URL for an upload (and recognises an identical file by its hash), it does not
 * remember file names. So this tool keeps the name -> URL table, in the browser (localStorage) so a page
 * reload or a second session does not lose it. Dropping the same files again is harmless: the store answers
 * with the existing URL (`duplicate: true`).
 *
 * Data files refer to a library image as `media:<fileName>`, e.g. `thumbnailUrl: media:ring-gold-1.jpg`.
 * The planner replaces it with `url`. Validation checks the name is in the library.
 */
import type { LibraryImage } from '../core/types'
import { uploadFile, type UploadedFile } from './api'
import { getRelativePath } from './folderStructure'

export type ImageLibrary = Map<string, LibraryImage>

const STORAGE_KEY = 'store-importer.image-library'
const CONCURRENCY = 3

export function loadLibrary(storage: Pick<Storage, 'getItem'> = localStorage): ImageLibrary {
  try {
    const images = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as LibraryImage[]
    return new Map(images.map((image) => [image.fileName, image]))
  } catch {
    return new Map()
  }
}

export function saveLibrary(library: ImageLibrary, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...library.values()]))
  } catch {
    // storage full or blocked: the library still works for this session
  }
}

export type UploadOutcome =
  | { fileName: string; ok: true; image: LibraryImage; replaced: boolean }
  | { fileName: string; ok: false; error: string }

export interface AddOptions {
  /** Defaults to the store upload; tests pass a fake. */
  upload?: (file: Blob, name: string) => Promise<UploadedFile>
  signal?: AbortSignal
  /** Called after each file, for the progress bar. */
  onProgress?: (done: number, total: number, outcome: UploadOutcome) => void
}

/**
 * Uploads the files and records them in `library` (mutated). One bad file never stops the others:
 * its outcome carries the store's message (too large, not an image...). Two files with the same name in
 * one drop are refused (the reference would be ambiguous).
 */
export async function addToLibrary(files: File[], library: ImageLibrary, options: AddOptions = {}): Promise<UploadOutcome[]> {
  const upload = options.upload ?? uploadFile
  const outcomes: UploadOutcome[] = new Array(files.length)
  const names = new Set<string>()
  let next = 0
  let done = 0

  const finish = (index: number, outcome: UploadOutcome) => {
    outcomes[index] = outcome
    options.onProgress?.(++done, files.length, outcome)
  }

  async function worker() {
    while (next < files.length && !options.signal?.aborted) {
      const index = next++
      const file = files[index]
      const fileKey = getRelativePath(file)
      if (names.has(fileKey)) {
        finish(index, { fileName: fileKey, ok: false, error: 'Another file with this name is in the same drop' })
        continue
      }
      names.add(fileKey)
      try {
        const uploaded = await upload(file, file.name)
        const image: LibraryImage = {
          fileName: fileKey,
          url: uploaded.url,
          mediaType: uploaded.mediaType,
          width: uploaded.width,
          height: uploaded.height,
          sizeBytes: uploaded.sizeBytes,
          duplicate: uploaded.duplicate,
          uploadedAt: new Date().toISOString(),
        }
        const replaced = library.has(fileKey)
        library.set(fileKey, image)
        finish(index, { fileName: fileKey, ok: true, image, replaced })
      } catch (error) {
        finish(index, { fileName: fileKey, ok: false, error: (error as Error).message })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))
  saveLibrary(library)
  return outcomes.filter(Boolean)
}

/** Names the validator accepts after `media:`. */
export const libraryNames = (library: ImageLibrary): Set<string> => {
  const set = new Set<string>()
  for (const [k] of library) {
    set.add(k)
    // Also include basename so either media:images/foo.jpg or media:foo.jpg validates
    const base = k.split('/').pop()
    if (base) set.add(base)
  }
  return set
}

/** `media:ring.jpg` -> its url; anything else (a normal address) is returned unchanged. null when the image is not in the library. */
export function resolveMedia(value: string, library: ImageLibrary): string | null {
  if (!value.startsWith('media:')) return value
  const key = value.slice('media:'.length)
  const exact = library.get(key)
  if (exact) return exact.url

  // Check matching by relative path or basename
  for (const [k, img] of library) {
    if (k.endsWith(`/${key}`) || k.split('/').pop() === key) {
      return img.url
    }
  }

  return null
}
