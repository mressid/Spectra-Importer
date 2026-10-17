import Papa from 'papaparse'
import type { Adapter } from '../core/types'
import { AdapterError } from '../core/types'
import { toDocument } from './document'

/**
 * CSV: first line = column names (same names as the JSON fields), one row per line, UTF-8,
 * comma or semicolon (auto-detected, Excel in French writes semicolons).
 * Every cell stays a string; empty cells are left out. Lists ("a|b") and numbers are converted by the
 * template schema (templates/fields.ts), not here.
 *
 * TODO(next): nested columns with dots, e.g. "defaultVariant.price" -> { defaultVariant: { price } },
 * only if a template needs it (none does today: the product schema is flat on purpose).
 */
export const csvAdapter: Adapter = {
  format: 'csv',
  extensions: ['csv'],
  parse(text, template) {
    const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
    })
    if (result.errors.length > 0) {
      const first = result.errors[0]
      throw new AdapterError(`Invalid CSV: ${first.message}`, first.row === undefined ? undefined : first.row + 2)
    }
    const rows = result.data.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined && String(value).trim() !== '')))
    return toDocument(rows, template)
  },
}
