/**
 * Building blocks for template schemas. They accept the typed value (JSON / YAML) and also the
 * string a CSV cell holds, so the CSV adapter does not need to know any template:
 *   empty cell -> undefined, "true"/"yes"/"1" -> true, "12.500" -> number, "a|b|c" -> ["a","b","c"].
 */
import { z } from 'zod'

/** The CSV list separator. */
export const LIST_SEPARATOR = '|'

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

export const text = (max = 255) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional())

export const requiredText = (max = 255) => z.string().trim().min(1, 'is required').max(max)

/** Lower case words joined by dashes, same rule the storefront uses in addresses. */
export const slug = z
  .string()
  .trim()
  .min(1, 'is required')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lower case letters, digits and dashes only (e.g. gold-ring)')

export const bool = z.preprocess((value) => {
    const cleaned = blankToUndefined(value)
    if (typeof cleaned !== 'string') return cleaned
    const lower = cleaned.trim().toLowerCase()
    if (['true', 'yes', 'y', '1'].includes(lower)) return true
    if (['false', 'no', 'n', '0'].includes(lower)) return false
    return cleaned
  }, z.boolean().optional())

/** Money in dinars: at most 3 decimals (millimes), like the store API. */
export const money = z.preprocess(
  (value) => (typeof value === 'string' ? Number(value.replace(',', '.')) : value),
  z.number().min(0).multipleOf(0.001),
)

export const optionalMoney = z.preprocess(
  (value) => (blankToUndefined(value) === undefined ? undefined : typeof value === 'string' ? Number(value.replace(',', '.')) : value),
  z.number().min(0).multipleOf(0.001).optional(),
)

export const optionalInt = (min = 0, max?: number) =>
  z.preprocess(
    (value) => (blankToUndefined(value) === undefined ? undefined : typeof value === 'string' ? Number(value) : value),
    (max === undefined ? z.number().int().min(min) : z.number().int().min(min).max(max)).optional(),
  )

/** A web address, or `media:<fileName>` pointing at an image in the image library (see upload/imageLibrary.ts). */
export const mediaUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => /^https?:\/\/\S+$/.test(value) || /^media:\S+$/.test(value), 'must be an http(s) address or media:<file name>')

export const optionalMediaUrl = z.preprocess(blankToUndefined, mediaUrl.optional())

/** "a|b|c" in CSV, an array in JSON / YAML. */
export const list = (item: z.ZodType<string> = z.string().trim().min(1)) =>
  z.preprocess((value) => {
    const cleaned = blankToUndefined(value)
    if (typeof cleaned !== 'string') return cleaned
    return cleaned.split(LIST_SEPARATOR).map((part) => part.trim()).filter(Boolean)
  }, z.array(item).optional())

/** "Name: value | Name: value" in CSV, [{name, value}] in JSON / YAML. */
export const nameValueList = z.preprocess(
  (value) => {
    const cleaned = blankToUndefined(value)
    if (typeof cleaned !== 'string') return cleaned
    return cleaned
      .split(LIST_SEPARATOR)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const colon = part.indexOf(':')
        return colon < 0 ? { name: part, value: '' } : { name: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() }
      })
  },
  z.array(z.object({ name: requiredText(100), value: requiredText(255) })).max(50).optional(),
)
