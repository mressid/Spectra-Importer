import { useState } from 'react'
import { readImportFile } from '../adapters'
import type { ImportDocument, ResourceKind, SourceFormat } from '../core/types'
import { TEMPLATES } from '../templates'
import { templateDoc, templateExample } from '../templates/files'
import { generateRowsFromStructuredProduct, parseStructuredFolder } from '../upload/folderStructure'
import type { ValidationResult } from '../validate/validate'
import {
  IconAlertCircle,
  IconCheckCircle,
  IconFileText,
  IconFolderOpen,
  IconTrash,
  IconUpload,
  ResourceIcon,
} from './Icons'
import type { LoadedFile } from './StepFiles'
import { MarkdownViewer } from './MarkdownViewer'

interface ResourceUploadTabProps {
  kind: ResourceKind
  file?: LoadedFile
  onFileChange: (file: LoadedFile | undefined) => void
  onAutoConfigureOther?: (otherKind: ResourceKind, doc: ImportDocument) => void
  validationResult?: ValidationResult
  onGoToValidate: () => void
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

export function ResourceUploadTab({
  kind,
  file,
  onFileChange,
  onAutoConfigureOther,
  validationResult,
  onGoToValidate,
}: ResourceUploadTabProps) {
  const [showDoc, setShowDoc] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const template = TEMPLATES[kind]

  const handleFileDrop = async (droppedFile: File) => {
    try {
      const text = await droppedFile.text()
      const document = readImportFile(droppedFile.name, text, kind)
      onFileChange({ name: droppedFile.name, text, document })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      onFileChange({ name: droppedFile.name, text: '', error: message })
    }
  }

  const handleStructuredFolder = (folderFiles: File[]) => {
    const parsed = parseStructuredFolder(folderFiles)
    if (parsed.products.length === 0) return

    const allProductRows = []
    const allVariantRows = []

    for (const p of parsed.products) {
      const { productRow, variantRows } = generateRowsFromStructuredProduct(p)
      allProductRows.push(productRow)
      allVariantRows.push(...variantRows)
    }

    if (kind === 'products') {
      const prodDoc: ImportDocument = {
        template: 'products',
        version: 1,
        rows: allProductRows,
      }
      onFileChange({
        name: `${parsed.products[0].slug}.json`,
        text: JSON.stringify(allProductRows),
        document: prodDoc,
      })

      if (allVariantRows.length > 0 && onAutoConfigureOther) {
        onAutoConfigureOther('variants', {
          template: 'variants',
          version: 1,
          rows: allVariantRows,
        })
      }
    } else if (kind === 'variants') {
      const varDoc: ImportDocument = {
        template: 'variants',
        version: 1,
        rows: allVariantRows,
      }
      onFileChange({
        name: `${parsed.products[0].slug}-variants.json`,
        text: JSON.stringify(allVariantRows),
        document: varDoc,
      })
    }
  }

  // Row preview
  const rows = file?.document?.rows ?? []
  const previewRows = rows.slice(0, 10)
  const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: 'var(--ds-radius-inner)',
                background: 'var(--ds-color-surface-muted)',
                border: '1px solid var(--ds-color-border)',
                color: 'var(--ds-color-primary)',
              }}
            >
              <ResourceIcon kind={kind} size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{template.title} Upload</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <span className="badge info">Endpoint: {template.endpoint}</span>
                <span className="badge">ID: {template.idField}</span>
                {template.dependsOn.length > 0 && (
                  <span className="badge warning">Depends on: {template.dependsOn.join(', ')}</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="small" type="button" onClick={() => setShowDoc(!showDoc)}>
              <IconFileText size={13} />
              {showDoc ? 'Hide Guide' : 'Documentation'}
            </button>
            <button className="small" type="button" onClick={() => downloadExample(kind, 'csv')}>
              CSV Example
            </button>
            <button className="small" type="button" onClick={() => downloadExample(kind, 'json')}>
              JSON
            </button>
            <button className="small" type="button" onClick={() => downloadExample(kind, 'yaml')}>
              YAML
            </button>
          </div>
        </div>

        {showDoc && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: 'var(--ds-color-surface-muted)',
              borderRadius: 'var(--ds-radius-card)',
              border: '1px solid var(--ds-color-border)',
              overflowX: 'auto',
            }}
          >
            <MarkdownViewer content={templateDoc(kind)} />
          </div>
        )}
      </div>

      {/* Upload Zone */}
      {!file?.document ? (
        <div className="card">
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
              const dropped = e.dataTransfer.files[0]
              if (dropped) handleFileDrop(dropped)
            }}
            style={{ padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--ds-radius-card)',
                background: 'var(--ds-color-surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ds-color-primary)',
                marginBottom: '12px',
              }}
            >
              <IconUpload size={24} />
            </div>

            <p style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)', margin: '0 0 4px' }}>
              Drop {template.title} data file here
            </p>
            <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', margin: '0 0 16px' }}>
              Accepted formats: .csv, .json, .yaml, .yml
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.csv,.json,.yaml,.yml'
                  input.onchange = () => {
                    const f = input.files?.[0]
                    if (f) handleFileDrop(f)
                  }
                  input.click()
                }}
              >
                <IconUpload size={16} />
                Choose {template.title} File
              </button>

              {(kind === 'products' || kind === 'variants') && (
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.setAttribute('webkitdirectory', '')
                    input.setAttribute('directory', '')
                    input.multiple = true
                    input.onchange = () => {
                      if (input.files) handleStructuredFolder(Array.from(input.files))
                    }
                    input.click()
                  }}
                >
                  <IconFolderOpen size={16} />
                  Choose Structured Folder
                </button>
              )}
            </div>
          </div>

          {file?.error && (
            <div className="badge error" style={{ width: '100%', marginTop: '12px', padding: '12px' }}>
              <IconAlertCircle size={16} />
              {file.error}
            </div>
          )}
        </div>
      ) : (
        /* Loaded File Inspection Card */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconFileText size={20} style={{ color: 'var(--ds-color-primary)' }} />
                <span style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)' }}>{file.name}</span>
              </div>
              <span className="badge success">{rows.length} rows loaded</span>
              {validationResult && (
                <span className={`badge ${validationResult.ok ? 'success' : 'error'}`}>
                  {validationResult.clean.length} valid
                  {validationResult.issues.length > 0 && ` (${validationResult.issues.length} issues)`}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onGoToValidate}>
                <IconCheckCircle size={15} />
                Validate & Check All
              </button>
              <button className="danger small" type="button" onClick={() => onFileChange(undefined)}>
                <IconTrash size={14} />
                Remove File
              </button>
            </div>
          </div>

          {/* Validation Issues for this Resource */}
          {validationResult && validationResult.issues.length > 0 && (
            <div style={{ marginBottom: '16px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--ds-color-surface-muted)', padding: '8px 12px', fontWeight: 600, fontSize: 'var(--ds-font-size-small)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconAlertCircle size={16} style={{ color: 'var(--ds-color-error)' }} />
                Issues Detected ({validationResult.issues.length})
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Row</th>
                    <th style={{ width: '120px' }}>Identifier</th>
                    <th style={{ width: '120px' }}>Field</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResult.issues.slice(0, 5).map((issue, idx) => (
                    <tr key={idx}>
                      <td>Row {issue.rowIndex + 1}</td>
                      <td><strong>{issue.rowId ?? '—'}</strong></td>
                      <td><code>{issue.field ?? 'general'}</code></td>
                      <td>
                        <span className={`badge ${issue.severity === 'error' ? 'error' : 'warning'}`}>
                          {issue.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Data Preview Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>Rows Preview (First {previewRows.length} of {rows.length})</h3>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      {columns.map((col) => {
                        const val = r[col]
                        const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')
                        return (
                          <td key={col} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
