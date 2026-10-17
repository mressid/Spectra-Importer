import type { CleanRow, ConflictMode, Operation, ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { resolveMedia, type ImageLibrary } from './imageLibrary'

export interface PlanInput {
  template: ResourceKind
  rows: CleanRow[]
  onConflict: ConflictMode
  /** Images of the library, to turn `media:<fileName>` into urls. */
  library: ImageLibrary
}

/**
 * Topologically sorts categories parent-first.
 * If a cycle is detected, falls back to the original order without crashing.
 */
function sortCategoriesParentFirst(rows: CleanRow[]): CleanRow[] {
  const result: CleanRow[] = []
  const remaining = new Map(rows.map((row) => [row.id, row]))
  const visited = new Set<string>()

  let progress = true
  while (remaining.size > 0 && progress) {
    progress = false
    for (const [id, row] of remaining) {
      const parent = String(row.values.parent ?? '').trim()
      // Can be emitted if it has no parent, parent is not in this document, or parent is already emitted
      if (!parent || !remaining.has(parent) || visited.has(parent)) {
        result.push(row)
        visited.add(id)
        remaining.delete(id)
        progress = true
      }
    }
  }

  // If there's a cycle, append the rest in their original order
  if (remaining.size > 0) {
    for (const row of remaining.values()) {
      result.push(row)
    }
  }

  return result
}

/**
 * Turns validated rows into ordered API calls (Operations).
 */
export function buildPlan(inputs: PlanInput[]): Operation[] {
  const inputByKind = new Map<ResourceKind, PlanInput>()
  for (const input of inputs) {
    inputByKind.set(input.template, input)
  }

  const allKeys = new Set<string>()
  const rawOps: Operation[] = []

  // Pre-collect row keys to know what is part of this plan
  for (const input of inputs) {
    for (const row of input.rows) {
      allKeys.add(`${input.template}:${row.id}`)
    }
  }

  for (const kind of RESOURCE_KINDS) {
    const input = inputByKind.get(kind)
    if (!input || input.rows.length === 0) continue

    const { rows, library } = input

    switch (kind) {
      case 'tags': {
        for (const row of rows) {
          rawOps.push({
            key: `tags:${row.id}`,
            template: 'tags',
            rowId: row.id,
            label: `Create tag "${row.values.name ?? row.id}"`,
            method: 'POST',
            path: '/api/v1/tags',
            body: { slug: row.id, name: row.values.name },
            after: [],
          })
        }
        break
      }

      case 'brands': {
        for (const row of rows) {
          const logo = row.values.logoUrl ? resolveMedia(String(row.values.logoUrl), library) : null
          rawOps.push({
            key: `brands:${row.id}`,
            template: 'brands',
            rowId: row.id,
            label: `Create brand "${row.values.name ?? row.id}"`,
            method: 'POST',
            path: '/api/v1/brands',
            body: {
              slug: row.id,
              name: row.values.name,
              website: row.values.website,
              country: row.values.country,
              logoUrl: logo,
            },
            after: [],
          })
        }
        break
      }

      case 'categories': {
        const sorted = sortCategoriesParentFirst(rows)
        for (const row of sorted) {
          const parentSlug = String(row.values.parent ?? '').trim()
          const parentKey = parentSlug ? `categories:${parentSlug}` : null
          const img = row.values.imageUrl ? resolveMedia(String(row.values.imageUrl), library) : null

          rawOps.push({
            key: `categories:${row.id}`,
            template: 'categories',
            rowId: row.id,
            label: `Create category "${row.values.name ?? row.id}"`,
            method: 'POST',
            path: '/api/v1/categories',
            body: {
              slug: row.id,
              name: row.values.name,
              parentId: parentKey ? `{${parentKey}}` : null,
              sortOrder: row.values.sortOrder ?? 0,
              isActive: row.values.isActive ?? true,
              seoTitle: row.values.seoTitle,
              seoDescription: row.values.seoDescription,
              imageUrl: img,
            },
            after: parentKey && allKeys.has(parentKey) ? [parentKey] : [],
          })
        }
        break
      }

      case 'collections': {
        for (const row of rows) {
          rawOps.push({
            key: `collections:${row.id}`,
            template: 'collections',
            rowId: row.id,
            label: `Create collection "${row.values.name ?? row.id}"`,
            method: 'POST',
            path: '/api/v1/collections',
            body: {
              slug: row.id,
              name: row.values.name,
              description: row.values.description,
              startAt: row.values.startAt,
              endAt: row.values.endAt,
              isActive: row.values.isActive ?? true,
            },
            after: [],
          })
        }
        break
      }

      case 'products': {
        for (const row of rows) {
          const prodKey = `products:${row.id}`
          const brandSlug = String(row.values.brand ?? '').trim()
          const brandKey = brandSlug ? `brands:${brandSlug}` : null
          const thumb = row.values.thumbnailUrl ? resolveMedia(String(row.values.thumbnailUrl), library) : null

          const contentBlocks = Array.isArray(row.values.contentBlocks)
            ? row.values.contentBlocks.map((b: Record<string, unknown>) => ({
                ...b,
                url: b.url ? resolveMedia(String(b.url), library) : undefined,
              }))
            : []

          const hasVariants = Boolean(row.values.hasVariants)
          const defaultVariant = hasVariants
            ? null
            : {
                sku: row.values.sku,
                price: row.values.price,
                barcode: row.values.barcode,
                compareAtPrice: row.values.compareAtPrice,
                weightGrams: row.values.weightGrams ?? 0,
                stockQuantity: row.values.stockQuantity,
                availability: row.values.availability ?? 'AUTO',
                leadTimeDays: row.values.leadTimeDays,
              }

          const productAfter = brandKey && allKeys.has(brandKey) ? [brandKey] : []

          rawOps.push({
            key: prodKey,
            template: 'products',
            rowId: row.id,
            label: `Create product "${row.values.name ?? row.id}"`,
            method: 'POST',
            path: '/api/v1/products',
            body: {
              name: row.values.name,
              slug: row.id,
              thumbnailUrl: thumb,
              brandId: brandKey ? `{${brandKey}}` : null,
              shortDescription: row.values.shortDescription,
              description: row.values.description,
              descriptionFormat: row.values.descriptionFormat ?? 'MARKDOWN',
              seoTitle: row.values.seoTitle,
              seoDescription: row.values.seoDescription,
              contentBlocks,
              isActive: row.values.isActive ?? true,
              allowPersonalization: row.values.allowPersonalization ?? false,
              personalizationInstructions: row.values.personalizationInstructions,
              hasVariants,
              defaultVariant,
            },
            after: productAfter,
          })

          // Sub-calls: categories
          const categories = (row.values.categories as string[]) ?? []
          for (const cat of categories) {
            const catKey = `categories:${cat}`
            const after = allKeys.has(catKey) ? [prodKey, catKey] : [prodKey]
            rawOps.push({
              key: `${prodKey}:category:${cat}`,
              template: 'products',
              rowId: row.id,
              label: `Link product "${row.id}" to category "${cat}"`,
              method: 'POST',
              path: `/api/v1/products/{${prodKey}}/categories/{${catKey}}`,
              after,
            })
          }

          // Sub-calls: tags
          const tags = (row.values.tags as string[]) ?? []
          for (const tag of tags) {
            const tagKey = `tags:${tag}`
            const after = allKeys.has(tagKey) ? [prodKey, tagKey] : [prodKey]
            rawOps.push({
              key: `${prodKey}:tag:${tag}`,
              template: 'products',
              rowId: row.id,
              label: `Link product "${row.id}" to tag "${tag}"`,
              method: 'POST',
              path: `/api/v1/products/{${prodKey}}/tags/{${tagKey}}`,
              after,
            })
          }

          // Sub-calls: collections
          const collections = (row.values.collections as string[]) ?? []
          for (const col of collections) {
            const colKey = `collections:${col}`
            const after = allKeys.has(colKey) ? [prodKey, colKey] : [prodKey]
            rawOps.push({
              key: `${prodKey}:collection:${col}`,
              template: 'products',
              rowId: row.id,
              label: `Link product "${row.id}" to collection "${col}"`,
              method: 'POST',
              path: `/api/v1/products/{${prodKey}}/collections/{${colKey}}`,
              after,
            })
          }

          // Sub-calls: specifications
          const specs = row.values.specifications
          if (Array.isArray(specs) && specs.length > 0) {
            rawOps.push({
              key: `${prodKey}:specifications`,
              template: 'products',
              rowId: row.id,
              label: `Set specifications for product "${row.id}"`,
              method: 'PUT',
              path: `/api/v1/products/{${prodKey}}/specifications`,
              body: specs,
              after: [prodKey],
            })
          }

          // Sub-calls: gallery images
          const images = (row.values.images as string[]) ?? []
          images.forEach((imgUrl, index) => {
            const resolvedUrl = resolveMedia(imgUrl, library)
            rawOps.push({
              key: `${prodKey}:images:${index}`,
              template: 'products',
              rowId: row.id,
              label: `Add gallery image ${index + 1} to product "${row.id}"`,
              method: 'POST',
              path: '/api/v1/media',
              body: {
                productId: `{${prodKey}}`,
                url: resolvedUrl,
                mediaType: 'IMAGE',
                sortOrder: index,
                isPrimary: false,
              },
              after: [prodKey],
            })
          })
        }
        break
      }

      case 'variants': {
        for (const row of rows) {
          const productSlug = String(row.values.product ?? '').trim()
          const productKey = `products:${productSlug}`
          const after = allKeys.has(productKey) ? [productKey] : []

          rawOps.push({
            key: `variants:${row.id}`,
            template: 'variants',
            rowId: row.id,
            label: `Create variant "${row.values.name ?? row.id}" for product "${productSlug}"`,
            method: 'POST',
            path: '/api/v1/variants',
            body: {
              productId: `{${productKey}}`,
              sku: row.id,
              barcode: row.values.barcode,
              name: row.values.name,
              price: row.values.price,
              compareAtPrice: row.values.compareAtPrice,
              weightGrams: row.values.weightGrams ?? 0,
              isActive: row.values.isActive ?? true,
              safetyStock: row.values.safetyStock ?? 0,
              stockQuantity: row.values.stockQuantity,
              availability: row.values.availability ?? 'AUTO',
              leadTimeDays: row.values.leadTimeDays,
            },
            after,
          })
        }
        break
      }
    }
  }

  return rawOps
}
