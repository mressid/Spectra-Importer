/** Binds uploaded files to the places their folder path names (PUT /admin/media/bindings), one call per file, and says what happened. */
import { StoreApiError, setMediaBindings, type MediaBindingStatusDto } from './api'
import type { ImageLibrary } from './imageLibrary'
import type { ParsedMediaAsset } from './mediaFolderParser'

export interface BindReport {
  /** Keyed by the uploaded file's id and by its relative path. */
  statuses: Map<string, MediaBindingStatusDto[]>
  /** Bindings whose place exists: the image is set now. */
  applied: number
  /** Bindings whose place does not exist yet: reserved, attached when it is created. */
  waiting: number
  /** Files the store refused to bind, with its message. */
  failed: { fileName: string; message: string }[]
}

const describe = (error: unknown): string =>
  error instanceof StoreApiError ? [error.message, ...error.fieldErrors].join(': ') : (error as Error).message

/** Files that were not uploaded (no id in the library) are left out: their upload error is already reported. */
export async function bindAssets(
  assets: ParsedMediaAsset[],
  library: ImageLibrary,
  bind: typeof setMediaBindings = setMediaBindings,
): Promise<BindReport> {
  const report: BindReport = { statuses: new Map(), applied: 0, waiting: 0, failed: [] }
  for (const asset of assets) {
    if (asset.bindings.length === 0) continue
    const image = library.get(asset.relativePath) ?? library.get(asset.fileName)
    if (!image?.id) continue
    try {
      const statuses = await bind({ uploadedFileId: image.id, bindings: asset.bindings })
      report.statuses.set(String(image.id), statuses)
      report.statuses.set(asset.relativePath, statuses)
      for (const status of statuses) {
        if (status.status === 'APPLIED') report.applied++
        else if (status.status === 'WAITING') report.waiting++
      }
    } catch (error) {
      report.failed.push({ fileName: asset.relativePath, message: describe(error) })
    }
  }
  return report
}
