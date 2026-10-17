import { useEffect, useMemo, useState } from 'react'
import type { GraphNode } from '../../graph/types'
import {
  type CatalogueSearchItem,
  filterCatalogueItems,
  loadCatalogueItems,
  type SearchableKind,
} from '../../graph/catalogueSearch'
import {
  IconBrand,
  IconCategory,
  IconClose,
  IconCollection,
  IconLink,
  IconMedia,
  IconPlus,
  IconSearch,
  IconTag,
} from '../Icons'

interface CatalogueSearchModalProps {
  selectedNode: GraphNode | null
  onSelectResource: (item: CatalogueSearchItem, connectToSelected: boolean) => void
  onClose: () => void
}

export function CatalogueSearchModal({
  selectedNode,
  onSelectResource,
  onClose,
}: CatalogueSearchModalProps) {
  const [items, setItems] = useState<CatalogueSearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedKind, setSelectedKind] = useState<SearchableKind | 'all'>('all')

  useEffect(() => {
    let active = true
    loadCatalogueItems()
      .then((res) => {
        if (active) {
          setItems(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filteredItems = useMemo(
    () => filterCatalogueItems(items, query, selectedKind),
    [items, query, selectedKind],
  )

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const getKindIcon = (kind: SearchableKind) => {
    switch (kind) {
      case 'brand':
        return <IconBrand size={14} style={{ color: 'var(--ds-color-info)' }} />
      case 'category':
        return <IconCategory size={14} style={{ color: 'var(--ds-status-confirmed)' }} />
      case 'tag':
        return <IconTag size={14} style={{ color: 'var(--ds-status-pending)' }} />
      case 'collection':
        return <IconCollection size={14} style={{ color: 'var(--ds-status-shipped)' }} />
      case 'media':
        return <IconMedia size={14} style={{ color: 'var(--ds-color-text-secondary)' }} />
    }
  }

  const getKindBadgeClass = (kind: SearchableKind) => {
    switch (kind) {
      case 'brand':
        return 'info'
      case 'category':
        return 'success'
      case 'tag':
        return 'warning'
      case 'collection':
        return 'info'
      case 'media':
        return ''
    }
  }

  const countsByKind = useMemo(() => {
    const counts: Record<string, number> = { all: items.length }
    for (const item of items) {
      counts[item.kind] = (counts[item.kind] ?? 0) + 1
    }
    return counts
  }, [items])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          background: 'var(--ds-color-surface)',
          border: '1px solid var(--ds-color-border)',
          borderRadius: 'var(--ds-radius-card)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--ds-color-border)',
            background: 'var(--ds-color-surface-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--ds-radius-inner)',
                background: 'var(--ds-color-surface)',
                border: '1px solid var(--ds-color-border)',
                color: 'var(--ds-color-primary)',
              }}
            >
              <IconSearch size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-base)' }}>
                Search Store Catalogue & Media Library
              </div>
              <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                Find existing tags, collections, brands, categories & media from the API to assemble onto canvas
              </div>
            </div>
          </div>

          <button
            type="button"
            className="small"
            onClick={onClose}
            style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer' }}
            title="Close (Esc)"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Search Input & Kind Filters */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--ds-color-border)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div
              style={{
                position: 'absolute',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                color: 'var(--ds-color-text-secondary)',
              }}
            >
              <IconSearch size={16} />
            </div>
            <input
              type="search"
              placeholder="Search by name, slug, or file name (e.g. 'Cartier', 'Rings', 'Gold', 'image.jpg')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{
                paddingLeft: '36px',
                paddingRight: query ? '36px' : '12px',
                fontSize: 'var(--ds-font-size-base)',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  color: 'var(--ds-color-text-secondary)',
                  cursor: 'pointer',
                }}
                title="Clear search"
              >
                <IconClose size={14} />
              </button>
            )}
          </div>

          {/* Kind Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { id: 'all', label: 'All Resources' },
                { id: 'tag', label: 'Tags' },
                { id: 'brand', label: 'Brands' },
                { id: 'category', label: 'Categories' },
                { id: 'collection', label: 'Collections' },
                { id: 'media', label: 'Media' },
              ] as const
            ).map((filter) => {
              const count = countsByKind[filter.id] ?? 0
              const isSelected = selectedKind === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedKind(filter.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--ds-radius-chip)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--ds-color-primary)' : 'var(--ds-color-border)',
                    background: isSelected ? 'var(--ds-color-surface-muted)' : 'transparent',
                    color: isSelected ? 'var(--ds-color-primary)' : 'var(--ds-color-text-secondary)',
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: 'var(--ds-font-size-caption)',
                    cursor: 'pointer',
                  }}
                >
                  {filter.label}
                  <span
                    style={{
                      opacity: 0.8,
                      fontSize: 'var(--ds-font-size-caption)',
                      background: 'var(--ds-color-surface)',
                      padding: '1px 5px',
                      borderRadius: 'var(--ds-radius-chip)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Results Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: '260px',
          }}
        >
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ds-color-text-secondary)' }}>
              Loading catalogue from store API and media library...
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--ds-color-text-secondary)',
                fontSize: 'var(--ds-font-size-small)',
              }}
            >
              No catalogue resources found matching &quot;<strong>{query}</strong>&quot;.
              <div style={{ marginTop: '8px', fontSize: 'var(--ds-font-size-caption)' }}>
                Try searching for brands, categories, tags, collections, or images from your image library.
              </div>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isMedia = item.kind === 'media'
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--ds-radius-card)',
                    border: '1px solid var(--ds-color-border)',
                    background: 'var(--ds-color-surface)',
                    gap: '12px',
                  }}
                >
                  {/* Left: Thumbnail & Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {isMedia && item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          borderRadius: 'var(--ds-radius-inner)',
                          border: '1px solid var(--ds-color-border)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--ds-radius-inner)',
                          background: 'var(--ds-color-surface-muted)',
                          border: '1px solid var(--ds-color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {getKindIcon(item.kind)}
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 'var(--ds-font-size-small)' }}>{item.name}</strong>
                        <span className={`badge ${getKindBadgeClass(item.kind)}`} style={{ textTransform: 'capitalize' }}>
                          {item.kind}
                        </span>
                        {item.isExistingInStore && (
                          <span
                            className="badge success"
                            style={{ fontSize: 'var(--ds-font-size-caption)', padding: '1px 5px' }}
                          >
                            Store API
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--ds-font-size-caption)',
                          color: 'var(--ds-color-text-secondary)',
                          fontFamily: 'monospace',
                          marginTop: '2px',
                        }}
                      >
                        {isMedia ? `media:${item.slug}` : `slug: ${item.slug}`}
                        {item.subtitle ? ` • ${item.subtitle}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {selectedNode && (
                      <button
                        type="button"
                        className="small primary"
                        onClick={() => {
                          onSelectResource(item, true)
                          onClose()
                        }}
                        style={{ gap: '4px', whiteSpace: 'nowrap' }}
                        title={`Add and connect to currently selected ${selectedNode.type} "${selectedNode.id}"`}
                      >
                        <IconLink size={13} />
                        Link to {selectedNode.type}
                      </button>
                    )}

                    <button
                      type="button"
                      className="small"
                      onClick={() => {
                        onSelectResource(item, false)
                        onClose()
                      }}
                      style={{ gap: '4px', whiteSpace: 'nowrap' }}
                      title="Add to canvas as standalone node"
                    >
                      <IconPlus size={13} />
                      Add to Canvas
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--ds-color-border)',
            background: 'var(--ds-color-surface-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--ds-font-size-caption)',
            color: 'var(--ds-color-text-secondary)',
          }}
        >
          <span>
            Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> catalogue resources
          </span>
          <button type="button" className="small" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
