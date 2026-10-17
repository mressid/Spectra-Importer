/**
 * Products and variants.
 *
 * A "simple" product (hasVariants empty/false) is one row: the price, sku and stock columns become its
 * default variant. A product with options (hasVariants = true) has no price here: its variants come
 * from the `variants` template, one row per option combination, pointing back with `product`.
 */
import { z } from 'zod'
import { bool, list, money, nameValueList, optionalInt, optionalMoney, optionalMediaUrl, requiredText, slug, text, mediaUrl } from '../fields'

const availability = z.preprocess((value) => (value === '' ? undefined : value), z.enum(['AUTO', 'ON_ORDER', 'SOLD_OUT']).optional())

export const productRow = z.object({
  slug,
  name: requiredText(),
  /** Picture shown in lists: http(s) address or media:<file name> from the image library. */
  thumbnailUrl: mediaUrl,
  brand: text(), // slug of a brand
  categories: list(), // slugs
  tags: list(), // slugs
  collections: list(), // slugs
  shortDescription: text(500),
  description: text(50000),
  descriptionFormat: z.preprocess((value) => (value === '' ? undefined : value), z.enum(['MARKDOWN', 'HTML', 'TEXT']).optional()),
  seoTitle: text(70),
  seoDescription: text(160),
  isActive: bool,
  hasVariants: bool,
  allowPersonalization: bool,
  personalizationInstructions: text(1000),
  /** "Material: silver | Length: 45 cm" in CSV, [{name, value}] in JSON / YAML. */
  specifications: nameValueList,
  /** More photos of the product, in display order (the gallery). */
  images: list(mediaUrl),
  /** Long description blocks. JSON / YAML only (too nested for one CSV cell). */
  contentBlocks: z
    .array(
      z.object({
        type: z.enum(['TEXT', 'IMAGE', 'VIDEO']),
        format: z.enum(['MARKDOWN', 'HTML', 'TEXT']).optional(),
        content: z.string().max(50000).optional(),
        url: optionalMediaUrl,
        caption: z.string().max(500).optional(),
      }),
    )
    .max(50)
    .optional(),

  // --- simple products only (default variant) ---
  sku: text(),
  barcode: text(),
  price: optionalMoney,
  compareAtPrice: optionalMoney,
  weightGrams: optionalInt(0),
  stockQuantity: optionalInt(0),
  availability,
  leadTimeDays: optionalInt(1, 90),
})
  .superRefine((row, context) => {
    if (row.hasVariants) return
    for (const field of ['sku', 'price'] as const) {
      if (row[field] === undefined) {
        context.addIssue({ code: 'custom', path: [field], message: 'is required for a product without variants' })
      }
    }
  })

export const variantRow = z.object({
  sku: requiredText(),
  /** Slug of the product (hasVariants = true) this option belongs to. */
  product: slug,
  /** What the customer sees, e.g. "Gold / 52". */
  name: requiredText(),
  barcode: text(),
  price: money,
  compareAtPrice: optionalMoney,
  weightGrams: optionalInt(0),
  stockQuantity: optionalInt(0),
  safetyStock: optionalInt(0),
  availability,
  leadTimeDays: optionalInt(1, 90),
  isActive: bool,
})
