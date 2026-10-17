import { parse } from 'yaml'
import type { Adapter } from '../core/types'
import { AdapterError } from '../core/types'
import { toDocument } from './document'

export const yamlAdapter: Adapter = {
  format: 'yaml',
  extensions: ['yaml', 'yml'],
  parse(text, template) {
    try {
      return toDocument(parse(text), template)
    } catch (error) {
      if (error instanceof AdapterError) throw error
      const line = (error as { linePos?: { line: number }[] }).linePos?.[0]?.line
      throw new AdapterError(`Invalid YAML: ${(error as Error).message}`, line)
    }
  },
}
