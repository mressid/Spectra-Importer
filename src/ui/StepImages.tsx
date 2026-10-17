import { useRef, useState } from 'react'
import type { ImportDocument } from '../core/types'
import {
  generateRowsFromStructuredProduct,
  parseStructuredFolder,
  type StructuredProductFolder,
} from '../upload/folderStructure'
import type { ImageLibrary } from '../upload/imageLibrary'
import { addToLibrary, saveLibrary } from '../upload/imageLibrary'

interface StepImagesProps {
  library: ImageLibrary
  onLibraryChange: (newLibrary: ImageLibrary) => void
  onNext: () => void
  onAutoConfigure?: (productDoc: ImportDocument, variantDoc?: ImportDocument) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []
  const items = Array.from(dataTransfer.items || [])

  async function traverseEntry(entry: FileSystemEntry, path = ''): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      await new Promise<void>((resolve) => {
        fileEntry.file(
          (file) => {
            const relativePath = path ? `${path}/${file.name}` : file.name
            Object.defineProperty(file, 'relativePath', { value: relativePath, writable: false })
            files.push(file)
            resolve()
          },
          () => resolve(),
        )
      })
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const dirReader = dirEntry.createReader()
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        dirReader.readEntries(
          (results) => resolve(Array.from(results)),
          () => resolve([]),
        )
      })
      const nextPath = path ? `${path}/${entry.name}` : entry.name
      for (const child of entries) {
        await traverseEntry(child, nextPath)
      }
    }
  }

  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null && entry !== undefined)

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseEntry(entry)
    }
    return files
  }

  return Array.from(dataTransfer.files || [])
}

export function StepImages({ library, onLibraryChange, onNext, onAutoConfigure }: StepImagesProps) {
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [failures, setFailures] = useState<{ fileName: string; error: string }[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [detectedProducts, setDetectedProducts] = useState<StructuredProductFolder[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return

    setFailures([])

    // Check if the files match structured folder patterns
    const parsed = parseStructuredFolder(files)
    if (parsed.products.length > 0) {
      setDetectedProducts(parsed.products)
    }

    setUploadProgress({ done: 0, total: files.length })

    const updatedLibrary = new Map(library)
    const outcomes = await addToLibrary(files, updatedLibrary, {
      onProgress: (done, total) => {
        setUploadProgress({ done, total })
      },
    })

    const newFailures = outcomes
      .filter((o) => !o.ok)
      .map((o) => ({ fileName: o.fileName, error: (o as { error: string }).error }))

    setFailures(newFailures)
    setUploadProgress(null)
    onLibraryChange(updatedLibrary)
  }

  const handleAutoConfigure = (product: StructuredProductFolder) => {
    if (!onAutoConfigure) return

    const { productRow, variantRows } = generateRowsFromStructuredProduct(product)

    const productDoc: ImportDocument = {
      template: 'products',
      version: 1,
      rows: [productRow],
    }

    let variantDoc: ImportDocument | undefined
    if (variantRows.length > 0) {
      variantDoc = {
        template: 'variants',
        version: 1,
        rows: variantRows,
      }
    }

    onAutoConfigure(productDoc, variantDoc)
  }

  const handleCopy = (fileName: string) => {
    const text = `media:${fileName}`
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(fileName)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  const handleRemove = (fileName: string) => {
    const updated = new Map(library)
    updated.delete(fileName)
    saveLibrary(updated)
    onLibraryChange(updated)
  }

  const imagesList = Array.from(library.values())

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2>2. Image Library & Folder Uploader</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            Select folders or files. Folders structured with thumbnail, gallery images and variant subfolders are automatically detected.
          </p>
        </div>
        <button className="primary" type="button" onClick={onNext}>
          Next: Choose Files
        </button>
      </div>

      <div
        className={`dropzone ${isDragOver ? 'dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setIsDragOver(false)
          const files = await getFilesFromDataTransfer(e.dataTransfer)
          processFiles(files)
        }}
        style={{ marginBottom: '16px' }}
      >
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>
          Select or drop a structured folder (or media files)
        </p>
        <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', marginBottom: '12px' }}>
          Structure: <code>folder/&#123;thumbnail.png, images/*.png, variants/var1/images/*.png&#125;</code> (PNG, JPG, WEBP, MP4, etc.)
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="primary"
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            Select Structured Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            Select Individual Files
          </button>
        </div>
      </div>

      {/* Inputs for folder and file selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) processFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browsers
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) processFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />

      {/* Upload progress indicator */}
      {uploadProgress && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-small)' }}>
              Uploading files ({uploadProgress.done} / {uploadProgress.total})...
            </span>
            <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
              {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%
            </span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Detected structured product folders banner */}
      {detectedProducts.length > 0 && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-accent)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--ds-color-accent)' }}>
                Structured Product Folders Detected ({detectedProducts.length})
              </h3>
              <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                We identified thumbnail, gallery images and variant structures in your folder.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {detectedProducts.map((p) => (
              <div
                key={p.folderName}
                style={{
                  background: 'var(--ds-color-surface)',
                  border: '1px solid var(--ds-color-border)',
                  borderRadius: 'var(--ds-radius-inner)',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name} (slug: <code>{p.slug}</code>)</div>
                  <div style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span>🖼️ Thumbnail: <strong>{p.thumbnailFile?.name ?? 'None'}</strong></span>
                    <span>📸 Gallery: <strong>{p.galleryFiles.length} images</strong></span>
                    <span>🔀 Variants: <strong>{p.variants.length} ({p.variants.map((v) => v.name).join(', ') || 'None'})</strong></span>
                  </div>
                </div>

                {onAutoConfigure && (
                  <button
                    className="primary small"
                    type="button"
                    onClick={() => handleAutoConfigure(p)}
                  >
                    Auto-configure Product & Variants
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {failures.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--ds-color-error)' }}>Upload Warnings</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--ds-color-error)', fontSize: 'var(--ds-font-size-small)' }}>
            {failures.map((f, i) => (
              <li key={i}>
                <strong>{f.fileName}:</strong> {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3>Uploaded Library ({imagesList.length})</h3>
        </div>

        {imagesList.length === 0 ? (
          <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)' }}>
            No images uploaded yet. Select a structured folder or images above.
          </p>
        ) : (
          <div className="image-grid">
            {imagesList.map((img) => (
              <div key={img.fileName} className="image-card">
                {img.mediaType === 'VIDEO' ? (
                  <video src={img.url} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--ds-radius-inner)' }} />
                ) : (
                  <img src={img.url} alt={img.fileName} loading="lazy" />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--ds-font-size-caption)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={img.fileName}
                  >
                    {img.fileName}
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                      {formatSize(img.sizeBytes)}
                    </span>
                    {img.width && img.height && (
                      <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                        • {img.width}×{img.height}
                      </span>
                    )}
                    {img.duplicate && (
                      <span className="badge info">already in store</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                  <button
                    className="small"
                    type="button"
                    style={{ flex: 1 }}
                    onClick={() => handleCopy(img.fileName)}
                  >
                    {copiedKey === img.fileName ? 'Copied!' : 'Copy media:name'}
                  </button>
                  <button
                    className="small danger"
                    type="button"
                    title="Remove from local library"
                    onClick={() => handleRemove(img.fileName)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
