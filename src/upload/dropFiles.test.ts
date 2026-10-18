import { describe, expect, it } from 'vitest'
import { dragHasFiles, normalizeDropRoot, readDroppedFiles } from './dropFiles'

/** Entries as a browser gives them: a directory answers `readEntries` in batches and then with an empty list. */
function fileEntry(name: string, fail = false): FileSystemEntry {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (resolve: (file: File) => void, reject: (error: Error) => void) => (fail ? reject(new Error('NotReadableError')) : resolve(new File(['x'], name))),
  } as unknown as FileSystemEntry
}

function dirEntry(name: string, children: FileSystemEntry[], batchSize: number): FileSystemEntry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      let at = 0
      return {
        readEntries: (resolve: (entries: FileSystemEntry[]) => void) => {
          const batch = children.slice(at, at + batchSize)
          at += batchSize
          resolve(batch)
        },
      }
    },
  } as unknown as FileSystemEntry
}

const transfer = (entries: FileSystemEntry[], files: File[] = []) =>
  ({ items: entries.map((entry) => ({ webkitGetAsEntry: () => entry })), files, types: ['Files'] }) as unknown as DataTransfer

const relPaths = (files: File[]) => files.map((f) => (f as File & { relativePath: string }).relativePath).sort()

describe('readDroppedFiles', () => {
  it('reads a folder that is bigger than one batch (the browser hands back 100 entries at a time)', async () => {
    const names = Array.from({ length: 250 }, (_, i) => `photo-${i}.jpg`)
    const root = dirEntry('drop', names.map((n) => fileEntry(n)), 100)
    const { files, errors } = await readDroppedFiles(transfer([root]))
    expect(files).toHaveLength(250)
    expect(errors).toEqual([])
    expect(relPaths(files)[0]).toBe('drop/photo-0.jpg')
  })

  it('keeps the path inside the folder, through sub-folders', async () => {
    const root = dirEntry('shop', [dirEntry('product', [dirEntry('ring-a', [fileEntry('cover.png')], 1)], 1), fileEntry('top.png')], 1)
    expect(relPaths((await readDroppedFiles(transfer([root]))).files)).toEqual(['shop/product/ring-a/cover.png', 'shop/top.png'])
  })

  it('reports a file that cannot be read and still returns the others', async () => {
    const root = dirEntry('drop', [fileEntry('ok.png'), fileEntry('locked.png', true)], 10)
    const { files, errors } = await readDroppedFiles(transfer([root]))
    expect(relPaths(files)).toEqual(['drop/ok.png'])
    expect(errors).toEqual(['Could not read "drop/locked.png": NotReadableError'])
  })

  it('reports a folder that cannot be listed', async () => {
    const broken = {
      isFile: false,
      isDirectory: true,
      name: 'secret',
      createReader: () => ({ readEntries: (_ok: unknown, fail: (e: Error) => void) => fail(new Error('SecurityError')) }),
    } as unknown as FileSystemEntry
    const { files, errors } = await readDroppedFiles(transfer([broken, fileEntry('a.png')]))
    expect(files).toHaveLength(1)
    expect(errors).toEqual(['Could not read "secret": SecurityError'])
  })

  it('falls back to the plain files when the browser gives no entries', async () => {
    const plain = [new File(['x'], 'a.png'), new File(['x'], 'b.png')]
    const { files } = await readDroppedFiles({ items: [], files: plain, types: ['Files'] } as unknown as DataTransfer)
    expect(files).toEqual(plain)
  })
})

describe('dragHasFiles', () => {
  it('is true only for a drag that carries files', () => {
    expect(dragHasFiles({ types: ['Files'] } as unknown as DataTransfer)).toBe(true)
    expect(dragHasFiles({ types: ['text/plain'] } as unknown as DataTransfer)).toBe(false)
    expect(dragHasFiles(null)).toBe(false)
  })
})

describe('normalizeDropRoot', () => {
  const at = (path: string, mode: 'picked' | 'dragged' = 'dragged'): File => {
    const f = new File(['x'], path.split('/').pop() ?? path)
    Object.defineProperty(f, mode === 'picked' ? 'webkitRelativePath' : 'relativePath', { value: path })
    return f
  }
  const paths = (files: File[]) => files.map((f) => (f as File & { relativePath: string }).relativePath).sort()

  it('drops a container root, so the products inside it keep their own names', () => {
    const files = [at('legacy/gold-ring/thumbnail.png'), at('legacy/gold-ring/images/a.png'), at('legacy/silver-chain/images/c.png')]
    expect(paths(normalizeDropRoot(files))).toEqual(['gold-ring/images/a.png', 'gold-ring/thumbnail.png', 'silver-chain/images/c.png'])
  })

  it('keeps a root that is itself a product (it only holds product layout)', () => {
    const files = [at('gold-ring/thumbnail.png'), at('gold-ring/images/a.png'), at('gold-ring/variants/size-52/images/x.png')]
    expect(paths(normalizeDropRoot(files))).toEqual(['gold-ring/images/a.png', 'gold-ring/thumbnail.png', 'gold-ring/variants/size-52/images/x.png'])
  })

  it('gives the same paths for a picked folder and a dragged one', () => {
    const list = ['shop/product/ring-a/thumbnail/a.png', 'shop/brand/aurum/thumbnail/b.png']
    expect(paths(normalizeDropRoot(list.map((p) => at(p, 'picked'))))).toEqual(paths(normalizeDropRoot(list.map((p) => at(p, 'dragged')))))
    expect(paths(normalizeDropRoot(list.map((p) => at(p))))).toEqual(['brand/aurum/thumbnail/b.png', 'product/ring-a/thumbnail/a.png'])
  })

  it('keeps a root with only files, and loose files, as they are', () => {
    expect(paths(normalizeDropRoot([at('photos/a.png'), at('photos/b.png')]))).toEqual(['photos/a.png', 'photos/b.png'])
    expect(paths(normalizeDropRoot([at('a.png')]))).toEqual(['a.png'])
  })

  it('returns copies that share the bytes: same name, size and type', () => {
    const original = new File(['abc'], 'a.png', { type: 'image/png' })
    Object.defineProperty(original, 'relativePath', { value: 'x/y/a.png' })
    const [copy] = normalizeDropRoot([original])
    expect(copy).not.toBe(original)
    expect(copy?.name).toBe('a.png')
    expect(copy?.size).toBe(3)
    expect(copy?.type).toBe('image/png')
  })
})
