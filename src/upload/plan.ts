import type { CleanRow, ConflictMode, Operation, ResourceKind } from '../core/types'
import type { ImageLibrary } from './imageLibrary'

/**
 * STEP 3 (TODO, see docs/TASKS.md #2). Turns validated rows into the API calls that create them.
 *
 * Contract:
 *  - one `toOperations` per template, in a map keyed by ResourceKind (mapping table in docs/ARCHITECTURE.md);
 *  - the result is sorted so a dependency always comes first (RESOURCE_KINDS order, then file order);
 *  - references to other rows are NOT resolved here: write placeholders such as "{brands:acme}" in path/body,
 *    the runner replaces them with the id the store returned (or the id found by `loadStoreIndex`);
 *  - images ARE resolved here: `media:<fileName>` becomes the library url (resolveMedia in imageLibrary.ts), they
 *    were uploaded before the plan exists, so no upload operation is ever part of a plan;
 *  - products.images: one `POST /api/v1/media` {productId, url, mediaType: "IMAGE", sortOrder: position, isPrimary: false}
 *    per image, after the product (key `products:<slug>:images:<n>`, `after` the product);
 *  - pure function, no network: it must be unit-testable with plain objects.
 */
export interface PlanInput {
  template: ResourceKind
  rows: CleanRow[]
  onConflict: ConflictMode
  /** Images of the library, to turn `media:<fileName>` into urls. */
  library: ImageLibrary
}

export function buildPlan(_inputs: PlanInput[]): Operation[] {
  throw new Error('TODO: buildPlan (docs/TASKS.md #2)')
}
