/**
 * Images that are already in the store but wait for their product, variant, category or brand to be created
 * (uploaded and bound by slug or SKU before the data was imported). This groups them by place and compares them
 * with the data files loaded in the tool, so the user can see what an import will pick up and what has no row.
 */
import Papa from 'papaparse'
import type { ImportDocument, ResourceKind } from '../core/types'
import { TEMPLATES } from '../templates'
import { templateExample } from '../templates/files'
import type { SlotTarget } from './folderTemplate'
import type { WaitingMedia } from './api'

export const WAITING_TARGETS: readonly SlotTarget[] = ['product', 'variant', 'category', 'brand']

/** The data file that creates each kind of place. */
export const TEMPLATE_OF: Record<SlotTarget, ResourceKind> = {
  product: 'products',
  variant: 'variants',
  category: 'categories',
  brand: 'brands',
}

export interface WaitingPlace {
  target: SlotTarget
  /** Slug, or SKU for a variant. */
  name: string
  thumbnail: WaitingMedia | null
  gallery: WaitingMedia[]
  /** A row of a loaded data file has this name: importing it attaches these images. */
  inFiles: boolean
}

/** Names of the rows in the loaded data files, per kind of place. */
export type KnownNames = Partial<Record<SlotTarget, ReadonlySet<string>>>

export function knownNames(documents: Partial<Record<ResourceKind, ImportDocument | undefined>>): KnownNames {
  const known: KnownNames = {}
  for (const target of WAITING_TARGETS) {
    const document = documents[TEMPLATE_OF[target]]
    if (!document) continue
    const idField = TEMPLATES[document.template].idField
    known[target] = new Set(document.rows.map((row) => String(row[idField] ?? '').trim()).filter(Boolean))
  }
  return known
}

const isTarget = (value: string): value is SlotTarget => (WAITING_TARGETS as readonly string[]).includes(value)

/** One entry per place, sorted by kind then name; the gallery is in position order. */
export function groupWaiting(items: WaitingMedia[], known: KnownNames = {}): WaitingPlace[] {
  const places = new Map<string, WaitingPlace>()
  for (const item of items) {
    const target = item.target.toLowerCase()
    if (!isTarget(target)) continue
    const key = `${target}/${item.name}`
    const place = places.get(key) ?? { target, name: item.name, thumbnail: null, gallery: [], inFiles: known[target]?.has(item.name) ?? false }
    if (item.role === 'THUMBNAIL') place.thumbnail = item
    else place.gallery.push(item)
    places.set(key, place)
  }
  for (const place of places.values()) place.gallery.sort((a, b) => a.order - b.order)
  const rank = (target: SlotTarget) => WAITING_TARGETS.indexOf(target)
  return [...places.values()].sort((a, b) => rank(a.target) - rank(b.target) || a.name.localeCompare(b.name))
}

/** Product slugs that have a thumbnail waiting: their `thumbnailUrl` may be left empty in the data file. */
export function reservedThumbnailSlugs(items: WaitingMedia[]): Set<string> {
  return new Set(items.filter((i) => i.target.toLowerCase() === 'product' && i.role === 'THUMBNAIL').map((i) => i.name))
}

/** Waiting names a data file does not have a row for yet, per kind. */
export function withoutRow(places: WaitingPlace[], target: SlotTarget): WaitingPlace[] {
  return places.filter((place) => place.target === target && !place.inFiles)
}

/**
 * A CSV for the kind's data file with one row per waiting name and the template's columns, so the user only fills in
 * the rest (name, price...). Images need no column: they are attached by the name when the row is created.
 */
export function waitingDataCsv(target: SlotTarget, names: string[]): string {
  const kind = TEMPLATE_OF[target]
  const fields = (Papa.parse<string[]>(templateExample(kind, 'csv').split(/\r?\n/)[0]).data[0] ?? []).filter(Boolean)
  const idField = TEMPLATES[kind].idField
  const rows = names.map((name) => fields.map((field) => (field === idField ? name : '')))
  return Papa.unparse({ fields, data: rows })
}
