/**
 * A minimal ZIP writer (no compression, "stored" entries). Enough to hand the user a folder skeleton and a
 * text file without a dependency. A name ending in "/" is a folder entry, which is what keeps empty folders
 * when the archive is extracted.
 */

export interface ZipEntry {
  /** Path inside the archive, "/" separated. Ends with "/" for a folder. */
  name: string
  /** Ignored for folders. */
  data?: string | Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** MS-DOS time and date words; the format cannot hold years before 1980. */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980)
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const encoder = new TextEncoder()
  const stamp = dosDateTime(now)
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const isFolder = entry.name.endsWith('/')
    const raw = isFolder ? new Uint8Array(0) : typeof entry.data === 'string' ? encoder.encode(entry.data) : (entry.data ?? new Uint8Array(0))
    const crc = crc32(raw)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0x0800, true) // names are UTF-8
    local.setUint16(8, 0, true) // stored
    local.setUint16(10, stamp.time, true)
    local.setUint16(12, stamp.date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, raw.length, true)
    local.setUint32(22, raw.length, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)

    const header = new DataView(new ArrayBuffer(46))
    header.setUint32(0, 0x02014b50, true)
    header.setUint16(4, 20, true) // version made by
    header.setUint16(6, 20, true)
    header.setUint16(8, 0x0800, true)
    header.setUint16(10, 0, true)
    header.setUint16(12, stamp.time, true)
    header.setUint16(14, stamp.date, true)
    header.setUint32(16, crc, true)
    header.setUint32(20, raw.length, true)
    header.setUint32(24, raw.length, true)
    header.setUint16(28, name.length, true)
    header.setUint32(38, isFolder ? 0x10 : 0, true) // MS-DOS directory attribute
    header.setUint32(42, offset, true)

    parts.push(new Uint8Array(local.buffer), name, raw)
    central.push(new Uint8Array(header.buffer), name)
    offset += 30 + name.length + raw.length
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const chunks = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let position = 0
  for (const chunk of chunks) {
    out.set(chunk, position)
    position += chunk.length
  }
  return out
}

/** Adds a folder entry for every parent folder of the entries, so the archive extracts with its whole tree. */
export function withParentFolders(entries: ZipEntry[]): ZipEntry[] {
  const folders = new Set<string>()
  for (const { name } of entries) {
    const parts = name.split('/').filter(Boolean)
    const depth = name.endsWith('/') ? parts.length : parts.length - 1
    for (let i = 1; i <= depth; i++) folders.add(`${parts.slice(0, i).join('/')}/`)
  }
  const files = entries.filter((entry) => !entry.name.endsWith('/'))
  return [...[...folders].sort().map((name) => ({ name })), ...files]
}
