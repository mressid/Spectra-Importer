/** Hands bytes or text to the browser as a download. */
export function saveFile(fileName: string, data: Uint8Array | string, type: string): void {
  const blob = new Blob([data as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
