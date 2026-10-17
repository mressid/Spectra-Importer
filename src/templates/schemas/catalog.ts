/** Rows of the simple catalogue templates. Field names follow the store API (CreateXxxDto) unless noted. */
import { z } from 'zod'
import { bool, optionalInt, optionalMediaUrl, requiredText, slug, text } from '../fields'

export const tagRow = z.object({
  slug,
  name: requiredText(),
})

export const brandRow = z.object({
  slug,
  name: requiredText(),
  website: text(),
  country: text(),
  /** Square logo, 1:1. */
  logoUrl: optionalMediaUrl,
})

export const categoryRow = z.object({
  slug,
  name: requiredText(),
  /** Slug of the parent category (same file or already in the store). Empty for a top-level category. */
  parent: text(),
  sortOrder: optionalInt(0),
  isActive: bool,
  seoTitle: text(70),
  seoDescription: text(160),
  /** 4:3 picture. */
  imageUrl: optionalMediaUrl,
})

export const collectionRow = z.object({
  slug,
  name: requiredText(),
  description: text(5000),
  /** ISO date-time, e.g. 2026-12-01T00:00:00. Both optional. */
  startAt: text(30),
  endAt: text(30),
  isActive: bool,
})
