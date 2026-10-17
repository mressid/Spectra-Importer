import { useRef, useState } from 'react'
import type { ImageLibrary } from '../upload/imageLibrary'
import { addToLibrary, saveLibrary } from '../upload/imageLibrary'

interface StepImagesProps {
  library: ImageLibrary
  onLibraryChange: (newLibrary: ImageLibrary) => void
  onNext: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StepImages({ library, onLibraryChange, onNext }: StepImagesProps) {
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [failures, setFailures] = useState<{ fileName: string; error: string }[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    setFailures([])
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
          <h2>2. Image Library</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            Upload product photos and videos once. Data files refer to them using <code>media:&lt;fileName&gt;</code>.
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
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        style={{ marginBottom: '16px' }}
      >
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>
          Drop images, videos, or whole folders here
        </p>
        <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', marginBottom: '12px' }}>
          Supports images up to 5 MB, MP4/WebM videos up to 50 MB
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            Select Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            Select Folder
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browsers but not typed in React standard input props
        webkitdirectory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

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
            No images uploaded yet. Drop some images above or proceed if using remote URLs.
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
