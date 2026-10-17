/**
 * Utilities for parsing and handling entity references in template rows.
 *
 * References can point to existing resources (e.g. `brand: "acme"`, `tags: ["sale"]`)
 * or explicitly request on-the-fly creation by prefixing with `create:`
 * (e.g. `brand: "create:acme"`, `collections: ["create:summer-2026"]`).
 */

export const AUTO_CREATABLE_TARGETS = ['tags', 'brands', 'categories', 'collections'] as const
export type AutoCreatableTarget = (typeof AUTO_CREATABLE_TARGETS)[number]

export function isAutoCreatableTarget(target: string): target is AutoCreatableTarget {
  return (AUTO_CREATABLE_TARGETS as readonly string[]).includes(target)
}

export interface ParsedReference {
  raw: string
  isCreate: boolean
  slug: string
}

/** Lower case words joined by dashes, same rule the storefront uses. */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug)
}

/**
 * Parses a reference string such as "acme", "create:summer-sale", or "create:rings".
 */
export function parseReference(ref: unknown): ParsedReference {
  const raw = String(ref ?? '').trim()
  if (/^create:/i.test(raw)) {
    const slug = raw.slice(7).trim().toLowerCase()
    return { raw, isCreate: true, slug }
  }
  return { raw, isCreate: false, slug: raw }
}

/**
 * Derives a human-friendly display name / title from a slug.
 * E.g. "summer-sale" -> "Summer Sale", "rings" -> "Rings".
 */
export function slugToTitle(slug: string): string {
  if (!slug) return ''
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
