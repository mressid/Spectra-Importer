/**
 * The registry of templates: schema + rules + the documentation and example files shown to the user.
 * To add a template: schema in schemas/, one entry below, a folder in /templates (see docs/TEMPLATES.md).
 */
import type { ResourceKind, TemplateDefinition } from '../core/types'
import { brandRow, categoryRow, collectionRow, tagRow } from './schemas/catalog'
import { productRow, variantRow } from './schemas/product'

export const TEMPLATES: Record<ResourceKind, TemplateDefinition> = {
  tags: { kind: 'tags', title: 'Tags', idField: 'slug', dependsOn: [], references: [], schema: tagRow, endpoint: '/api/v1/tags' },
  brands: { kind: 'brands', title: 'Brands', idField: 'slug', dependsOn: [], references: [], schema: brandRow, endpoint: '/api/v1/brands' },
  categories: {
    kind: 'categories', title: 'Categories', idField: 'slug', dependsOn: [],
    references: [{ field: 'parent', target: 'categories' }], schema: categoryRow, endpoint: '/api/v1/categories',
  },
  collections: { kind: 'collections', title: 'Collections', idField: 'slug', dependsOn: [], references: [], schema: collectionRow, endpoint: '/api/v1/collections' },
  products: {
    kind: 'products', title: 'Products', idField: 'slug', dependsOn: ['brands', 'categories', 'tags', 'collections'],
    references: [
      { field: 'brand', target: 'brands' },
      { field: 'categories', target: 'categories' },
      { field: 'tags', target: 'tags' },
      { field: 'collections', target: 'collections' },
    ],
    schema: productRow as never, endpoint: '/api/v1/products',
  },
  variants: {
    kind: 'variants', title: 'Product variants', idField: 'sku', dependsOn: ['products'],
    references: [{ field: 'product', target: 'products' }], schema: variantRow, endpoint: '/api/v1/variants',
  },
}
