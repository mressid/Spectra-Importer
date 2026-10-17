import { TEMPLATES } from '../templates'
import { templateDoc } from '../templates/files'
import type { ResourceKind } from '../core/types'

const rawDocs = import.meta.glob('/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface DocArticle {
  id: string
  title: string
  category: 'media' | 'architecture' | 'templates' | 'workflow'
  content: string
}

export function getMediaLibraryDoc(): string {
  return rawDocs['/docs/MEDIA_LIBRARY.md'] ?? ''
}

export function getArchitectureDoc(): string {
  return rawDocs['/docs/ARCHITECTURE.md'] ?? ''
}

export function getAllDocArticles(): DocArticle[] {
  const articles: DocArticle[] = [
    {
      id: 'media-library',
      title: 'Media Library & Folder Structure',
      category: 'media',
      content: getMediaLibraryDoc(),
    },
    {
      id: 'architecture',
      title: 'Store Importer Architecture & Contracts',
      category: 'architecture',
      content: getArchitectureDoc(),
    },
    {
      id: 'graph-builder',
      title: 'Workflow Graph Builder & Bundler',
      category: 'workflow',
      content: `# Workflow Graph Builder Guide

The Graph Builder is a visual node-based catalogue designer for assembling products, variants, brands, categories, collections, tags, and media.

## Key Features
- **Visual Nodes:** Create Product, Brand, Category, Collection, Tag, Variant, and Media nodes with live previews.
- **Port Connections:** Drag connecting lines between node ports (e.g. \`belongs_to_brand\`, \`in_category\`, \`has_thumbnail\`, \`has_gallery_image\`).
- **Marquee Selection:** Click and drag on empty canvas space to select multiple nodes with full bounding-box coverage.
- **Catalogue Search Lightbox:** Search live store API records and preview remote media with responsive image and video lightboxes.
- **Bundler Compiler:** Compiles the visual graph into standard \`ImportDocument\` files and \`manifest.json\`, automatically injecting synthetic \`create:<slug>\` references where needed.
- **Direct Staging:** Stage graph documents directly into the importer pipeline with one click.
`,
    },
  ]

  // Add resource templates
  const templateKinds: ResourceKind[] = ['products', 'variants', 'categories', 'brands', 'collections', 'tags']
  for (const kind of templateKinds) {
    const tmpl = TEMPLATES[kind]
    articles.push({
      id: `template-${kind}`,
      title: `Template: ${tmpl.title}`,
      category: 'templates',
      content: templateDoc(kind),
    })
  }

  return articles
}
