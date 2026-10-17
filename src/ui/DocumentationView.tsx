import { useMemo, useState } from 'react'
import { getAllDocArticles, type DocArticle } from './docsData'
import { IconFileText, IconMedia, IconSearch, IconWorkflow } from './Icons'
import { MarkdownViewer } from './MarkdownViewer'

const CATEGORY_LABELS: Record<DocArticle['category'], string> = {
  media: 'Media Library & Uploads',
  architecture: 'Architecture & Engine',
  workflow: 'Workflow & Visual Designer',
  templates: 'Catalogue Templates',
}

interface DocumentationViewProps {
  initialArticleId?: string
}

export function DocumentationView({ initialArticleId = 'media-library' }: DocumentationViewProps) {
  const articles = useMemo(() => getAllDocArticles(), [])
  const [selectedArticleId, setSelectedArticleId] = useState<string>(initialArticleId)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles
    const q = searchQuery.toLowerCase()
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        CATEGORY_LABELS[a.category].toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q),
    )
  }, [articles, searchQuery])

  // Group by category
  const groupedArticles = useMemo(() => {
    const groups: Partial<Record<DocArticle['category'], DocArticle[]>> = {}
    for (const a of filteredArticles) {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category]!.push(a)
    }
    return groups
  }, [filteredArticles])

  const currentArticle = useMemo(() => {
    return (
      articles.find((a) => a.id === selectedArticleId) ||
      filteredArticles[0] ||
      articles[0]
    )
  }, [articles, filteredArticles, selectedArticleId])

  const getCategoryIcon = (category: DocArticle['category']) => {
    switch (category) {
      case 'media':
        return <IconMedia size={16} />
      case 'workflow':
        return <IconWorkflow size={16} />
      default:
        return <IconFileText size={16} />
    }
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '750px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Documentation & Reference Hub</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            In-app specifications for the Media Library, directory structure conventions, architecture contracts, and template schemas.
          </p>
        </div>
      </div>

      {/* Main layout: Sidebar + Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Navigation Sidebar */}
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ds-color-text-secondary)',
                display: 'flex',
              }}
            >
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search docs & syntax..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '32px',
                paddingTop: '6px',
                paddingBottom: '6px',
                borderRadius: 'var(--ds-radius-inner)',
                border: '1px solid var(--ds-color-border)',
                background: 'var(--ds-color-surface)',
                color: 'var(--ds-color-text-primary)',
                fontSize: 'var(--ds-font-size-small)',
              }}
            />
          </div>

          {/* Grouped Article List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '620px', overflowY: 'auto' }}>
            {(Object.keys(CATEGORY_LABELS) as DocArticle['category'][]).map((cat) => {
              const list = groupedArticles[cat]
              if (!list || list.length === 0) return null

              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      fontSize: 'var(--ds-font-size-caption)',
                      fontWeight: 600,
                      color: 'var(--ds-color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {getCategoryIcon(cat)}
                    {CATEGORY_LABELS[cat]}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {list.map((article) => {
                      const isSelected = article.id === currentArticle?.id
                      return (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => setSelectedArticleId(article.id)}
                          style={{
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: 'var(--ds-radius-inner)',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--ds-color-accent)' : 'transparent',
                            background: isSelected ? 'var(--ds-color-surface)' : 'transparent',
                            color: isSelected ? 'var(--ds-color-accent)' : 'var(--ds-color-text-primary)',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: 'var(--ds-font-size-small)',
                            cursor: 'pointer',
                            transition: 'all var(--ds-motion-fast)',
                          }}
                        >
                          {article.title}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Documentation Content Area */}
        <div
          style={{
            background: 'var(--ds-color-surface)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '24px',
            minHeight: '620px',
            overflowY: 'auto',
          }}
        >
          {currentArticle ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '16px',
                  marginBottom: '20px',
                  borderBottom: '1px solid var(--ds-color-border)',
                }}
              >
                <div>
                  <span
                    className="badge info"
                    style={{ marginBottom: '6px', fontSize: 'var(--ds-font-size-caption)' }}
                  >
                    {CATEGORY_LABELS[currentArticle.category]}
                  </span>
                  <h1 style={{ margin: 0, fontSize: 'var(--ds-font-size-title)' }}>
                    {currentArticle.title}
                  </h1>
                </div>
              </div>

              {/* Render Markdown Documentation */}
              <MarkdownViewer content={currentArticle.content} />
            </div>
          ) : (
            <p style={{ color: 'var(--ds-color-text-secondary)' }}>
              No documentation articles match your search query.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
