import type { CleanRow, ImportDocument, Issue, ResourceKind } from '../core/types'
import { TEMPLATES } from '../templates'

/** What a document is checked against besides itself. */
export interface ValidationContext {
  /** Identifiers of the other documents loaded in the same session (e.g. brands.csv while checking products.csv). */
  pending: Partial<Record<ResourceKind, Set<string>>>
  /** Identifiers that already exist in the store (fetched once per session, see upload/storeIndex.ts). */
  existing: Partial<Record<ResourceKind, Set<string>>>
  /** File names of the images in the image library: what `media:<fileName>` may point at. */
  images: Set<string>
}

export interface ValidationResult {
  issues: Issue[]
  clean: CleanRow[]
  ok: boolean
}

const MEDIA_REFERENCE = /^media:(\S+)$/

/** Every `media:<fileName>` string anywhere in a row, with the field it was found in. */
function mediaReferences(value: unknown, field: string, found: { field: string; key: string }[] = []) {
  if (typeof value === 'string') {
    const match = MEDIA_REFERENCE.exec(value)
    if (match) found.push({ field, key: match[1] })
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => mediaReferences(item, `${field}[${index}]`, found))
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([name, item]) => mediaReferences(item, field ? `${field}.${name}` : name, found))
  }
  return found
}

/**
 * Checks a whole document before anything is sent:
 *  1. every row has its identifier (slug / sku / key) and it is unique in the file;
 *  2. every row matches the template schema (types, lengths, required fields);
 *  3. every reference (brand, categories, product...) points at a row of this import or of the store;
 *  4. every `media:<fileName>` is an image of the library.
 * Rows with an error are left out of `clean`; the rest can still be imported if the user chooses.
 */
export function validateDocument(document: ImportDocument, context: ValidationContext): ValidationResult {
  const template = TEMPLATES[document.template]
  const issues: Issue[] = []
  const clean: CleanRow[] = []
  const seen = new Map<string, number>()
  const ownIds = new Set(document.rows.map((row) => String(row[template.idField] ?? '').trim()).filter(Boolean))

  const known = (target: ResourceKind, id: string) =>
    (target === document.template && ownIds.has(id)) || context.pending[target]?.has(id) || context.existing[target]?.has(id)

  document.rows.forEach((raw, index) => {
    const rowErrors: Issue[] = []
    const id = String(raw[template.idField] ?? '').trim()
    const fail = (message: string, field?: string) => rowErrors.push({ severity: 'error', rowId: id || null, rowIndex: index, field, message })

    if (!id) {
      fail('is required: it identifies the row', template.idField)
    } else if (seen.has(id)) {
      fail(`"${id}" is already used by row ${seen.get(id)! + 1}`, template.idField)
    } else {
      seen.set(id, index)
    }

    const parsed = template.schema.safeParse(raw)
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => fail(issue.message, issue.path.join('.') || undefined))
    } else {
      const values = parsed.data
      for (const rule of template.references) {
        const value = values[rule.field]
        for (const target of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
          if (!known(rule.target, String(target))) fail(`${rule.target} "${String(target)}" is not in this import or in the store`, rule.field)
        }
      }
      for (const { field, key } of mediaReferences(values, '')) {
        if (!context.images.has(key)) fail(`image "${key}" is not in the image library (upload it first)`, field)
      }
      if (rowErrors.length === 0) clean.push({ id, index, values })
    }
    issues.push(...rowErrors)
  })

  return { issues, clean, ok: issues.every((issue) => issue.severity !== 'error') }
}
