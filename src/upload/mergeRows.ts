import type { ImportDocument } from '../core/types'
import { TEMPLATES } from '../templates'

export interface MergedDocument {
  document: ImportDocument
  /** Rows that were not in the document. */
  added: number
  /** Rows that were there (same slug / SKU) and were replaced. */
  replaced: number
}

/** Adds rows to a loaded document: a row with the same identifier (slug, SKU) replaces the old one, the others are appended. */
export function mergeRows(existing: ImportDocument | undefined, incoming: ImportDocument): MergedDocument {
  const idField = TEMPLATES[incoming.template].idField
  const idOf = (row: Record<string, unknown>) => String(row[idField] ?? '').trim()
  const rows = [...(existing?.rows ?? [])]
  let added = 0
  let replaced = 0
  for (const row of incoming.rows) {
    const at = rows.findIndex((r) => idOf(r) !== '' && idOf(r) === idOf(row))
    if (at >= 0) {
      rows[at] = row
      replaced++
    } else {
      rows.push(row)
      added++
    }
  }
  return { document: { template: incoming.template, version: 1, rows }, added, replaced }
}
