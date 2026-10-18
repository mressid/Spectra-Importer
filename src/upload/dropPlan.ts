/**
 * What a drop will do, worked out before anything is sent: every photo with the places it goes to, what the store would
 * refuse (and why), which places already exist in the store and which will only be reserved, slots two photos fight for.
 * Pure: the review screen (DropPreview) shows it and "Upload" applies it.
 */
import { isMediaFile } from './folderStructure'
import { bindingProblem, fileProblem, isStoreKind, storeMediaType, type StoreKind } from './bindingRules'
import { parseMediaFolder, type MediaBinding } from './mediaFolderParser'

export interface PlanFile {
  file: File
  /** Path inside the dropped folder. */
  relPath: string
  fileName: string
  mediaType: 'IMAGE' | 'VIDEO'
  bindings: MediaBinding[]
  /** From a folder like 4x5/; informational, the store does not keep it. */
  aspectRatio?: string
  /** What the store would refuse. Empty = it will be uploaded. */
  problems: string[]
  ready: boolean
}

/** Does the place exist in the store (the image is set at once) or will it be reserved until it is created. */
export type PlaceStatus = 'in-store' | 'not-in-store' | 'unknown'

export interface PlanImage {
  file: PlanFile
  role: MediaBinding['role']
  order: number
}

export interface PlanPlace {
  target: string
  name: string
  status: PlaceStatus
  /** A row of a loaded data file has this name. */
  inFiles: boolean
  images: PlanImage[]
}

export interface DropPlan {
  files: PlanFile[]
  places: PlanPlace[]
  /** Dropped files that are not photos or videos at all (README, data files...). */
  ignored: File[]
  warnings: string[]
  totals: {
    files: number
    ready: number
    /** Files the store would refuse: not uploaded. */
    skipped: number
    /** Bindings of the files that will be uploaded. */
    bindings: number
    /** Places of the files that will be uploaded, per kind. */
    places: Record<string, number>
    /** Of those places: how many exist in the store, and how many will be reserved. */
    inStore: number
    reserved: number
  }
}

export interface PlanContext {
  /** Names that exist in the store per kind; a kind that is missing is "unknown". */
  existing?: Partial<Record<StoreKind, ReadonlySet<string>>>
  /** Names that have a row in the loaded data files per kind. */
  inFiles?: Partial<Record<StoreKind, ReadonlySet<string>>>
}

export function buildDropPlan(dropped: File[], context: PlanContext = {}): DropPlan {
  const media = dropped.filter((file) => isMediaFile(file.name))
  const ignored = dropped.filter((file) => !isMediaFile(file.name))
  const parsed = parseMediaFolder(media)

  const files: PlanFile[] = parsed.assets.map((asset) => {
    const problems = [fileProblem(asset.file), ...asset.bindings.map((b) => bindingProblem(b, asset.mediaType))].filter((p): p is string => p !== null)
    return {
      file: asset.file,
      relPath: asset.relativePath,
      fileName: asset.fileName,
      mediaType: storeMediaType(asset.fileName) ?? asset.mediaType,
      bindings: asset.bindings,
      aspectRatio: asset.explicitAspectRatio,
      problems,
      ready: problems.length === 0,
    }
  })

  const places = new Map<string, PlanPlace>()
  for (const file of files) {
    for (const binding of file.bindings) {
      const key = `${binding.target}/${binding.name}`
      let place = places.get(key)
      if (!place) {
        const set = isStoreKind(binding.target) ? context.existing?.[binding.target] : undefined
        place = {
          target: binding.target,
          name: binding.name,
          status: set ? (set.has(binding.name) ? 'in-store' : 'not-in-store') : 'unknown',
          inFiles: isStoreKind(binding.target) ? (context.inFiles?.[binding.target]?.has(binding.name) ?? false) : false,
          images: [],
        }
        places.set(key, place)
      }
      place.images.push({ file, role: binding.role, order: binding.order })
    }
  }
  const kindRank = (target: string) => (isStoreKind(target) ? ['product', 'variant', 'category', 'brand'].indexOf(target) : 9)
  const placeList = [...places.values()].sort((a, b) => kindRank(a.target) - kindRank(b.target) || a.name.localeCompare(b.name))
  for (const place of placeList) place.images.sort((a, b) => (a.role === b.role ? a.order - b.order : a.role === 'THUMBNAIL' ? -1 : 1))

  // two photos for one slot: only one of them stays, and uploads run in parallel, so which one is not predictable
  const warnings: string[] = []
  for (const place of placeList) {
    const bySlot = new Map<string, PlanImage[]>()
    for (const image of place.images.filter((i) => i.file.ready)) {
      const slot = `${image.role}#${image.order}`
      bySlot.set(slot, [...(bySlot.get(slot) ?? []), image])
    }
    for (const [slot, images] of bySlot) {
      const distinct = new Set(images.map((i) => i.file.relPath))
      if (distinct.size > 1) {
        const [role, order] = slot.split('#')
        warnings.push(`${place.target} "${place.name}" ${role?.toLowerCase()} #${order} is claimed by ${[...distinct].slice(0, 3).join(', ')}${distinct.size > 3 ? ' and more' : ''}: only one of them stays`)
      }
    }
  }

  const readyFiles = files.filter((f) => f.ready)
  const readyPlaces = placeList.filter((p) => p.images.some((i) => i.file.ready))
  const byKind: Record<string, number> = {}
  for (const place of readyPlaces) byKind[place.target] = (byKind[place.target] ?? 0) + 1

  return {
    files,
    places: placeList,
    ignored,
    warnings,
    totals: {
      files: files.length,
      ready: readyFiles.length,
      skipped: files.length - readyFiles.length,
      bindings: readyFiles.reduce((sum, f) => sum + f.bindings.length, 0),
      places: byKind,
      inStore: readyPlaces.filter((p) => p.status === 'in-store').length,
      reserved: readyPlaces.filter((p) => p.status === 'not-in-store').length,
    },
  }
}

