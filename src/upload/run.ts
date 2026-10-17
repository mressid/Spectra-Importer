import type { Operation, OperationResult, RunReport } from '../core/types'

/**
 * STEP 4 (TODO, see docs/TASKS.md #3). Executes a plan against the store.
 *
 * Contract:
 *  - runs operations in order, with a small concurrency (e.g. 3) only between operations whose `after` is done;
 *  - after each POST keep `data.id` (storeId) and fill the placeholders of later operations;
 *  - an operation whose dependency failed is `blocked`, never sent;
 *  - one failure never stops the others; the 4xx / 5xx message and field errors go in the result as the store sent them;
 *  - calls `onProgress` after every change so the UI can show a live list;
 *  - must be cancellable (AbortSignal) and safe to run twice (conflict mode: see lookup by identifier below).
 */
export interface RunOptions {
  signal?: AbortSignal
  onProgress?: (results: OperationResult[]) => void
}

export async function runPlan(_plan: Operation[], _options: RunOptions): Promise<RunReport> {
  throw new Error('TODO: runPlan (docs/TASKS.md #3)')
}
