/**
 * The contracts of the whole tool. Every stage only talks to the next one through these types:
 *
 *   file --Adapter--> ImportDocument --validate--> Issue[] --plan--> Operation[] --run--> RunReport
 *
 * See docs/ARCHITECTURE.md.
 */
import type { z } from 'zod'

/** Resources the tool can import. The order here is the order they must be uploaded in (dependencies first). */
export const RESOURCE_KINDS = ['tags', 'brands', 'categories', 'collections', 'products', 'variants'] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export type SourceFormat = 'json' | 'yaml' | 'csv'

/** One record, exactly as written in the file (strings from CSV, typed values from JSON / YAML). */
export type RawRow = Record<string, unknown>

/** The "data as json" every adapter produces. Nothing after the adapters knows the original format. */
export interface ImportDocument {
  template: ResourceKind
  version: 1
  rows: RawRow[]
}

export interface Adapter {
  format: SourceFormat
  /** File extensions without the dot, lower case. */
  extensions: string[]
  /** Throws AdapterError (with line number when known) when the text cannot be read at all. */
  parse(text: string, template: ResourceKind): ImportDocument
}

export class AdapterError extends Error {
  readonly line?: number
  constructor(message: string, line?: number) {
    super(message)
    this.line = line
  }
}

export interface Issue {
  severity: 'error' | 'warning'
  /** Value of the row's identifier field (slug, sku or key); null when the row has none. */
  rowId: string | null
  /** 0-based position in ImportDocument.rows, for "row 12" messages (add 1, plus 1 for the CSV header). */
  rowIndex: number
  field?: string
  message: string
}

/** An image already uploaded to the store and kept in the tool's library. Rows refer to it as `media:<fileName>`. */
export interface LibraryImage {
  /** Exactly as the file was named when dropped, e.g. "ring-gold-1.jpg". The reference key. */
  fileName: string
  /** Public address returned by the store; this replaces `media:<fileName>` in the data. */
  url: string
  mediaType: 'IMAGE' | 'VIDEO'
  width: number | null
  height: number | null
  sizeBytes: number
  /** The store already had this exact file; nothing new was stored. */
  duplicate: boolean
  uploadedAt: string
  /** Backend ID from POST /api/v1/admin/uploads, used to bind media to targets. */
  id?: string | number
}

/** A reference from one row to a row of another template, e.g. product.brand -> brands.slug. */
export interface ReferenceRule {
  /** Field of this template, a string or a list of strings. */
  field: string
  /** Template the value must be found in: in the same import or already in the store. */
  target: ResourceKind
}

export interface TemplateDefinition {
  kind: ResourceKind
  title: string
  /** Field that identifies a row: "slug", "sku" or "key". Required, unique inside one file. */
  idField: string
  /** Templates whose rows may be referenced; they are uploaded first. */
  dependsOn: ResourceKind[]
  references: ReferenceRule[]
  /** Single source of truth for the shape of a row. Also coerces CSV strings (see templates/fields.ts). */
  schema: z.ZodType<Record<string, unknown>>
  /** Store endpoint that creates one record. */
  endpoint: string
}

/** Rows that passed validation, with their values converted by the schema. */
export interface CleanRow {
  id: string
  index: number
  values: Record<string, unknown>
}

/** What to do when a record with the same identifier already exists in the store. */
export type ConflictMode = 'skip' | 'update'

/** One call to the store API, ready to send. The plan is a list of these in a safe order. */
export interface Operation {
  /** `${template}:${rowId}`, or `${template}:${rowId}:images` for a sub-call such as a product's gallery. */
  key: string
  template: ResourceKind
  rowId: string
  /** Human text for the progress list: "Create product ring-gold". */
  label: string
  method: 'POST' | 'PUT'
  /** May contain placeholders like {products:ring-gold}, filled with the ids the store returned earlier. */
  path: string
  body?: unknown
  /** Keys of operations that must succeed first. */
  after: string[]
}

export type OperationStatus = 'pending' | 'running' | 'created' | 'updated' | 'skipped' | 'failed' | 'blocked'

export interface OperationResult {
  key: string
  status: OperationStatus
  /** Id the store gave the record (needed by later operations). */
  storeId?: string
  /** HTTP status and message of the failure, as the store reported them. */
  error?: { status: number; message: string; fieldErrors?: string[] }
}

export interface RunReport {
  startedAt: string
  finishedAt: string
  results: OperationResult[]
}
