import type { ImportDocument, ResourceKind } from '../core/types'
import { AdapterError } from '../core/types'

/**
 * Shared by the adapters. Accepts the two shapes a file may have:
 *   [ {...}, {...} ]                       just the rows
 *   { template?: "...", rows: [ {...} ] }  the full ImportDocument
 */
export function toDocument(parsed: unknown, template: ResourceKind): ImportDocument {
  const rows = Array.isArray(parsed) ? parsed : (parsed as { rows?: unknown } | null)?.rows
  if (!Array.isArray(rows)) throw new AdapterError('Expected a list of rows, or an object with a "rows" list')
  const declared = (parsed as { template?: unknown } | null)?.template
  if (!Array.isArray(parsed) && declared !== undefined && declared !== template) {
    throw new AdapterError(`This file is for "${String(declared)}", not "${template}"`)
  }
  rows.forEach((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new AdapterError(`Row ${index + 1} is not an object`)
  })
  return { template, version: 1, rows: rows as Record<string, unknown>[] }
}
