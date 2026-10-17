import type { Adapter } from '../core/types'
import { AdapterError } from '../core/types'
import { toDocument } from './document'

export const jsonAdapter: Adapter = {
  format: 'json',
  extensions: ['json'],
  parse(text, template) {
    try {
      return toDocument(JSON.parse(text), template)
    } catch (error) {
      if (error instanceof AdapterError) throw error
      throw new AdapterError(`Invalid JSON: ${(error as Error).message}`)
    }
  },
}
