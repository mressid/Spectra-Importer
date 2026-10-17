import { describe, expect, it } from 'vitest'
import { getAllDocArticles, getArchitectureDoc, getMediaLibraryDoc } from './docsData'

describe('docsData', () => {
  it('loads MEDIA_LIBRARY.md markdown document', () => {
    const doc = getMediaLibraryDoc()
    expect(doc).toBeTruthy()
    expect(doc).toContain('Media Library & Folder Structure Importer')
    expect(doc).toContain('Wildcard & Multi-Name Syntax')
  })

  it('loads ARCHITECTURE.md markdown document', () => {
    const doc = getArchitectureDoc()
    expect(doc).toBeTruthy()
    expect(doc).toContain('Architecture')
    expect(doc).toContain('Media library folder bindings')
  })

  it('returns articles with all categories including media and templates', () => {
    const articles = getAllDocArticles()
    expect(articles.length).toBeGreaterThanOrEqual(8)

    const mediaArticle = articles.find((a) => a.id === 'media-library')
    expect(mediaArticle).toBeDefined()
    expect(mediaArticle?.category).toBe('media')

    const productTemplate = articles.find((a) => a.id === 'template-products')
    expect(productTemplate).toBeDefined()
    expect(productTemplate?.category).toBe('templates')
    expect(productTemplate?.content).toContain('slug')
  })
})
