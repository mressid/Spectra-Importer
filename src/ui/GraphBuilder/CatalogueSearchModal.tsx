import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GraphNode } from '../../graph/types'
import {
  type CatalogueSearchItem,
  fetchCatalogueItems,
  type SearchableKind,
} from '../../graph/catalogueSearch'
import {
  IconBrand,
  IconCategory,
  IconClose,
  IconCollection,
  IconCopy,
  IconEye,
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedKind, setSelectedKind] = useState<SearchableKind | 'all'>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [countsByKind, setCountsByKind] = useState<Record<string, number>>({})

  // Media preview lightbox state
  const [previewMedia, setPreviewMedia] = useState<CatalogueSearchItem | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Load items from API with query and pagination
  const loadItems = useCallback(
    async (q: string, kind: SearchableKind | 'all', pageNum: number, append = false) => {
      try {
        if (!append) setLoading(true)
        else setLoadingMore(true)

        const res = await fetchCatalogueItems({
          query: q,
          kind,
          page: pageNum,
          limitPerKind: 5, // user requirement: 5 max for each
        })

        if (append) {
          setItems((prev) => {
            const seen = new Set(prev.map((i) => `${i.kind}:${i.slug}`))
            const newItems = res.items.filter((i) => !seen.has(`${i.kind}:${i.slug}`))
            return [...prev, ...newItems]
          })
        } else {
          setItems(res.items)
        }

        setHasMore(res.hasMore)
        setCountsByKind(res.countsByKind)
        setPage(pageNum)
      } catch {
        // Fallback on error
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  // Trigger search with 200ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems(query, selectedKind, 0, false)
    }, 200)

    return () => clearTimeout(timer)
  }, [query, selectedKind, loadItems])

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    loadItems(query, selectedKind, page + 1, true)
  }

  // Esc key closes modal (or closes preview lightbox if open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewMedia) {
          setPreviewMedia(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewMedia, onClose])

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

  const filters: { id: SearchableKind | 'all'; label: string }[] = useMemo(
    () => [
      { id: 'all', label: 'All Resources' },
      { id: 'brand', label: 'Brands' },
      { id: 'category', label: 'Categories' },
      { id: 'tag', label: 'Tags' },
      { id: 'collection', label: 'Collections' },
      { id: 'media', label: 'Media Library' },
    ],
    [],
  )

  const handleCopyMediaRef = (slug: string) => {
    navigator.clipboard.writeText(`media:${slug}`)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1800)
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--ds-color-text-primary)',
          opacity: 0.7,
          zIndex: 100,
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
          padding: '20px',
          pointerEvents: 'none',
        }}
      >
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: '740px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            background: 'var(--ds-color-surface)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            boxShadow: '0 8px 32px var(--ds-color-border)',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--ds-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--ds-color-surface-muted)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-title)' }}>
                Search Store Catalogue
              </div>
              <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                Query tags, collections, media, brands, and categories (lazy loaded in batches of 5)
              </div>
            </div>

            <button
              type="button"
              className="small"
              onClick={onClose}
              style={{ padding: '6px', border: 'none', background: 'transparent' }}
              title="Close (Esc)"
            >
              <IconClose size={18} />
            </button>
          </div>

          {/* Search Bar & Kind Filter Tabs */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--ds-color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'var(--ds-color-surface)',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags, brands, categories, collections, or media..."
                autoFocus
                style={{
                  paddingLeft: '38px',
                  fontSize: 'var(--ds-font-size-small)',
                  width: '100%',
                }}
              />
              {query && (
                <button
                  type="button"
                  className="small"
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    border: 'none',
                    background: 'transparent',
                    padding: '4px',
                    color: 'var(--ds-color-text-secondary)',
                  }}
                  title="Clear search"
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {filters.map((filter) => {
                const isSelected = selectedKind === filter.id
                const count = countsByKind[filter.id] ?? 0
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
                    {count > 0 && (
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
                    )}
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
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--ds-color-text-secondary)' }}>
                Loading resources from Store API and Media Library...
              </div>
            ) : items.length === 0 ? (
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
                  Try a different query or select a different category tab.
                </div>
              </div>
            ) : (
              <>
                {items.map((item) => {
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
                          <div
                            style={{
                              position: 'relative',
                              width: '56px',
                              height: '56px',
                              borderRadius: 'var(--ds-radius-inner)',
                              overflow: 'hidden',
                              border: '1px solid var(--ds-color-border)',
                              background: 'var(--ds-color-surface-muted)',
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                            onClick={() => setPreviewMedia(item)}
                            title="Click to preview image in full size"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'var(--ds-color-surface-muted)',
                                opacity: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'opacity var(--ds-motion-fast)',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                            >
                              <IconEye size={16} style={{ color: 'var(--ds-color-primary)' }} />
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isMedia && item.imageUrl && (
                          <button
                            type="button"
                            className="small"
                            onClick={() => setPreviewMedia(item)}
                            style={{ gap: '4px' }}
                            title="Preview media image in large modal"
                          >
                            <IconEye size={13} />
                            Preview
                          </button>
                        )}

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
                          Add
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Load More (+5) Button */}
                {hasMore && (
                  <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={handleLoadMore}
                      style={{
                        padding: '6px 16px',
                        fontSize: 'var(--ds-font-size-small)',
                        gap: '6px',
                      }}
                    >
                      {loadingMore ? 'Loading next 5...' : 'Load More (+5 items)'}
                    </button>
                  </div>
                )}
              </>
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
              Showing <strong>{items.length}</strong> loaded items (batches of 5 max per kind)
            </span>
            <button type="button" className="small" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      {/* FULL MEDIA PREVIEW LIGHTBOX */}
      {previewMedia && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--ds-color-text-primary)',
              opacity: 0.85,
              zIndex: 200,
            }}
            onClick={() => setPreviewMedia(null)}
          />

          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 201,
              padding: '24px',
              pointerEvents: 'none',
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '680px',
                background: 'var(--ds-color-surface)',
                border: '1px solid var(--ds-color-border)',
                borderRadius: 'var(--ds-radius-card)',
                boxShadow: '0 12px 48px var(--ds-color-border)',
                overflow: 'hidden',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
              }}
            >
              {/* Preview Lightbox Header */}
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--ds-color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--ds-color-surface-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <IconMedia size={16} style={{ color: 'var(--ds-color-primary)' }} />
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--ds-font-size-base)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {previewMedia.name}
                  </span>
                </div>

                <button
                  type="button"
                  className="small"
                  onClick={() => setPreviewMedia(null)}
                  style={{ padding: '4px', border: 'none', background: 'transparent' }}
                  title="Close preview"
                >
                  <IconClose size={16} />
                </button>
              </div>

              {/* Preview Image / Video Stage */}
              <div
                style={{
                  padding: '20px',
                  background: 'var(--ds-color-surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxHeight: '55vh',
                  overflow: 'hidden',
                }}
              >
                {previewMedia.slug.endsWith('.mp4') || previewMedia.slug.endsWith('.webm') ? (
                  <video
                    src={previewMedia.imageUrl}
                    controls
                    autoPlay
                    style={{
                      maxWidth: '100%',
                      maxHeight: '50vh',
                      borderRadius: 'var(--ds-radius-inner)',
                    }}
                  />
                ) : (
                  <img
                    src={previewMedia.imageUrl}
                    alt={previewMedia.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '50vh',
                      objectFit: 'contain',
                      borderRadius: 'var(--ds-radius-inner)',
                      border: '1px solid var(--ds-color-border)',
                    }}
                  />
                )}
              </div>

              {/* Preview Metadata & Actions */}
              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--ds-color-border)',
                  background: 'var(--ds-color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ fontSize: 'var(--ds-font-size-caption)' }}>
                      media:{previewMedia.slug}
                    </code>
                    <button
                      type="button"
                      className="small"
                      onClick={() => handleCopyMediaRef(previewMedia.slug)}
                      style={{ padding: '2px 6px', gap: '4px' }}
                      title="Copy media reference key"
                    >
                      <IconCopy size={12} />
                      {copiedKey ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {previewMedia.subtitle && (
                    <div
                      style={{
                        fontSize: 'var(--ds-font-size-caption)',
                        color: 'var(--ds-color-text-secondary)',
                        marginTop: '4px',
                      }}
                    >
                      {previewMedia.subtitle}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {selectedNode && (
                    <button
                      type="button"
                      className="small primary"
                      onClick={() => {
                        onSelectResource(previewMedia, true)
                        setPreviewMedia(null)
                        onClose()
                      }}
                      style={{ gap: '4px' }}
                    >
                      <IconLink size={13} />
                      Link to {selectedNode.type}
                    </button>
                  )}
                  <button
                    type="button"
                    className="small"
                    onClick={() => {
                      onSelectResource(previewMedia, false)
                      setPreviewMedia(null)
                      onClose()
                    }}
                    style={{ gap: '4px' }}
                  >
                    <IconPlus size={13} />
                    Add to Canvas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
