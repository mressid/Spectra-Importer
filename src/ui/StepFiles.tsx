import { useState } from 'react'
import { readImportFile } from '../adapters'
import type { ImportDocument, ResourceKind, SourceFormat } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import { templateDoc, templateExample } from '../templates/files'

export interface LoadedFile {
  name: string
  text: string
  document?: ImportDocument
  error?: string
}

interface StepFilesProps {
  files: Partial<Record<ResourceKind, LoadedFile>>
  onFilesChange: (files: Partial<Record<ResourceKind, LoadedFile>>) => void
  onNext: () => void
}

function downloadExample(kind: ResourceKind, format: SourceFormat) {
  const content = templateExample(kind, format)
  const ext = format === 'yaml' ? 'yaml' : format
  const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/yaml'
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${kind}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

export function StepFiles({ files, onFilesChange, onNext }: StepFilesProps) {
  const [expandedDoc, setExpandedDoc] = useState<ResourceKind | null>(null)
  const [dragOverKind, setDragOverKind] = useState<ResourceKind | null>(null)

  const handleFileDrop = async (kind: ResourceKind, file: File) => {
    try {
      const text = await file.text()
      const document = readImportFile(file.name, text, kind)
      onFilesChange({
        ...files,
        [kind]: { name: file.name, text, document },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      onFilesChange({
        ...files,
        [kind]: { name: file.name, text: '', error: message },
      })
    }
  }

  const handleRemove = (kind: ResourceKind) => {
    const updated = { ...files }
    delete updated[kind]
    onFilesChange(updated)
  }

  const hasAnyLoaded = Object.values(files).some((f) => f && f.document)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2>3. Choose Data Files</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            Load data files for each resource template (.json, .yaml, .yml or .csv).
          </p>
        </div>
        <button className="primary" type="button" onClick={onNext} disabled={!hasAnyLoaded}>
          Next: Check & Validate
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {RESOURCE_KINDS.map((kind) => {
          const tmpl = TEMPLATES[kind]
          const loaded = files[kind]
          const isDocOpen = expandedDoc === kind
          const isOver = dragOverKind === kind

          return (
            <div
              key={kind}
              style={{
                background: 'var(--ds-color-surface)',
                border: '1px solid var(--ds-color-border)',
                borderRadius: 'var(--ds-radius-card)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{tmpl.title}</h3>
                  <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                    Identifier: <code>{tmpl.idField}</code>
                    {tmpl.dependsOn.length > 0 && ` • Depends on: ${tmpl.dependsOn.join(', ')}`}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="small"
                    type="button"
                    onClick={() => setExpandedDoc(isDocOpen ? null : kind)}
                  >
                    {isDocOpen ? 'Hide guide' : 'View guide'}
                  </button>
                  <button
                    className="small"
                    type="button"
                    onClick={() => downloadExample(kind, 'csv')}
                    title="Download CSV example"
                  >
                    CSV example
                  </button>
                  <button
                    className="small"
                    type="button"
                    onClick={() => downloadExample(kind, 'json')}
                    title="Download JSON example"
                  >
                    JSON
                  </button>
                  <button
                    className="small"
                    type="button"
                    onClick={() => downloadExample(kind, 'yaml')}
                    title="Download YAML example"
                  >
                    YAML
                  </button>
                </div>
              </div>

              {isDocOpen && (
                <div style={{ marginBottom: '12px' }}>
                  <pre>{templateDoc(kind)}</pre>
                </div>
              )}

              {loaded ? (
                <div>
                  {loaded.error ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="badge error">
                        Error reading {loaded.name}: {loaded.error}
                      </div>
                      <button className="small danger" type="button" onClick={() => handleRemove(kind)}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--ds-color-surface-muted)',
                        borderRadius: 'var(--ds-radius-inner)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{loaded.name}</span>
                        <span className="badge success">
                          {loaded.document?.rows.length} rows loaded
                        </span>
                      </div>
                      <button className="small danger" type="button" onClick={() => handleRemove(kind)}>
                        Replace / Remove
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`dropzone ${isOver ? 'dragover' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverKind(kind)
                  }}
                  onDragLeave={() => setDragOverKind(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverKind(null)
                    const dropped = e.dataTransfer.files[0]
                    if (dropped) handleFileDrop(kind, dropped)
                  }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.json,.yaml,.yml,.csv'
                    input.onchange = () => {
                      const file = input.files?.[0]
                      if (file) handleFileDrop(kind, file)
                    }
                    input.click()
                  }}
                  style={{ padding: '16px' }}
                >
                  <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                    Drop <strong>{kind}</strong> file (.json, .yaml, .yml, .csv) or click to browse
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
