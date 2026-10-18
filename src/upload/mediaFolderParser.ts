/**
 * Media Library folder structure upload parser.
 *
 * Implements folder structure parsing for the store media library importer:
 * - Detects targets (product, variant, category, brand, etc.)
 * - Supports multi-name folders: `[ring-a, ring-b]`, `variant[SKU-1, SKU-2]`, `[product=ring-a, category=rings]`
 *   (only characters valid in a folder name on every OS; the older `*:[...]` spelling still works)
 * - Supports individual path-bound order: explicit order in folder (`1/`, `order-2/`),
 *   filename prefixes (`01_front.jpg`), or per-place order (`[ring-a@1, ring-b@2]`)
 * - Extracts roles (THUMBNAIL, GALLERY, BANNER, LOGO, SWATCH)
 * - Identifies aspect ratios from folder paths (e.g., `1:1`, `4:5`, `16:9`, `3:4`)
 *   and calculates aspect ratio and orientation from image dimensions (width, height)
 * - Produces individual bindings matching PUT /api/v1/admin/media/bindings
 */

import { getRelativePath, isMediaFile } from './folderStructure'

export type MediaTargetType = 'product' | 'variant' | 'category' | 'brand' | 'collection' | string

export type MediaRoleType = 'THUMBNAIL' | 'GALLERY' | 'BANNER' | 'LOGO' | 'SWATCH' | string

export type ImageOrientation = 'SQUARE' | 'PORTRAIT' | 'LANDSCAPE'

export interface AspectRatioInfo {
  ratio: number
  formatted: string
  orientation: ImageOrientation
}

export interface MediaBinding {
  target: MediaTargetType
  name: string
  role: MediaRoleType
  order: number
  altText?: string
}

export interface ParsedMediaAsset {
  file: File
  relativePath: string
  fileName: string
  extension: string
  mediaType: 'IMAGE' | 'VIDEO'
  bindings: MediaBinding[]
  aspectRatio?: AspectRatioInfo
  explicitAspectRatio?: string
  detectedAltText?: string
  detectedOrder?: number
}

export interface ParseMediaFolderResult {
  assets: ParsedMediaAsset[]
  targetSummary: Record<string, number>
  uniqueLogicalNames: string[]
  multiBoundAssetsCount: number
  errors: string[]
}

const COMMON_RATIOS: { ratio: number; formatted: string }[] = [
  { ratio: 1.0, formatted: '1:1' },
  { ratio: 0.8, formatted: '4:5' },
  { ratio: 0.75, formatted: '3:4' },
  { ratio: 0.667, formatted: '2:3' },
  { ratio: 0.5625, formatted: '9:16' },
  { ratio: 1.25, formatted: '5:4' },
  { ratio: 1.333, formatted: '4:3' },
  { ratio: 1.5, formatted: '3:2' },
  { ratio: 1.778, formatted: '16:9' },
  { ratio: 2.333, formatted: '21:9' },
]

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/**
 * Calculates aspect ratio information from width and height.
 */
export function calculateAspectRatio(width: number, height: number): AspectRatioInfo {
  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      ratio: 0,
      formatted: 'unknown',
      orientation: 'SQUARE',
    }
  }

  const rawRatio = width / height
  const ratio = Math.round(rawRatio * 1000) / 1000

  let orientation: ImageOrientation = 'SQUARE'
  if (width > height) orientation = 'LANDSCAPE'
  else if (width < height) orientation = 'PORTRAIT'

  // Match against common e-commerce ratios within 2.5% tolerance
  for (const item of COMMON_RATIOS) {
    if (Math.abs(rawRatio - item.ratio) / item.ratio <= 0.025) {
      return {
        ratio,
        formatted: item.formatted,
        orientation,
      }
    }
  }

  // Fallback: simplified fraction or decimal:1
  const divisor = gcd(width, height)
  const simplifiedW = Math.round(width / divisor)
  const simplifiedH = Math.round(height / divisor)

  if (simplifiedW <= 32 && simplifiedH <= 32) {
    return {
      ratio,
      formatted: `${simplifiedW}:${simplifiedH}`,
      orientation,
    }
  }

  return {
    ratio,
    formatted: `${Math.round(rawRatio * 100) / 100}:1`,
    orientation,
  }
}

