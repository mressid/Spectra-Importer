import { useMemo, useRef, useState } from 'react'
import type { ImportDocument } from '../core/types'
import {
  isLoggedIn,
  setMediaBindings,
  type MediaBindingStatusDto,
} from '../upload/api'
import {
  generateRowsFromStructuredProduct,
  parseStructuredFolder,
  type StructuredProductFolder,
} from '../upload/folderStructure'
import type { ImageLibrary } from '../upload/imageLibrary'
import { addToLibrary, saveLibrary } from '../upload/imageLibrary'
import {
  calculateAspectRatio,
  parseMediaFolder,
  type ParsedMediaAsset,
  type ParseMediaFolderResult,
} from '../upload/mediaFolderParser'
import {
  IconCamera,
  IconCheckCircle,
  IconClock,
  IconCopy,
  IconFileText,
  IconFolderOpen,
  IconLink,
  IconMedia,
  IconTrash,
  IconUpload,
  IconVariant,
} from './Icons'
import { getMediaLibraryDoc } from './docsData'
import { MarkdownViewer } from './MarkdownViewer'

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

  // Media Library folder parsing and bindings
  const [mediaFolderResult, setMediaFolderResult] = useState<ParseMediaFolderResult | null>(null)
  const [bindingStatuses, setBindingStatuses] = useState<Map<string, MediaBindingStatusDto[]>>(new Map())
  const [isSyncingBindings, setIsSyncingBindings] = useState(false)
  const [bindingSyncSummary, setBindingSyncSummary] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const mediaDoc = useMemo(() => getMediaLibraryDoc(), [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return

    setFailures([])
    setBindingSyncSummary(null)

    // Check media library folder structure (targets, multi-name *:[...], roles, aspect ratios, orders)
    const mediaParsed = parseMediaFolder(files)
    if (mediaParsed.assets.length > 0) {
      setMediaFolderResult(mediaParsed)
    }

    // Check legacy product/variants structure
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

  const handleSyncBindings = async () => {
    if (!mediaFolderResult || mediaFolderResult.assets.length === 0) return
    setIsSyncingBindings(true)
    setBindingSyncSummary(null)

    const updatedStatuses = new Map(bindingStatuses)
    let appliedCount = 0
    let waitingCount = 0
    let failedCount = 0

    for (const asset of mediaFolderResult.assets) {
      if (asset.bindings.length === 0) continue

      // Look up image in library by relativePath or fileName
      const image = library.get(asset.relativePath) || library.get(asset.fileName)
      if (!image?.id) continue

      try {
        const statuses = await setMediaBindings({
          uploadedFileId: image.id,
          bindings: asset.bindings,
        })
        updatedStatuses.set(String(image.id), statuses)
        updatedStatuses.set(asset.relativePath, statuses)

        for (const st of statuses) {
          if (st.status === 'APPLIED') appliedCount++
          else if (st.status === 'WAITING') waitingCount++
        }
      } catch {
        failedCount++
      }
    }

    setBindingStatuses(updatedStatuses)
    setIsSyncingBindings(false)
    setBindingSyncSummary(
      `Bindings synced: ${appliedCount} applied immediately, ${waitingCount} waiting in pending_media${
        failedCount > 0 ? `, ${failedCount} errors` : ''
      }`,
    )
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

  const imagesList = useMemo(() => Array.from(library.values()), [library])

  // Map of relativePath -> ParsedMediaAsset
  const assetMap = useMemo(() => {
    const map = new Map<string, ParsedMediaAsset>()
    if (mediaFolderResult) {
      for (const asset of mediaFolderResult.assets) {
        map.set(asset.relativePath, asset)
        map.set(asset.fileName, asset)
      }
    }
    return map
  }, [mediaFolderResult])

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2>2. Media Library & Folder Uploader</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            Upload folders or files. Encodes targets, multi-names (<code>*:[slug-a, slug-b]</code>), roles, path orders, and aspect ratios into media bindings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" onClick={() => setShowGuide(!showGuide)} style={{ gap: '6px' }}>
            <IconFileText size={16} />
            {showGuide ? 'Hide Folder Guide' : 'Folder Structure Guide'}
          </button>
          <button className="primary" type="button" onClick={onNext}>
            Next: Choose Files
          </button>
        </div>
      </div>

      {/* Collapsible Folder Structure & Media Library Guide */}
      {showGuide && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '20px',
            marginBottom: '20px',
            maxHeight: '480px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--ds-color-accent)' }}>
              Media Library Folder Structure & Binding Specification
            </h3>
            <button className="small" type="button" onClick={() => setShowGuide(false)}>
              Close Guide
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <span className="badge info">Multi-Name Wildcards: *:[slug-a, slug-b]</span>
            <span className="badge info">Binding Order: *:[slug-a:1, slug-b:3]</span>
            <span className="badge info">Roles: thumbnail/ | gallery/ | banner/ | logo/</span>
            <span className="badge info">Aspect Ratios: 1:1/ | 4:5/ | 16:9/</span>
          </div>

          <MarkdownViewer content={mediaDoc} />
        </div>
      )}

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
          Select or drop a structured media folder (or files)
        </p>
        <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', marginBottom: '12px' }}>
          Supports: <code>*:[ring-a, ring-b]/gallery/01.jpg</code>, <code>category/rings/16:9/banner.jpg</code>, <code>product/slug/thumbnail.png</code>
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="primary"
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            <IconFolderOpen size={16} />
            Select Structured Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            <IconUpload size={16} />
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
        // @ts-expect-error webkitdirectory is standard in modern browsers
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

      {/* Detected Media Library Bindings Banner */}
      {mediaFolderResult && mediaFolderResult.assets.length > 0 && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-accent)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--ds-color-accent)' }}>
                Media Library Bindings Detected ({mediaFolderResult.assets.length} assets)
              </h3>
              <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                Entities, roles, path-bound orders and aspect ratios parsed from directory structure.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isLoggedIn() ? (
                <button
                  className="primary small"
                  type="button"
                  onClick={handleSyncBindings}
                  disabled={isSyncingBindings || uploadProgress !== null}
                >
                  <IconLink size={14} />
                  {isSyncingBindings ? 'Syncing...' : 'Sync Bindings to Store'}
                </button>
              ) : (
                <span className="badge warning">Connect store to sync bindings</span>
              )}
            </div>
          </div>

          {/* Badges overview */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {Object.entries(mediaFolderResult.targetSummary).map(([target, count]) => (
              <span key={target} className="badge info">
                {target}: {count} {count === 1 ? 'binding' : 'bindings'}
              </span>
            ))}
            {mediaFolderResult.multiBoundAssetsCount > 0 && (
              <span className="badge success">
                {mediaFolderResult.multiBoundAssetsCount} multi-bound assets (*:[...])
              </span>
            )}
          </div>

          {/* Binding sync summary notice */}
          {bindingSyncSummary && (
            <div
              style={{
                fontSize: 'var(--ds-font-size-small)',
                color: 'var(--ds-color-accent)',
                fontWeight: 500,
                marginBottom: '12px',
              }}
            >
              {bindingSyncSummary}
            </div>
          )}

          {/* Detected asset list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {mediaFolderResult.assets.map((asset) => {
              const image = library.get(asset.relativePath) || library.get(asset.fileName)
              const statuses = image?.id ? bindingStatuses.get(String(image.id)) : bindingStatuses.get(asset.relativePath)

              return (
                <div
                  key={asset.relativePath}
                  style={{
                    background: 'var(--ds-color-surface)',
                    border: '1px solid var(--ds-color-border)',
                    borderRadius: 'var(--ds-radius-inner)',
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-small)' }}>
                      {asset.relativePath}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {asset.explicitAspectRatio && (
                        <span className="badge info">{asset.explicitAspectRatio}</span>
                      )}
                      {asset.detectedAltText && (
                        <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                          Alt: &quot;{asset.detectedAltText}&quot;
                        </span>
                      )}
                      {asset.bindings.map((b, i) => (
                        <span key={i} className="badge">
                          {b.target}: <strong>{b.name}</strong> • {b.role} (#{b.order})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {statuses && statuses.length > 0 ? (
                      statuses.map((st, idx) => (
                        <span
                          key={idx}
                          className={`badge ${st.status === 'APPLIED' ? 'success' : 'warning'}`}
                          title={`${st.target}:${st.name} (${st.status})`}
                        >
                          {st.status === 'APPLIED' ? (
                            <IconCheckCircle size={12} />
                          ) : (
                            <IconClock size={12} />
                          )}
                          {st.status}
                        </span>
                      ))
                    ) : (
                      <span className="badge" style={{ color: 'var(--ds-color-text-secondary)' }}>
                        Pending Sync
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detected structured product folders banner (legacy/classic auto-configure) */}
      {detectedProducts.length > 0 && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                Product Folders Detected ({detectedProducts.length})
              </h3>
              <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                Optionally generate product and variant records from folder layout.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  <div style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconMedia size={14} />
                      Thumbnail: <strong>{p.thumbnailFile?.name ?? 'None'}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconCamera size={14} />
                      Gallery: <strong>{p.galleryFiles.length} images</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconVariant size={14} />
                      Variants: <strong>{p.variants.length} ({p.variants.map((v) => v.name).join(', ') || 'None'})</strong>
                    </span>
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
            {imagesList.map((img) => {
              const ratio = img.width && img.height ? calculateAspectRatio(img.width, img.height) : undefined
              const matchedAsset = assetMap.get(img.fileName)
              const statuses = img.id ? bindingStatuses.get(String(img.id)) : undefined

              return (
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
                      {ratio && (
                        <span className="badge info" title={`Aspect ratio: ${ratio.formatted} (${ratio.orientation})`}>
                          {ratio.formatted}
                        </span>
                      )}
                      {img.duplicate && (
                        <span className="badge info">already in store</span>
                      )}
                    </div>

                    {/* Bindings & store status if present */}
                    {matchedAsset && matchedAsset.bindings.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {matchedAsset.bindings.map((b, bi) => (
                          <span
                            key={bi}
                            className="badge"
                            style={{ fontSize: 'var(--ds-font-size-caption)' }}
                          >
                            {b.target}:{b.name} ({b.role.toLowerCase()})
                          </span>
                        ))}
                      </div>
                    )}

                    {statuses && statuses.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {statuses.map((st, si) => (
                          <span
                            key={si}
                            className={`badge ${st.status === 'APPLIED' ? 'success' : 'warning'}`}
                          >
                            {st.status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                    <button
                      className="small"
                      type="button"
                      style={{ flex: 1, gap: '4px' }}
                      onClick={() => handleCopy(img.fileName)}
                    >
                      <IconCopy size={13} />
                      {copiedKey === img.fileName ? 'Copied!' : 'Copy media:name'}
                    </button>
                    <button
                      className="small danger"
                      type="button"
                      title="Remove from local library"
                      aria-label="Remove image"
                      onClick={() => handleRemove(img.fileName)}
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
