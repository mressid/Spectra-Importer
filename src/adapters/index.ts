import type { Adapter, ImportDocument, ResourceKind, SourceFormat } from '../core/types'
import { AdapterError } from '../core/types'
import { csvAdapter } from './csv'
import { jsonAdapter } from './json'
import { yamlAdapter } from './yaml'

export const ADAPTERS: Record<SourceFormat, Adapter> = { json: jsonAdapter, yaml: yamlAdapter, csv: csvAdapter }

export function formatOf(fileName: string): SourceFormat {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  const found = Object.values(ADAPTERS).find((adapter) => adapter.extensions.includes(extension))
  if (!found) throw new AdapterError(`Unsupported file type ".${extension}" (use .json, .yaml, .yml or .csv)`)
  return found.format
}

/** The only entry point the UI uses: any supported file -> ImportDocument. */
export function readImportFile(fileName: string, text: string, template: ResourceKind): ImportDocument {
  return ADAPTERS[formatOf(fileName)].parse(text, template)
}