/**
 * Detects aspect ratio from path segments (e.g. "1:1", "4:5", "16:9", "ratio-1x1").
 */
export function parseAspectRatioFromPath(segment: string): string | undefined {
  const clean = segment.trim().toLowerCase().replace(/^ratio[-_]?/, '').replace(/^aspect[-_]?/, '')
  const match = clean.match(/^(\d{1,2})[:x](\d{1,2})$/)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  return undefined
}

/**
 * Detects media role from string (THUMBNAIL, GALLERY, BANNER, LOGO, SWATCH).
 */
export function detectRole(segmentOrFileName: string): MediaRoleType | undefined {
  const lower = segmentOrFileName.toLowerCase()
  if (
    lower.startsWith('thumbnail') ||
    lower.startsWith('thumb') ||
    lower.startsWith('cover') ||
    lower.startsWith('main') ||
    lower.startsWith('hero')
  ) {
    return 'THUMBNAIL'
  }
  if (
    lower === 'gallery' ||
    lower === 'images' ||
    lower === 'photos' ||
    lower === 'slides' ||
    lower.startsWith('gallery-') ||
    lower.startsWith('gallery_')
  ) {
    return 'GALLERY'
  }
  if (lower.startsWith('banner') || lower.startsWith('header')) {
    return 'BANNER'
  }
  if (lower.startsWith('logo') || lower.startsWith('icon') || lower.startsWith('avatar')) {
    return 'LOGO'
  }
  if (lower.startsWith('swatch') || lower.startsWith('color')) {
    return 'SWATCH'
  }
  return undefined
}

export interface ParsedTargetName {
  target?: string
  name: string
  order?: number
}

/**
 * Parses target and logical names from path segments. The portable spelling uses only characters that are valid in
 * a folder name on Windows, macOS and Linux (`:` and `*` are not valid on Windows):
 *  - `[ring-a, ring-b]`                       several products
 *  - `variant[SKU-1, SKU-2]`                  several places of one kind
 *  - `[product=ring-a, category=rings]`       each entry names its kind
 *  - `[ring-a@1, ring-b@3]`                   a position per place (`@` = "at")
 *  - `ring-gold`                              one place
 * The older spelling still works: `*:[...]`, `product:[...]`, `product:ring-a`, `ring-a:3`.
 */
export function parseTargetAndNames(segment: string, defaultTarget = 'product'): ParsedTargetName[] {
  const trimmed = segment.trim()
  if (!trimmed) return []

  // Case 1: [...], kind[...], *:[...] or kind:[...]
  const bracketMatch = trimmed.match(/^(\*|[a-zA-Z0-9_-]+)?:?\[(.*)\]$/)
  if (bracketMatch) {
    const rawTargetPrefix = bracketMatch[1]
    const content = bracketMatch[2]
    const explicitTarget = rawTargetPrefix && rawTargetPrefix !== '*' ? rawTargetPrefix.toLowerCase() : undefined

    const entries = content
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const results: ParsedTargetName[] = []

    for (const entry of entries) {
      // Portable position suffix: name@3, kind=name@3
      let rest = entry
      let order: number | undefined
      const at = rest.match(/^(.*)@(\d+)$/)
      if (at) {
        rest = at[1].trim()
        order = parseInt(at[2], 10)
      }

      // Portable kind: kind=name
      const eq = rest.indexOf('=')
      if (eq > 0) {
        results.push({ target: rest.slice(0, eq).trim().toLowerCase(), name: rest.slice(eq + 1).trim(), order })
        continue
      }

      // Older colon spellings: target:name:order, target:name, name:order
      const parts = rest.split(':').map((p) => p.trim())
      if (parts.length === 3) {
        const orderNum = parseInt(parts[2], 10)
        results.push({
          target: parts[0].toLowerCase(),
          name: parts[1],
          order: Number.isNaN(orderNum) ? undefined : orderNum,
        })
      } else if (parts.length === 2) {
        const secondNum = parseInt(parts[1], 10)
        if (!Number.isNaN(secondNum) && !KNOWN_TARGETS.has(parts[0].toLowerCase())) {
          results.push({ target: explicitTarget || defaultTarget, name: parts[0], order: secondNum })
        } else {
          results.push({ target: parts[0].toLowerCase(), name: parts[1], order })
        }
      } else if (parts.length === 1 && parts[0]) {
        results.push({ target: explicitTarget || defaultTarget, name: parts[0], order })
      }
    }

    if (results.length > 0) return results
  }

  // Case 2: standard single target or name
  return [{ target: defaultTarget, name: trimmed }]
}

