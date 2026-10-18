/**
 * The "download" half of the folder uploader: builds an empty folder skeleton from the rows the user has loaded,
 * laid out exactly as `mediaFolderParser` reads it. The user downloads it, drops the photos into the folders
 * (a thumbnail here, a few gallery shots there) and drops the whole folder back on the Images step: every
 * image is uploaded and bound by name in one go, with no per-image typing.
 *
 *   media-drop/
 *     product/<slug>/thumbnail/    the main image (any file name)
 *     product/<slug>/gallery/      01_front.jpg, 02_back.jpg ... (the number is the order)
 *     variant/<sku>/gallery/
 *     category/<slug>/thumbnail/
 *     brand/<slug>/thumbnail/      the logo
 */
import type { RawRow } from '../core/types'
import { createZip, type ZipEntry } from './zip'

export const FOLDER_TEMPLATE_ROOT = 'media-drop'

export interface FolderTemplateSource {
  products?: RawRow[]
  variants?: RawRow[]
  categories?: RawRow[]
  brands?: RawRow[]
}

export interface FolderTemplate {
  /** Folder paths relative to the root, without a trailing slash, sorted. */
  folders: string[]
  /** Identifiers that cannot be a folder name on every OS, or that the folder syntax would misread. */
  skipped: string[]
  /** True when no rows were given and the folders are placeholders to learn the layout from. */
  isExample: boolean
}

/**
 * What each kind of place gets: the sub-folders its images go in. Only what the store accepts: the media library
 * knows THUMBNAIL and GALLERY, a variant has no thumbnail and a category or brand has no gallery (CatalogMediaTargets.kt).
 */
const SLOTS = {
  product: { idField: 'slug', folders: ['thumbnail', 'gallery'] },
  variant: { idField: 'sku', folders: ['gallery'] },
  category: { idField: 'slug', folders: ['thumbnail'] },
  brand: { idField: 'slug', folders: ['thumbnail'] },
} as const

export type SlotTarget = keyof typeof SLOTS

/** Placeholder names that show the layout when no data file is loaded. */
export const EXAMPLE_ROWS: FolderTemplateSource = {
  products: [{ slug: 'example-product' }],
  variants: [{ sku: 'EXAMPLE-SKU-01' }],
  categories: [{ slug: 'example-category' }],
  brands: [{ slug: 'example-brand' }],
}

/** Characters Windows refuses in a name (macOS and Linux accept a subset of these): `\ / : * ? " < > |` and control codes. */
// eslint-disable-next-line no-control-regex
const WINDOWS_INVALID = /[\\/:*?"<>|\u0000-\u001f]/
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
/** The folder parser reads these as syntax: `[a, b]`, `kind=name`, `name@3`. */
const SYNTAX = /[[\],=@]/

/** True when `name` can be a folder name on Windows, macOS and Linux. */
export function isPortableFolderName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 100 &&
    name !== '.' &&
    name !== '..' &&
    !WINDOWS_INVALID.test(name) &&
    !WINDOWS_RESERVED.test(name) &&
    !/[. ]$/.test(name)
  )
}

function usableName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return isPortableFolderName(name) && !SYNTAX.test(name) ? name : null
}

/** One place that wants photos. `slots` limits the sub-folders (default: all of the kind's); an unknown slot is ignored. */
export interface Place {
  target: SlotTarget
  name: string
  slots?: readonly string[]
}

export function buildFolderTemplateForPlaces(places: Place[]): FolderTemplate {
  const folders = new Set<string>()
  const skipped: string[] = []
  // Windows and macOS treat "Ring-A" and "ring-a" as one folder, which would merge two places
  const seen = new Map<string, string>()

  for (const place of places) {
    const name = usableName(place.name)
    if (!name) {
      if (place.name.trim()) skipped.push(`${place.target}: ${place.name}`)
      continue
    }
    const key = `${place.target}/${name.toLowerCase()}`
    const first = seen.get(key)
    if (first !== undefined && first !== name) {
      skipped.push(`${place.target}: ${name} (same as ${first} on Windows and macOS)`)
      continue
    }
    seen.set(key, name)
    const allowed: readonly string[] = SLOTS[place.target].folders
    for (const slot of place.slots ?? allowed) {
      if (allowed.includes(slot)) folders.add(`${place.target}/${name}/${slot}`)
    }
  }

  return { folders: [...folders].sort(), skipped, isExample: false }
}

export function buildFolderTemplate(source: FolderTemplateSource): FolderTemplate {
  const hasRows = Object.values(source).some((rows) => rows && rows.length > 0)
  const data = hasRows ? source : EXAMPLE_ROWS
  const targets: [SlotTarget, RawRow[] | undefined][] = [
    ['product', data.products],
    ['variant', data.variants],
    ['category', data.categories],
    ['brand', data.brands],
  ]
  const places: Place[] = targets.flatMap(([target, rows]) =>
    (rows ?? []).flatMap((row) => {
      const raw = row[SLOTS[target].idField]
      return typeof raw === 'string' ? [{ target, name: raw }] : []
    }),
  )
  return { ...buildFolderTemplateForPlaces(places), isExample: !hasRows }
}

const README = `HOW TO USE THIS FOLDER
======================

1. Put the photos in the folders. Folder names say where a photo goes; file names are free.
     product/<slug>/thumbnail/   the main photo (one)
     product/<slug>/gallery/     more photos. Start the file name with a number to set the order:
                                 01_front.jpg, 02_back.jpg ... (no number: alphabetical order)
     variant/<sku>/gallery/      photos of one variant
     category/<slug>/thumbnail/  the category image
     brand/<slug>/thumbnail/     the logo
2. Drop the whole "${FOLDER_TEMPLATE_ROOT}" folder on the Images step of the importer.
   Every photo is uploaded once and bound to its place. A place that is not in the store yet is
   reserved and filled when it is created, so you can do this before importing the data files.
3. Empty folders are ignored. Delete the ones you do not need, or leave them.

SHORTCUTS
=========
 * One photo for several places: make a folder named  [ring-a, ring-b]  and put it in there
   (thumbnail/ or gallery/ inside it works the same). Other kinds:  variant[SKU-1, SKU-2]
   Mixed kinds:  [product=ring-a, category=rings]
 * A different position per place:  [ring-a@1, ring-b@3]/gallery/macro.jpg
 * Only letters, digits and - _ [ ] , = @ are used, so the folders work on Windows, macOS and Linux.
 * Do not rename the first folders (product, variant, category, brand): that is how the kind is known.

Limits: images 5 MB (JPEG, PNG, WebP, GIF, AVIF), videos 50 MB (MP4, WebM).
`

/** The skeleton as a ZIP (folders only, plus the instructions). */
export function folderTemplateZip(template: FolderTemplate, now: Date = new Date()): Uint8Array {
  const folders = new Set<string>([FOLDER_TEMPLATE_ROOT])
  for (const folder of template.folders) {
    const parts = folder.split('/')
    for (let i = 1; i <= parts.length; i++) folders.add(`${FOLDER_TEMPLATE_ROOT}/${parts.slice(0, i).join('/')}`)
  }
  const entries: ZipEntry[] = [...folders].sort().map((path) => ({ name: `${path}/` }))
  entries.push({ name: `${FOLDER_TEMPLATE_ROOT}/README.txt`, data: README })
  return createZip(entries, now)
}
