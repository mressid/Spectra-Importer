import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConflictMode, ResourceKind } from '../core/types'
import { RESOURCE_KINDS } from '../core/types'
import { TEMPLATES } from '../templates'
import { getCurrentUserEmail, isLoggedIn } from '../upload/api'
import type { ImageLibrary } from '../upload/imageLibrary'
import { libraryNames, loadLibrary } from '../upload/imageLibrary'
import type { PlanInput } from '../upload/plan'
import { loadStoreIndex, storeIndexToExisting } from '../upload/storeIndex'
import type { ValidationContext, ValidationResult } from '../validate/validate'
import { validateDocument } from '../validate/validate'
import { DashboardOverview } from './DashboardOverview'
import { IconChevronRight, IconPanelLeftClose, IconPanelLeftOpen, IconPlay, IconSettings } from './Icons'
import { ResourceUploadTab } from './ResourceUploadTab'
import type { TabId } from './Sidebar'
import { Sidebar } from './Sidebar'
import { StepCheck } from './StepCheck'
import { StepConnect } from './StepConnect'
import type { LoadedFile } from './StepFiles'
import { StepImages } from './StepImages'
import { listWaitingMedia, type WaitingMedia } from '../upload/api'
import { reservedThumbnailSlugs } from '../upload/waitingMedia'
import { StepImport } from './StepImport'
import { useDisplayMode } from './displayMode'
import { useTokenKeepAlive } from './useTokenKeepAlive'
import { GraphBuilder } from './GraphBuilder/GraphBuilder'
import { createPresetGraph } from '../graph/bundler'
import { graphFromDocuments } from '../graph/fromDocuments'
import { graphFromProductFolders } from '../graph/fromFolders'
import { graphFromPending } from '../graph/fromPending'
import { mergeGraphs } from '../graph/mergeGraph'
import type { ProductGraph } from '../graph/types'
import { mergeRows } from '../upload/mergeRows'
import type { WaitingPlace } from '../upload/waitingMedia'
import type { StructuredProductFolder } from '../upload/folderStructure'
import { useToast } from './toastContext'
import { DocumentationView } from './DocumentationView'
import { HistoryView } from './HistoryView'

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [connectedUser, setConnectedUser] = useState<string | null>(
    isLoggedIn() ? getCurrentUserEmail() : null,
  )

  const [library, setLibrary] = useState<ImageLibrary>(() => loadLibrary())
  const [files, setFiles] = useState<Partial<Record<ResourceKind, LoadedFile>>>({})
  const [storeIndex, setStoreIndex] = useState<Partial<Record<ResourceKind, Map<string, string>>>>({})
  const [storeIndexLoading, setStoreIndexLoading] = useState(false)
  /** Images uploaded and bound by name that wait for their product, variant... to be created; null = not loaded. */
  const [waitingMedia, setWaitingMedia] = useState<WaitingMedia[] | null>(null)
  /** The product graph. It lives here so that products added from other steps (auto-configure) are in it when the builder opens. */
  const [graph, setGraph] = useState<ProductGraph>(() => createPresetGraph('simple'))
  const toast = useToast()
  const reservedThumbnails = useMemo(() => reservedThumbnailSlugs(waitingMedia ?? []), [waitingMedia])

  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip')
  const [importOnlyValid, setImportOnlyValid] = useState(true)
  const [planInputs, setPlanInputs] = useState<PlanInput[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('store-importer:sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const [displayMode, setDisplayMode] = useDisplayMode()

  // the login is kept alive in silence; the connection button in the top bar shows when it cannot be
  useTokenKeepAlive(connectedUser, () => setConnectedUser(null))

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('store-importer:sidebar-collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const refreshWaitingMedia = useCallback(async () => {
    try {
      setWaitingMedia(await listWaitingMedia())
    } catch {
      setWaitingMedia(null)
    }
  }, [])

  // a session restored from storage: read the waiting images once so a product row may leave its thumbnail empty
  useEffect(() => {
    if (!connectedUser) return
    let cancelled = false
    listWaitingMedia()
      .then((items) => {
        if (!cancelled) setWaitingMedia(items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [connectedUser])

  // a restored session: read what exists in the store once, so the review of a dropped folder can say which places are there
  useEffect(() => {
    if (!connectedUser) return
    let cancelled = false
    loadStoreIndex()
      .then((index) => {
        if (!cancelled) setStoreIndex(index)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [connectedUser])

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
      reservedThumbnails,
    }

    for (const [k, f] of Object.entries(files)) {
      const kind = k as ResourceKind
      if (f?.document) {
        results[kind] = validateDocument(f.document, context)
      }
    }

    return results
  }, [files, library, storeIndex, reservedThumbnails])

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
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* Topbar Header */}
        <header className="dashboard-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: 'var(--ds-radius-inner)',
                background: 'transparent',
                border: '1px solid var(--ds-color-border)',
                color: 'var(--ds-color-text-secondary)',
                cursor: 'pointer',
                marginRight: '4px',
              }}
            >
              {sidebarCollapsed ? <IconPanelLeftOpen size={16} /> : <IconPanelLeftClose size={16} />}
            </button>
            <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
              Store Importer
            </span>
            <IconChevronRight size={14} style={{ color: 'var(--ds-color-text-secondary)' }} />
            <strong style={{ fontSize: 'var(--ds-font-size-base)', textTransform: 'capitalize' }}>
              {activeTab === 'connect' ? 'settings' : activeTab === 'operations' ? 'import' : activeTab}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

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
              isRunning={isRunning}
              onSelectTab={setActiveTab}
              onRunImport={handleRunFullImport}
            />
          )}

          {activeTab === 'builder' && (
            <GraphBuilder
              graph={graph}
              onGraphChange={setGraph}
              library={library}
              documents={{
                products: files.products?.document,
                variants: files.variants?.document,
                categories: files.categories?.document,
                brands: files.brands?.document,
                tags: files.tags?.document,
                collections: files.collections?.document,
              }}
              onStageDocuments={(documents) => {
                const updated = { ...files }
                for (const [k, doc] of Object.entries(documents)) {
                  const kind = k as ResourceKind
                  if (doc) {
                    updated[kind] = {
                      name: `${kind}-graph.json`,
                      text: JSON.stringify(doc.rows, null, 2),
                      document: doc,
                    }
                  }
                }
                setFiles(updated)
                setActiveTab('operations')
              }}
            />
          )}

          {activeTab === 'media' && (
            <StepImages
              library={library}
              onLibraryChange={setLibrary}
              onNext={() => setActiveTab('products')}
              onAssemblePending={(places: WaitingPlace[]) => {
                const assembled = graphFromPending(places)
                setGraph((current) => mergeGraphs(current, assembled.graph).graph)
                setActiveTab('builder')
                const parts = [
                  assembled.products > 0 ? `${assembled.products} product${assembled.products === 1 ? '' : 's'} with ${assembled.photos} image${assembled.photos === 1 ? '' : 's'}` : '',
                  assembled.variants > 0 ? `${assembled.variants} variant${assembled.variants === 1 ? '' : 's'}` : '',
                  assembled.categories > 0 ? `${assembled.categories} categor${assembled.categories === 1 ? 'y' : 'ies'}` : '',
                  assembled.brands > 0 ? `${assembled.brands} brand${assembled.brands === 1 ? '' : 's'}` : '',
                ].filter(Boolean)
                toast.success(`Assembled in the graph: ${parts.join(', ')}. Set the price and the rest there; the pending images are attached when it is created.`)
                if (assembled.otherPhotos > 0) {
                  toast.info(`${assembled.otherPhotos} image${assembled.otherPhotos === 1 ? '' : 's'} of variants, categories or brands are not drawn (the graph has no node for them): the store attaches them when the record is created.`)
                }
              }}
              onConfigureInGraph={(folders: StructuredProductFolder[]) => {
                const started = graphFromProductFolders(folders, library)
                setGraph((current) => mergeGraphs(current, started.graph).graph)
                setActiveTab('builder')
                toast.success(
                  `Graph started with ${started.products} product${started.products === 1 ? '' : 's'}, ${started.media} photo${started.media === 1 ? '' : 's'} and ${started.variants} variant${started.variants === 1 ? '' : 's'}. Set the price, brand and categories on the canvas.`,
                )
                if (started.variantPhotos > 0) {
                  toast.info(`${started.variantPhotos} variant photo${started.variantPhotos === 1 ? '' : 's'} are not in the graph (it has no variant images): drop the folder to bind them to their variants.`)
                }
              }}
              storeIndex={storeIndex}
              waiting={waitingMedia}
              onRefreshWaiting={refreshWaitingMedia}
              documents={{
                products: files.products?.document,
                variants: files.variants?.document,
                categories: files.categories?.document,
                brands: files.brands?.document,
              }}
              onAutoConfigure={(productDoc, variantDoc) => {
                // the same products, with the same SKUs and images, go to the rows (Files step) and into the graph
                const updated = { ...files }
                const products = mergeRows(files.products?.document, productDoc)
                updated.products = { name: files.products?.name ?? 'auto-configured-products.json', text: JSON.stringify(products.document.rows), document: products.document }
                if (variantDoc) {
                  const variants = mergeRows(files.variants?.document, variantDoc)
                  updated.variants = { name: files.variants?.name ?? 'auto-configured-variants.json', text: JSON.stringify(variants.document.rows), document: variants.document }
                }
                setFiles(updated)
                const inGraph = graphFromDocuments({ products: productDoc, variants: variantDoc }, library)
                setGraph((current) => mergeGraphs(current, inGraph.graph).graph)
                setActiveTab('builder')
                const n = productDoc.rows.length
                toast.success(
                  `${n} product${n === 1 ? '' : 's'} added to the graph and to the rows (Files step), with the same SKU and images. Edit them in the graph, then stage it to move the changes back into the rows.`,
                )
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
                reservedThumbnails={reservedThumbnails}
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
                  onRunningChange={setIsRunning}
                />
              )}
            </div>
          )}

          {activeTab === 'history' && <HistoryView connected={connectedUser !== null} />}

          {activeTab === 'connect' && (
            <StepConnect
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              onDisconnected={() => setConnectedUser(null)}
              onConnected={(email) => {
                setConnectedUser(email)
                refreshStoreIndex()
                setActiveTab('overview')
              }}
            />
          )}

          {activeTab === 'docs' && <DocumentationView />}
        </div>
      </main>
    </div>
  )
}
