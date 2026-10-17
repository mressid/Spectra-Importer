import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const html = useMemo(() => {
    // Configure marked for clean table and GitHub flavored markdown rendering
    const rawHtml = marked.parse(content, {
      async: false,
      gfm: true,
      breaks: false,
    }) as string

    if (typeof window !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
      return DOMPurify.sanitize(rawHtml)
    }
    return rawHtml
  }, [content])

  return (
    <div
      className={`markdown-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
