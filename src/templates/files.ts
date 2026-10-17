import type { ResourceKind, SourceFormat } from '../core/types'

/** The files in /templates, bundled as text: the UI offers them as downloads and shows the README of each. */
const raw = import.meta.glob('/templates/*/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const templateDoc = (kind: ResourceKind): string => raw[`/templates/${kind}/README.md`] ?? ''

export const templateExample = (kind: ResourceKind, format: SourceFormat): string =>
  raw[`/templates/${kind}/${kind}.${format === 'yaml' ? 'yaml' : format}`] ?? ''
