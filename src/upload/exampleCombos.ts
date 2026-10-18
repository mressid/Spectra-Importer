/**
 * The four documented folder combinations (examples/media-folders), bundled so the Images step can hand each one to the
 * user as a ZIP: the folder tree, its sample photos and its README. Add a folder under examples/media-folders and it
 * shows up here; give it a title and a line in COMBO_INFO.
 */
import { createZip, withParentFolders, type ZipEntry } from './zip'

const PREFIX = '/examples/media-folders/'

/** Every file of the examples, as the address the bundler serves it from. */
const FILES = import.meta.glob('/examples/media-folders/**/*', { query: '?url', import: 'default', eager: true }) as Record<string, string>

const COMBO_INFO: Record<string, { title: string; description: string }> = {
  '01-one-place-per-folder': {
    title: 'One place per folder',
    description: 'product, variant, category and brand, each with its own photos',
  },
  '02-one-photo-many-places': {
    title: 'One photo, many places',
    description: '[a, b] shares one photo between products, categories or variants',
  },
  '03-gallery-order-and-ratio': {
    title: 'Gallery order and ratio',
    description: 'order from folders, file names or @, and 4x5 ratio folders',
  },
  '04-whole-shop': {
    title: 'The whole shop in one drop',
    description: 'brand, categories, products, variants and a shared photo',
  },
}

export interface ExampleCombo {
  /** Folder name, also the root folder of the ZIP. */
  id: string
  title: string
  description: string
  /** Paths inside the combo folder (`product/ring-a/thumbnail/cover.png`) and where to fetch them. */
  files: { path: string; url: string }[]
}

function listCombos(files: Record<string, string>): ExampleCombo[] {
  const combos = new Map<string, ExampleCombo>()
  for (const [key, url] of Object.entries(files)) {
    if (!key.startsWith(PREFIX)) continue
    const [id, ...rest] = key.slice(PREFIX.length).split('/')
    if (rest.length === 0) continue // the README of the whole examples folder
    const info = COMBO_INFO[id] ?? { title: id, description: '' }
    const combo = combos.get(id) ?? { id, ...info, files: [] }
    combo.files.push({ path: rest.join('/'), url })
    combos.set(id, combo)
  }
  return [...combos.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export const EXAMPLE_COMBOS: ExampleCombo[] = listCombos(FILES)

/** The combo as a ZIP: `<id>/README.md`, `<id>/product/...`. Drop the extracted `<id>` folder on the Images step. */
export async function exampleComboZip(combo: ExampleCombo, fetchFile: (url: string) => Promise<ArrayBuffer> = defaultFetch): Promise<Uint8Array> {
  const entries: ZipEntry[] = await Promise.all(
    combo.files.map(async ({ path, url }) => ({ name: `${combo.id}/${path}`, data: new Uint8Array(await fetchFile(url)) })),
  )
  return createZip(withParentFolders(entries))
}

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not read ${url} (${response.status})`)
  return response.arrayBuffer()
}
