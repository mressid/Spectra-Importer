import { describe, expect, it } from 'vitest'
import type { LibraryImage } from '../core/types'
import type { UploadOutcome } from './imageLibrary'
import { describeFailure, describeNoMedia, groupFailures } from './uploadReport'

const image = {} as LibraryImage
const fail = (fileName: string, error: string): UploadOutcome => ({ fileName, ok: false, error })

describe('groupFailures', () => {
  it('makes one entry per store message, however many files failed', () => {
    const groups = groupFailures([
      fail('p/a.png', 'Image too large'),
      { fileName: 'p/ok.png', ok: true, image, replaced: false },
      fail('p/b.png', 'Image too large'),
      fail('p/c.png', 'Unsupported type'),
    ])
    expect(groups).toEqual([
      { message: 'Image too large', files: ['p/a.png', 'p/b.png'] },
      { message: 'Unsupported type', files: ['p/c.png'] },
    ])
  })

  it('is empty when everything uploaded', () => {
    expect(groupFailures([{ fileName: 'a.png', ok: true, image, replaced: false }])).toEqual([])
  })
})

describe('describeFailure', () => {
  it('names the file for one failure and the first two for several', () => {
    expect(describeFailure({ message: 'Too large', files: ['shop/p/a.png'] })).toBe('a.png was not uploaded: Too large')
    expect(describeFailure({ message: 'Too large', files: ['a.png', 'b.png'] })).toBe('2 files were not uploaded: Too large (a.png, b.png)')
    expect(describeFailure({ message: 'Too large', files: ['a.png', 'b.png', 'c.png', 'd.png'] })).toBe('4 files were not uploaded: Too large (a.png, b.png and 2 more)')
  })
})

describe('describeNoMedia', () => {
  const files = (...names: string[]) => names.map((name) => new File(['x'], name))

  it('says what was dropped, so a wrong folder can be told from a broken drop', () => {
    const message = describeNoMedia(files('brands.csv', 'brands.json', 'brands.yaml', 'README.md'))
    expect(message).toContain('No image or video among the 4 dropped files (found: .csv, .json, .yaml, .md)')
    expect(message).toContain('JPEG, PNG, WebP, GIF, AVIF, MP4 and WebM')
  })

  it('sends data files to the Files step', () => {
    expect(describeNoMedia(files('products.csv', 'notes.txt'))).toContain('loaded in the Files step')
    expect(describeNoMedia(files('notes.txt', 'README.md'))).not.toContain('Files step')
  })

  it('counts repeated extensions', () => {
    expect(describeNoMedia(files('a.heic', 'b.heic', 'c.heic'))).toContain('found: .heic ×3')
  })

  it('recognises folders the browser could not open and points to the folder picker', () => {
    const folder = (name: string) => new File([], name)
    const message = describeNoMedia([folder('ring-a'), folder('ring-b')])
    expect(message).toContain('folders it could not open (ring-a, ring-b)')
    expect(message).toContain('Select Structured Folder')
  })
})
