import { describe, expect, it } from 'vitest'
import { addToLibrary, resolveMedia, type ImageLibrary } from './imageLibrary'

const fake = async (_file: Blob, name: string) => {
  if (name.startsWith('bad')) throw new Error('The file is too large')
  return { url: `https://cdn.example/${name}`, mediaType: 'IMAGE' as const, width: 10, height: 10, sizeBytes: 5, duplicate: false }
}
const file = (name: string) => new File(['x'], name)

describe('image library', () => {
  it('keeps uploaded images by file name and reports the failures one by one', async () => {
    const library: ImageLibrary = new Map()
    const outcomes = await addToLibrary([file('a.jpg'), file('bad.jpg'), file('a.jpg'), file('b.png')], library, { upload: fake })

    expect(outcomes.map((outcome) => [outcome.fileName, outcome.ok])).toEqual([['a.jpg', true], ['bad.jpg', false], ['a.jpg', false], ['b.png', true]])
    expect([...library.keys()].sort()).toEqual(['a.jpg', 'b.png'])
    expect(resolveMedia('media:a.jpg', library)).toBe('https://cdn.example/a.jpg')
    expect(resolveMedia('https://x.example/y.jpg', library)).toBe('https://x.example/y.jpg')
    expect(resolveMedia('media:missing.jpg', library)).toBeNull()
  })
})
