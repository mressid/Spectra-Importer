import { describe, expect, it } from 'vitest'
import { EXAMPLE_COMBOS, exampleComboZip } from './exampleCombos'
import { withParentFolders } from './zip'

describe('EXAMPLE_COMBOS', () => {
  it('lists the four documented combinations, in order, each with its README', () => {
    expect(EXAMPLE_COMBOS.map((c) => c.id)).toEqual([
      '01-one-place-per-folder',
      '02-one-photo-many-places',
      '03-gallery-order-and-ratio',
      '04-whole-shop',
    ])
    for (const combo of EXAMPLE_COMBOS) {
      expect(combo.title).not.toBe(combo.id)
      expect(combo.description).not.toBe('')
      expect(combo.files.map((f) => f.path)).toContain('README.md')
    }
  })

  it('keeps the folder names with brackets, commas and = @ intact', () => {
    const paths = EXAMPLE_COMBOS.flatMap((c) => c.files.map((f) => f.path))
    expect(paths).toContain('[product=solitaire-gold, category=rings]/thumbnail/rings-hero.png')
    expect(paths).toContain('[ring-a@4, ring-b@3]/gallery/macro.png')
    expect(paths).toContain('variant[SOLI-GOLD-52, SOLI-GOLD-54]/gallery/01_size-chart.png')
  })

  it('zips a combination under its own root folder, with every parent folder', async () => {
    const combo = EXAMPLE_COMBOS[0]
    const bytes = await exampleComboZip(combo, async () => new Uint8Array([1, 2, 3]).buffer)
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('01-one-place-per-folder/README.md')
    expect(text).toContain('01-one-place-per-folder/product/solitaire-gold/gallery/01_side-view.png')
    expect(text).toContain('01-one-place-per-folder/product/solitaire-gold/')
    expect(text).toContain('01-one-place-per-folder/')
  })
})

describe('withParentFolders', () => {
  it('adds each parent folder once, before the files', () => {
    const entries = withParentFolders([{ name: 'a/b/one.txt' }, { name: 'a/two.txt' }, { name: 'c/' }])
    expect(entries.map((e) => e.name)).toEqual(['a/', 'a/b/', 'c/', 'a/b/one.txt', 'a/two.txt'])
  })
})
