import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPortableFolderName } from './folderTemplate'
import { parseMediaFolder } from './mediaFolderParser'

const EXAMPLES = join(__dirname, '../../examples/media-folders')

function filesOf(combo: string): File[] {
  const found: File[] = []
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name)
      const relativePath = rel ? `${rel}/${name}` : name
      if (statSync(path).isDirectory()) walk(path, relativePath)
      else {
        const file = new File([readFileSync(path)], name)
        Object.defineProperty(file, 'relativePath', { value: relativePath })
        found.push(file)
      }
    }
  }
  walk(join(EXAMPLES, combo), combo)
  return found
}

function bindingsOf(combo: string): string[] {
  return parseMediaFolder(filesOf(combo)).assets
    .flatMap((a) => a.bindings.map((b) => `${b.target}:${b.name} ${b.role} #${b.order}`))
    .sort()
}

describe('examples/media-folders', () => {
  it('every folder and file name works on Windows, macOS and Linux', () => {
    const names: string[] = []
    for (const combo of readdirSync(EXAMPLES).filter((n) => statSync(join(EXAMPLES, n)).isDirectory())) {
      for (const file of filesOf(combo)) {
        names.push(...((file as File & { relativePath: string }).relativePath.split('/')))
      }
    }
    expect(names.length).toBeGreaterThan(30)
    for (const name of new Set(names)) expect(isPortableFolderName(name), name).toBe(true)
  })

  it('01 one place per folder', () => {
    expect(bindingsOf('01-one-place-per-folder')).toEqual([
      'brand:aurum THUMBNAIL #1',
      'category:rings THUMBNAIL #1',
      'product:solitaire-gold GALLERY #1',
      'product:solitaire-gold GALLERY #2',
      'product:solitaire-gold THUMBNAIL #1',
      'variant:SOLI-GOLD-52 GALLERY #1',
    ])
  })

  it('02 one photo, many places', () => {
    expect(bindingsOf('02-one-photo-many-places')).toEqual([
      'category:rings THUMBNAIL #1',
      'product:solitaire-gold GALLERY #1',
      'product:solitaire-gold THUMBNAIL #1',
      'product:solitaire-gold THUMBNAIL #1',
      'product:solitaire-silver GALLERY #1',
      'product:solitaire-silver THUMBNAIL #1',
      'variant:SOLI-GOLD-52 GALLERY #1',
      'variant:SOLI-GOLD-54 GALLERY #1',
    ])
  })

  it('03 gallery order and ratio', () => {
    expect(bindingsOf('03-gallery-order-and-ratio')).toEqual([
      'product:ring-a GALLERY #1',
      'product:ring-a GALLERY #2',
      'product:ring-a GALLERY #3',
      'product:ring-a GALLERY #4',
      'product:ring-a THUMBNAIL #1',
      'product:ring-b GALLERY #1',
      'product:ring-b GALLERY #2',
      'product:ring-b GALLERY #3',
      'product:ring-b THUMBNAIL #1',
    ])
    const ratios = parseMediaFolder(filesOf('03-gallery-order-and-ratio')).assets.filter((a) => a.explicitAspectRatio)
    expect(ratios.map((a) => a.explicitAspectRatio)).toEqual(['4:5', '4:5'])
  })

  it('04 whole shop', () => {
    expect(bindingsOf('04-whole-shop')).toEqual([
      'brand:aurum THUMBNAIL #1',
      'category:necklaces THUMBNAIL #1',
      'category:rings THUMBNAIL #1',
      'product:solitaire-gold GALLERY #1',
      'product:solitaire-gold GALLERY #2',
      'product:solitaire-gold GALLERY #3',
      'product:solitaire-gold THUMBNAIL #1',
      'product:solitaire-silver GALLERY #1',
      'product:solitaire-silver GALLERY #3',
      'product:solitaire-silver THUMBNAIL #1',
      'variant:SOLI-GOLD-52 GALLERY #1',
      'variant:SOLI-GOLD-54 GALLERY #1',
    ])
  })
})
