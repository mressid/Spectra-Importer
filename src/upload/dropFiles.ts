/**
 * Reads what was dropped (files, or whole folders) into File objects that carry their `relativePath` inside the folder.
 * Folders are read the way browsers want it: `readEntries` hands back a directory in batches (Chromium: 100 at a time) and
 * must be called until it answers with an empty list, otherwise everything past the first batch is silently lost.
 * Whatever cannot be read is reported in `errors` instead of being skipped quietly.
 */

export interface DroppedFiles {
  files: File[]
  /** One message per file or folder that could not be read. */
  errors: string[]
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries((entries) => resolve(Array.from(entries)), reject))
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  for (;;) {
    const batch = await readBatch(reader)
    if (batch.length === 0) return all
    all.push(...batch)
  }
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : (error as { name?: string } | null)?.name || 'unreadable')

async function walk(entry: FileSystemEntry, path: string, out: DroppedFiles): Promise<void> {
  const here = path ? `${path}/${entry.name}` : entry.name
  try {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
      Object.defineProperty(file, 'relativePath', { value: here, writable: false })
      out.files.push(file)
    } else if (entry.isDirectory) {
      for (const child of await readAllEntries((entry as FileSystemDirectoryEntry).createReader())) {
        await walk(child, here, out)
      }
    }
  } catch (error) {
    out.errors.push(`Could not read "${here}": ${reason(error)}`)
  }
}

/**
 * Call it straight from the drop event handler: the entries are taken before the first `await`, because the browser empties the
 * DataTransfer as soon as the handler returns to the event loop.
 */
export async function readDroppedFiles(transfer: DataTransfer): Promise<DroppedFiles> {
  const entries = Array.from(transfer.items ?? [])
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null)
  const plainFiles = Array.from(transfer.files ?? [])

  const out: DroppedFiles = { files: [], errors: [] }
  if (entries.length === 0) {
    out.files.push(...plainFiles)
    return out
  }
  for (const entry of entries) await walk(entry, '', out)
  return out
}

/** True when the drag carries files (not text or a link): only then does the page take the drop. */
export function dragHasFiles(transfer: DataTransfer | null): boolean {
  return Array.from(transfer?.types ?? []).includes('Files')
}

/** Folder names that belong *inside* a product folder: if a dropped root only has these, the root is itself the product. */
const INSIDE_PRODUCT = /^(thumbnail|thumb|cover|main|hero|logo|icon|avatar|images|gallery|photos|slides|banner|header|swatch|color|variants)/i

const fullPath = (file: File): string => file.webkitRelativePath || (file as File & { relativePath?: string }).relativePath || file.name

/**
 * Settles what the dropped root folder is, once, for everything after it (review, upload, detection):
 *  - a root that holds product folders (`legacy/gold-ring/…`, `shop/product/ring-a/…`) is a container: it is dropped from the paths,
 *    so a picked folder and a dragged folder give the same paths and the container is never taken for a product;
 *  - a root that only holds product layout (`gold-ring/thumbnail.png`, `gold-ring/images/…`) is the product itself: it stays.
 * Returns copies that carry the settled path as `relativePath` (the bytes are shared, nothing is read or duplicated).
 */
export function normalizeDropRoot(files: File[]): File[] {
  const roots = new Map<string, Set<string>>()
  for (const file of files) {
    const parts = fullPath(file).split('/').filter(Boolean)
    if (parts.length < 2) continue
    const children = roots.get(parts[0] as string) ?? new Set<string>()
    // a file straight inside the root says nothing: only sub-folders show what the root is
    if (parts.length >= 3) children.add(parts[1] as string)
    roots.set(parts[0] as string, children)
  }
  const container = (root: string): boolean => {
    const children = roots.get(root)
    return children !== undefined && children.size > 0 && ![...children].every((name) => INSIDE_PRODUCT.test(name))
  }
  return files.map((file) => {
    const path = fullPath(file)
    const parts = path.split('/').filter(Boolean)
    const settled = parts.length >= 2 && container(parts[0] as string) ? parts.slice(1).join('/') : path
    const copy = new File([file], file.name, { type: file.type, lastModified: file.lastModified })
    Object.defineProperty(copy, 'relativePath', { value: settled, writable: false })
    return copy
  })
}
