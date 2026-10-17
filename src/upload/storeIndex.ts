import type { ResourceKind } from '../core/types'

/**
 * TODO (docs/TASKS.md #1). Reads what already exists in the store, so references to existing brands /
 * categories / tags / collections / products validate, and so re-running an import can skip or update.
 *
 * Returns, per template, a map identifier -> store id (slug -> uuid; sku -> uuid for variants).
 * Use the public GET list endpoints (/api/v1/brands, /categories, /tags, /collections, /products): they
 * return a Page; read every page (size up to 200). Variants: GET /api/v1/variants?productId=...
 */
export async function loadStoreIndex(): Promise<Partial<Record<ResourceKind, Map<string, string>>>> {
  throw new Error('TODO: loadStoreIndex (docs/TASKS.md #1)')
}
