import { useCallback, useMemo, useState } from 'react'
import type { ConflictMode, OperationResult, ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import { isLoggedIn } from '../upload/api'
import type { ImageLibrary } from '../upload/imageLibrary'
import { libraryNames, loadLibrary } from '../upload/imageLibrary'
import type { PlanInput } from '../upload/plan'
import { loadStoreIndex, storeIndexToExisting } from '../upload/storeIndex'
import type { ValidationContext, ValidationResult } from '../validate/validate'
import { validateDocument } from '../validate/validate'
import { DashboardOverview } from './DashboardOverview'
import { IconChevronRight, IconPlay, IconSettings } from './Icons'
import { ResourceUploadTab } from './ResourceUploadTab'
import type { TabId } from './Sidebar'
import { Sidebar } from './Sidebar'
import { StepCheck } from './StepCheck'
import { StepConnect } from './StepConnect'
import type { LoadedFile } from './StepFiles'
import { StepImages } from './StepImages'
import { StepImport } from './StepImport'
import { TokenStatusWidget } from './TokenStatusWidget'

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
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
  const [operationResults, setOperationResults] = useState<OperationResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const refreshStoreIndex = useCallback(async () => {
    setStoreIndexLoading(true)
    try {
      const idx = await loadStoreIndex()
      setStoreIndex(idx)
    } catch {
      // Offline or unauthenticated
    } finally {
      setStoreIndexLoading(false)
    }
  }, [])

  // Validation results across all loaded files
  const validationResults = useMemo(() => {
    const results: Partial<Record<ResourceKind, ValidationResult>> = {}
    const pending: Partial<Record<ResourceKind, Set<string>>> = {}

    for (const [k, f] of Object.entries(files)) {
      const kind = k as ResourceKind
      if (f?.document) {
        const tmpl = TEMPLATES[kind]
        pending[kind] = new Set(
          f.document.rows.map((r) => String(r[tmpl.idField] ?? '').trim()).filter(Boolean),
        )
      }
    }

    const context: ValidationContext = {
      pending,
      existing: storeIndexToExisting(storeIndex),
      images: libraryNames(library),
    }

    for (const [k, f] of Object.entries(files)) {
      const kind = k as ResourceKind
      if (f?.document) {
        results[kind] = validateDocument(f.document, context)
      }
    }

    return results
  }, [files, library, storeIndex])

  const initialStoreIds = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [k, storeMap] of Object.entries(storeIndex)) {
      if (storeMap) {
        for (const [id, storeId] of storeMap) {
          map[`${k}:${id}`] = storeId
        }
      }
    }
    return map
  }, [storeIndex])

  const handleRunFullImport = () => {
    const inputs: PlanInput[] = []
    for (const [k, res] of Object.entries(validationResults)) {
      const kind = k as ResourceKind
      if (res && res.clean.length > 0) {
        inputs.push({
          template: kind,
          rows: res.clean,
          onConflict: conflictMode,
          library,
        })
      }
    }

    if (inputs.length > 0) {
      setPlanInputs(inputs)
      setActiveTab('operations')
    }
  }

  const isResourceTab = (tab: TabId): tab is ResourceKind => {
    return RESOURCE_KINDS.includes(tab as ResourceKind)
  }

  const loadedFilesCount = Object.values(files).filter((f) => f && f.document).length

  return (
    <div className="dashboard-layout">
      {/* Sidebar with Navigation Tabs & Operations Brief */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectedUser={connectedUser}
        imageCount={library.size}
        files={files}
        operationResults={operationResults}
        totalOperations={planInputs.reduce((acc, p) => acc + p.rows.length, 0)}
        isRunning={isRunning}
      />

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* Topbar Header */}
        <header className="dashboard-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
              Store Importer
            </span>
            <IconChevronRight size={14} style={{ color: 'var(--ds-color-text-secondary)' }} />
            <strong style={{ fontSize: 'var(--ds-font-size-base)', textTransform: 'capitalize' }}>
              {activeTab}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TokenStatusWidget
              compact
              connectedUser={connectedUser}
              onAuthChange={(email) => {
                setConnectedUser(email)
                if (email) refreshStoreIndex()
              }}
            />

            {loadedFilesCount > 0 && (
              <button
                className="small primary"
                type="button"
                onClick={handleRunFullImport}
                disabled={isRunning}
                style={{ gap: '6px' }}
              >
                <IconPlay size={13} />
                Run Import ({loadedFilesCount} files ready)
              </button>
            )}

            {connectedUser ? (
              <button
                className="small"
                type="button"
                onClick={() => setActiveTab('connect')}
                style={{ gap: '6px' }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: 'var(--ds-radius-chip)',
                    background: 'var(--ds-color-accent)',
                  }}
                />
                {connectedUser}
              </button>
            ) : (
              <button
                className="small primary"
                type="button"
                onClick={() => setActiveTab('connect')}
                style={{ gap: '6px' }}
              >
                <IconSettings size={13} />
                Connect Store
              </button>
            )}
          </div>
        </header>

        {/* Tab Content Area */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <DashboardOverview
              files={files}
              imageCount={library.size}
              connectedUser={connectedUser}
              operationResults={operationResults}
              totalOperations={planInputs.reduce((acc, p) => acc + p.rows.length, 0)}
              isRunning={isRunning}
              onSelectTab={setActiveTab}
              onRunImport={handleRunFullImport}
              onAuthChange={(email) => {
                setConnectedUser(email)
                if (email) refreshStoreIndex()
              }}
            />
          )}

          {activeTab === 'media' && (
            <StepImages
              library={library}
              onLibraryChange={setLibrary}
              onNext={() => setActiveTab('products')}
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
                setActiveTab('products')
              }}
            />
          )}

          {isResourceTab(activeTab) && (
            <ResourceUploadTab
              kind={activeTab}
              file={files[activeTab]}
              onFileChange={(newFile) => {
                const updated = { ...files }
                if (newFile) updated[activeTab] = newFile
                else delete updated[activeTab]
                setFiles(updated)
              }}
              onAutoConfigureOther={(otherKind, doc) => {
                setFiles((prev) => ({
                  ...prev,
                  [otherKind]: {
                    name: `${doc.template}-generated.json`,
                    text: JSON.stringify(doc.rows),
                    document: doc,
                  },
                }))
              }}
              validationResult={validationResults[activeTab]}
              onGoToValidate={() => setActiveTab('operations')}
            />
          )}

          {activeTab === 'operations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                }}
              />

              {planInputs.length > 0 && (
                <StepImport
                  inputs={planInputs}
                  initialStoreIds={initialStoreIds}
                  onBack={() => setActiveTab('overview')}
                  onProgress={setOperationResults}
                  onRunningChange={setIsRunning}
                />
              )}
            </div>
          )}

          {activeTab === 'connect' && (
            <StepConnect
              onConnected={(email) => {
                setConnectedUser(email)
                refreshStoreIndex()
                setActiveTab('overview')
              }}
            />
          )}
        </div>
      </main>
    </div>
  )
}