const KNOWN_TARGETS = new Set(['product', 'variant', 'category', 'brand', 'collection', 'tag'])

/**
 * Extracts order from folder parts or filename.
 */
export function extractOrder(
  pathParts: string[],
  fileName: string,
  role?: MediaRoleType,
): number | undefined {
  if (role === 'THUMBNAIL') {
    return 1
  }

  // 1. Check folder segments for order indicator
  for (const part of pathParts) {
    const trimmed = part.trim()
    // Dedicated digit folder e.g. "1", "02"
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10)
    }
    // "order-1", "pos_2", "order:3", "[order=4]"
    const orderMatch = trimmed.match(/(?:order|pos|seq|sort)[-_:=](\d+)/i) || trimmed.match(/\[order=(\d+)\]/i)
    if (orderMatch) {
      return parseInt(orderMatch[1], 10)
    }
  }

  // 2. Check filename prefix e.g. "01_front.jpg", "2-side.png", "03.back.webp"
  const fileBase = fileName.replace(/\.[^.]+$/, '')
  const prefixMatch = fileBase.match(/^(\d+)[\s._-]+/)
  if (prefixMatch) {
    return parseInt(prefixMatch[1], 10)
  }

  // 3. Filename is pure number: "1.jpg"
  if (/^\d+$/.test(fileBase)) {
    return parseInt(fileBase, 10)
  }

  // 4. Filename suffix e.g. "front_01.jpg", "photo-2.jpg"
  const suffixMatch = fileBase.match(/[\s._-]+(\d+)$/)
  if (suffixMatch) {
    return parseInt(suffixMatch[1], 10)
  }

  return undefined
}

/**
 * Cleans filename into user-friendly alt text.
 */
export function extractAltText(fileName: string): string | undefined {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  const lower = base.toLowerCase()

  // Ignore generic names
  if (
    /^\d+$/.test(base) ||
    lower === 'thumbnail' ||
    lower === 'thumb' ||
    lower === 'cover' ||
    lower === 'image' ||
    lower === 'photo' ||
    lower === 'gallery' ||
    lower === 'logo' ||
    lower === 'icon' ||
    lower === 'avatar' ||
    lower === 'banner'
  ) {
    return undefined
  }

  // Strip leading digits/prefixes e.g. "01_front_view" -> "front_view"
  const stripped = base.replace(/^\d+[\s._-]+/, '')
  const formatted = stripped
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!formatted) return undefined

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/**
 * Parses files selected from a folder structure for the media library.
 */
