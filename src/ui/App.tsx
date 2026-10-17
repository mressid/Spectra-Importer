/**
 * TODO (docs/TASKS.md #4-#7): the screen. One page, five steps, state kept in a single reducer:
 *   1. Connect   - store address (default: same origin), email + password -> login() from upload/api.ts
 *   2. Images    - the image library (upload/imageLibrary.ts): drop images / a folder (<input webkitdirectory>), each is
 *                  uploaded at once, listed with thumbnail, size and the exact `media:<fileName>` text to copy; remove, re-upload
 *   3. Choose    - per template: drop a .json/.yaml/.csv file, download an example, read its doc
 *                  (templateExample / templateDoc)
 *   4. Check     - validateDocument() for every file, list Issue[] grouped by file and row, fix-and-reload;
 *                  "import valid rows only" vs "stop on any error"; conflict mode skip | update
 *   5. Import    - buildPlan() + runPlan(), live progress list, failures with the store's message, download the RunReport as JSON
 */
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'

export function App() {
  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      <h1>Store importer</h1>
      <p>Bulk upload of catalogue data from JSON, YAML or CSV. The screen is not built yet: see docs/TASKS.md.</p>
      <ol>
        {RESOURCE_KINDS.map((kind) => (
          <li key={kind}>{TEMPLATES[kind].title}</li>
        ))}
      </ol>
    </main>
  )
}
