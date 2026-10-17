import { useState } from 'react'
import type { BundleResult } from '../../graph/types'
import {
  IconAlertCircle,
  IconCheck,
  IconCheckCircle,
  IconClose,
  IconCopy,
  IconDownload,
  IconPlay,
} from '../Icons'

interface ManifestModalProps {
  bundleResult: BundleResult
  onStageToImporter: () => void
  onClose: () => void
}

export function ManifestModal({
  bundleResult,
  onStageToImporter,
  onClose,
}: ManifestModalProps) {
  const [copied, setCopied] = useState(false)
  const jsonStr = JSON.stringify(bundleResult.manifest, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bundleResult.manifest.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-manifest.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = bundleResult.manifest.stats

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--ds-color-border)',
            background: 'var(--ds-color-surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--ds-font-size-title)' }}>
                Compiled Product Manifest
              </h2>
              {bundleResult.ok ? (
                <span className="badge success" style={{ gap: '4px' }}>
                  <IconCheckCircle size={12} /> Valid
                </span>
              ) : (
                <span className="badge warning" style={{ gap: '4px' }}>
                  <IconAlertCircle size={12} /> {bundleResult.issues.length} Issues
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
              Workflow graph assembled into catalog documents and executable import bundle.
            </p>
          </div>

          <button
            type="button"
            className="small"
            onClick={onClose}
            style={{ padding: '4px', border: 'none', background: 'transparent' }}
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Issue Alert if any */}
          {bundleResult.issues.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--ds-radius-card)',
                background: 'var(--ds-color-surface-muted)',
                border: '1px solid var(--ds-color-warning)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-warning)', marginBottom: '4px' }}>
                Warnings & Guidance:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--ds-font-size-caption)' }}>
                {bundleResult.issues.map((issue, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats KPI grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '10px',
            }}
          >
            <div style={{ padding: '10px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', background: 'var(--ds-color-surface-muted)' }}>
              <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Products</span>
              <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600 }}>{stats.products}</div>
            </div>
            <div style={{ padding: '10px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', background: 'var(--ds-color-surface-muted)' }}>
              <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Variants</span>
              <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600 }}>{stats.variants}</div>
            </div>
            <div style={{ padding: '10px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', background: 'var(--ds-color-surface-muted)' }}>
              <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Categories</span>
              <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600 }}>{stats.categories}</div>
            </div>
            <div style={{ padding: '10px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', background: 'var(--ds-color-surface-muted)' }}>
              <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Brands</span>
              <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600 }}>{stats.brands}</div>
            </div>
            <div style={{ padding: '10px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', background: 'var(--ds-color-surface-muted)' }}>
              <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Tags</span>
              <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600 }}>{stats.tags}</div>
            </div>
            <div style={{ padding: '10px', border: '1px solid var(--ds-color-border)', borderRadius: 'var(--ds-radius-inner)', background: 'var(--ds-color-surface-muted)' }}>
              <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>Collections</span>
              <div style={{ fontSize: 'var(--ds-font-size-title)', fontWeight: 600 }}>{stats.collections}</div>
            </div>
          </div>

          {/* JSON manifest code block */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: 'var(--ds-font-size-small)', fontWeight: 600 }}>
                Manifest Spec
              </span>
              <button
                type="button"
                className="small"
                onClick={handleCopy}
                style={{ gap: '4px' }}
              >
                {copied ? <IconCheck size={13} style={{ color: 'var(--ds-color-accent)' }} /> : <IconCopy size={13} />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>

            <pre
              style={{
                margin: 0,
                maxHeight: '260px',
                overflow: 'auto',
                padding: '12px 14px',
                borderRadius: 'var(--ds-radius-inner)',
                background: 'var(--ds-color-surface-muted)',
                border: '1px solid var(--ds-color-border)',
                fontSize: 'var(--ds-font-size-caption)',
                fontFamily: 'monospace',
                lineHeight: 1.4,
              }}
            >
              {jsonStr}
            </pre>
          </div>
        </div>

        {/* Modal Footer actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--ds-color-border)',
            background: 'var(--ds-color-surface-muted)',
          }}
        >
          <button
            type="button"
            onClick={handleDownload}
            style={{ gap: '6px' }}
          >
            <IconDownload size={14} />
            Download Manifest
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="primary"
              onClick={onStageToImporter}
              style={{ gap: '6px' }}
            >
              <IconPlay size={14} />
              Stage into Importer & Run
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
