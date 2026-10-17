import { describe, expect, it } from 'vitest'
import { marked } from 'marked'

describe('Markdown parsing for template documentation', () => {
  it('parses markdown tables properly', () => {
    const tableMd = `
| Column | Required | Example |
|---|---|---|
| \`slug\` | yes | \`gold-ring\` |
| \`name\` | yes | \`Gold ring\` |
`
    const html = marked.parse(tableMd, { async: false }) as string
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Column</th>')
    expect(html).toContain('<td><code>slug</code></td>')
    expect(html).toContain('<td><code>gold-ring</code></td>')
  })

  it('parses headings and code blocks', () => {
    const content = `# Products Documentation\n\n\`\`\`json\n{"slug": "test"}\n\`\`\``
    const html = marked.parse(content, { async: false }) as string
    expect(html).toContain('<h1>Products Documentation</h1>')
    expect(html).toContain('<pre><code class="language-json">')
  })
})
