import type { UploadOutcome } from './imageLibrary'

export interface FailureGroup {
  message: string
  files: string[]
}

/** Failed uploads grouped by the store's message, so 40 files that are too large make one message, not 40. */
export function groupFailures(outcomes: UploadOutcome[]): FailureGroup[] {
  const groups = new Map<string, string[]>()
  for (const outcome of outcomes) {
    if (outcome.ok) continue
    const files = groups.get(outcome.error) ?? []
    files.push(outcome.fileName)
    groups.set(outcome.error, files)
  }
  return [...groups].map(([message, files]) => ({ message, files }))
}

const baseName = (path: string) => path.split('/').pop() ?? path

/** "3 files were not uploaded: Image too large (a.png, b.png and 1 more)" */
export function describeFailure(group: FailureGroup): string {
  const names = group.files.map(baseName)
  const shown = names.slice(0, 2).join(', ')
  const more = names.length > 2 ? ` and ${names.length - 2} more` : ''
  return names.length === 1 ? `${names[0]} was not uploaded: ${group.message}` : `${names.length} files were not uploaded: ${group.message} (${shown}${more})`
}

const DATA_EXTENSIONS = ['.csv', '.json', '.yaml', '.yml']

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/** A "file" with no extension, no type and a folder-like size: what a browser gives for a folder it did not open. */
const looksLikeFolder = (file: File): boolean => extensionOf(file.name) === '' && file.type === '' && (file.size === 0 || file.size % 4096 === 0)

/**
 * The message for a drop that has no image or video: says what was in it, so the user can tell a wrong folder from a broken drop,
 * and where data files and unopened folders should go instead.
 */
export function describeNoMedia(dropped: File[]): string {
  const total = `${dropped.length} dropped file${dropped.length === 1 ? '' : 's'}`
  const folders = dropped.filter(looksLikeFolder)
  if (folders.length === dropped.length) {
    return `The browser gave ${total === '1 dropped file' ? 'a folder' : 'folders'} it could not open (${dropped.slice(0, 3).map((f) => f.name).join(', ')}). Use "Select Structured Folder" in the upload panel instead.`
  }
  const counts = new Map<string, number>()
  for (const file of dropped) counts.set(extensionOf(file.name) || 'no extension', (counts.get(extensionOf(file.name) || 'no extension') ?? 0) + 1)
  const found = [...counts].slice(0, 5).map(([ext, n]) => (n > 1 ? `${ext} ×${n}` : ext)).join(', ') + (counts.size > 5 ? ', …' : '')
  const hasData = dropped.some((file) => DATA_EXTENSIONS.includes(extensionOf(file.name)))
  return (
    `No image or video among the ${total} (found: ${found}). The store takes JPEG, PNG, WebP, GIF, AVIF, MP4 and WebM.` +
    (hasData ? ' Data files (csv, json, yaml) are loaded in the Files step, not here.' : '')
  )
}