export function parseMediaFolder(files: File[]): ParseMediaFolderResult {
  const assets: ParsedMediaAsset[] = []
  const errors: string[] = []
  const targetSummary: Record<string, number> = {}
  const logicalNamesSet = new Set<string>()

  const explicitBindingsWithOrder = new Set<MediaBinding>()

  // Filter media files
  const mediaFiles = files.filter((f) => isMediaFile(f.name))

  for (const file of mediaFiles) {
    const relPath = getRelativePath(file)
    const parts = relPath.split('/').filter(Boolean)
    const fileName = parts.pop() || file.name
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : ''
    const isVideo = ['.mp4', '.webm', '.mov', '.ogg'].includes(ext)
    const mediaType = isVideo ? 'VIDEO' : 'IMAGE'

    // Look for aspect ratio segment
    let explicitAspectRatio: string | undefined
    for (const part of parts) {
      const detected = parseAspectRatioFromPath(part)
      if (detected) {
        explicitAspectRatio = detected
        break
      }
    }

    // Role detection
    let detectedRole: MediaRoleType | undefined
    for (const part of parts) {
      const r = detectRole(part)
      if (r) {
        detectedRole = r
        break
      }
    }
    if (!detectedRole) {
      detectedRole = detectRole(fileName)
    }

    // Target and logical names extraction
    // Scan path segments
    let targetCandidates: ParsedTargetName[] = []
    let currentTarget = 'product'

    // Check if path starts with known target or has variants/
    const remainingParts: string[] = []

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      // If segment is aspect ratio or role, skip from target name resolution
      if (parseAspectRatioFromPath(part) || detectRole(part)) {
        continue
      }

      // Check if segment is a known target type: product, category, brand, variant
      const lowerPart = part.toLowerCase()
      if (KNOWN_TARGETS.has(lowerPart) && i + 1 < parts.length) {
        currentTarget = lowerPart
        const nextPart = parts[++i]
        const parsed = parseTargetAndNames(nextPart, currentTarget)
        targetCandidates.push(...parsed)
        continue
      }

      // Check if bracket multi-name segment: [...], product[...] (older: *:[...], product:[...])
      if (part.includes('[') && part.includes(']')) {
        const parsed = parseTargetAndNames(part, currentTarget)
        targetCandidates.push(...parsed)
        continue
      }

      // Check for variant path segment e.g. "variants/{variantSlug}"
      if (lowerPart === 'variants' && i + 1 < parts.length) {
        currentTarget = 'variant'
        const nextPart = parts[++i]
        const parsed = parseTargetAndNames(nextPart, 'variant')
        targetCandidates.push(...parsed)
        continue
      }

      remainingParts.push(part)
    }

    // If no target candidates found yet, use first remaining directory as product slug
    if (targetCandidates.length === 0) {
      if (remainingParts.length > 0) {
        const rootSlug = remainingParts[0]
        targetCandidates = parseTargetAndNames(rootSlug, 'product')
      } else {
        // Dropped at root or single file
        targetCandidates = [{ target: 'product', name: 'default' }]
      }
    }

    // Default role if still undefined
    if (!detectedRole) {
      detectedRole = parts.length === 1 && targetCandidates.length === 1 ? 'THUMBNAIL' : 'GALLERY'
    }

    // Order detection
    const explicitOrder = extractOrder(parts, fileName, detectedRole)
    const detectedAltText = extractAltText(fileName)

    // Build bindings for this asset
    const bindings: MediaBinding[] = targetCandidates.map((candidate) => {
      const bindingTarget = candidate.target || currentTarget || 'product'
      const hasSpecificOrder = candidate.order !== undefined || explicitOrder !== undefined
      const bindingOrder = candidate.order ?? explicitOrder ?? (detectedRole === 'THUMBNAIL' ? 1 : 1)

      logicalNamesSet.add(candidate.name)
      targetSummary[bindingTarget] = (targetSummary[bindingTarget] || 0) + 1

      const b: MediaBinding = {
        target: bindingTarget,
        name: candidate.name,
        role: detectedRole as MediaRoleType,
        order: bindingOrder,
        altText: detectedAltText,
      }

      if (hasSpecificOrder) {
        explicitBindingsWithOrder.add(b)
      }

      return b
    })

    assets.push({
      file,
      relativePath: relPath,
      fileName,
      extension: ext,
      mediaType,
      bindings,
      explicitAspectRatio,
      detectedAltText,
      detectedOrder: explicitOrder,
    })
  }

  // Adjust sequential orders for assets grouped by target + name + role where order was not explicitly given
  const groupCounts = new Map<string, number>()
  for (const asset of assets) {
    for (const binding of asset.bindings) {
      if (binding.role === 'THUMBNAIL') {
        binding.order = 1
        continue
      }

      // If binding did not have explicit order detected
      if (!explicitBindingsWithOrder.has(binding)) {
        const key = `${binding.target}::${binding.name}::${binding.role}`
        const currentCount = groupCounts.get(key) || 0
        const nextOrder = currentCount + 1
        groupCounts.set(key, nextOrder)
        binding.order = nextOrder
      }
    }
  }

  const multiBoundAssetsCount = assets.filter((a) => a.bindings.length > 1).length

  return {
    assets,
    targetSummary,
    uniqueLogicalNames: Array.from(logicalNamesSet),
    multiBoundAssetsCount,
    errors,
  }
}
