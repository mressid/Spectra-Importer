import { useCallback, useState } from 'react'
import type { ConflictMode, ResourceKind } from '../core/types'
import { isLoggedIn } from '../upload/api'
import type { ImageLibrary } from '../upload/imageLibrary'
import { loadLibrary } from '../upload/imageLibrary'
import type { PlanInput } from '../upload/plan'
import { loadStoreIndex } from '../upload/storeIndex'
import { StepCheck } from './StepCheck'
import { StepConnect } from './StepConnect'
import type { LoadedFile } from './StepFiles'
import { StepFiles } from './StepFiles'
import { StepImages } from './StepImages'
import { StepImport } from './StepImport'

export type StepId = 'connect' | 'images' | 'files' | 'check' | 'import'

export function App() {
  const [currentStep, setCurrentStep] = useState<StepId>('connect')
  const [connectedUser, setConnectedUser] = useState<string | null>(
    isLoggedIn() ? 'admin@store.local' : null,
  )

  const [library, setLibrary] = useState<ImageLibrary>(() => loadLibrary())
  const [files, setFiles] = useState<Partial<Record<ResourceKind, LoadedFile>>>({})
  const [storeIndex, setStoreIndex] = useState<Partial<Record<ResourceKind, Map<string, string>>>>({})
  const [storeIndexLoading, setStoreIndexLoading] = useState(false)

  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip')
  const [importOnlyValid, setImportOnlyValid] = useState(true)
  const [planInputs, setPlanInputs] = useState<PlanInput[]>([])

  const refreshStoreIndex = useCallback(async () => {
    setStoreIndexLoading(true)
    try {
      const idx = await loadStoreIndex()
      setStoreIndex(idx)
    } catch {
      // Failed to load index (e.g. backend offline or unauthorized)
    } finally {
      setStoreIndexLoading(false)
    }
  }, [])

  const initialStoreIds = Object.fromEntries(
    Object.entries(storeIndex).flatMap(([k, map]) => {
      if (!map) return []
      return Array.from(map.entries()).map(([id, storeId]) => [`${k}:${id}`, storeId])
    }),
  )

  const steps: { id: StepId; label: string }[] = [
    { id: 'connect', label: '1. Connect' },
    { id: 'images', label: '2. Images' },
    { id: 'files', label: '3. Choose Files' },
    { id: 'check', label: '4. Check' },
    { id: 'import', label: '5. Import' },
  ]

  return (
    <main style={{ maxWidth: '960px', margin: '32px auto', padding: '0 16px' }}>
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Store Importer</h1>
            <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
              Bulk upload catalogue data (tags, brands, categories, collections, products, variants) from JSON, YAML or CSV.
            </p>
          </div>
          {connectedUser && (
            <span className="badge success">
              ● {connectedUser}
            </span>
          )}
        </div>
      </header>

      {/* Step Navigation Bar */}
      <nav className="step-nav" aria-label="Import Steps">
        {steps.map((s) => {
          const isActive = currentStep === s.id
          return (
            <button
              key={s.id}
              type="button"
              className={isActive ? 'active' : ''}
              onClick={() => setCurrentStep(s.id)}
            >
              {s.label}
            </button>
          )
        })}
      </nav>

      {/* Active Step Content */}
      {currentStep === 'connect' && (
        <StepConnect
          onConnected={(email) => {
            setConnectedUser(email)
            setCurrentStep('images')
            refreshStoreIndex()
          }}
        />
      )}

      {currentStep === 'images' && (
        <StepImages
          library={library}
          onLibraryChange={(newLib) => setLibrary(newLib)}
          onNext={() => setCurrentStep('files')}
          onAutoConfigure={(productDoc, variantDoc) => {
            const updated = { ...files }
            updated.products = {
              name: `${String(productDoc.rows[0].slug)}.json`,
              text: JSON.stringify(productDoc.rows),
              document: productDoc,
            }
            if (variantDoc) {
              updated.variants = {
                name: `${String(productDoc.rows[0].slug)}-variants.json`,
                text: JSON.stringify(variantDoc.rows),
                document: variantDoc,
              }
            }
            setFiles(updated)
            setCurrentStep('check')
          }}
        />
      )}

      {currentStep === 'files' && (
        <StepFiles
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles)}
          onNext={() => setCurrentStep('check')}
        />
      )}

      {currentStep === 'check' && (
        <StepCheck
          files={files}
          library={library}
          storeIndex={storeIndex}
          storeIndexLoading={storeIndexLoading}
          onRefreshStoreIndex={refreshStoreIndex}
          conflictMode={conflictMode}
          setConflictMode={setConflictMode}
          importOnlyValid={importOnlyValid}
          setImportOnlyValid={setImportOnlyValid}
          onProceed={(inputs) => {
            setPlanInputs(inputs)
            setCurrentStep('import')
          }}
        />
      )}

      {currentStep === 'import' && (
        <StepImport
          inputs={planInputs}
          initialStoreIds={initialStoreIds}
          onBack={() => setCurrentStep('check')}
        />
      )}
    </main>
  )
}
