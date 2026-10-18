import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImportDocument, ResourceKind } from '../core/types'
import {
  isLoggedIn,
  type WaitingMedia,
  type MediaBindingStatusDto,
} from '../upload/api'
import { bindAssets } from '../upload/bindAssets'
import { bindingRun, mediaRun, recordSafely } from '../history/record'
import { buildDropPlan, type DropPlan } from '../upload/dropPlan'
import type { StoreKind } from '../upload/bindingRules'
import { detectProductFolders } from '../upload/detectProductFolders'
import { dragHasFiles, normalizeDropRoot, readDroppedFiles } from '../upload/dropFiles'
import { EXAMPLE_COMBOS, exampleComboZip } from '../upload/exampleCombos'
import {
  buildFolderTemplate,
  EXAMPLE_ROWS,
  folderTemplateZip,
  FOLDER_TEMPLATE_ROOT,
  type FolderTemplateSource,
  type SlotTarget,
} from '../upload/folderTemplate'
import { groupWaiting, knownNames, type WaitingPlace, TEMPLATE_OF, waitingDataCsv, withoutRow } from '../upload/waitingMedia'
import {
  generateRowsFromStructuredProduct,
  isMediaFile,
  type StructuredProductFolder,
} from '../upload/folderStructure'
import type { ImageLibrary } from '../upload/imageLibrary'
import { addToLibrary, saveLibrary } from '../upload/imageLibrary'
import { describeFailure, describeNoMedia, groupFailures } from '../upload/uploadReport'
import {
  calculateAspectRatio,
  parseMediaFolder,
  type ParsedMediaAsset,
  type ParseMediaFolderResult,
} from '../upload/mediaFolderParser'
import {
  IconCamera,
  IconCheckCircle,
  IconClock,
  IconArrowRight,
  IconClose,
  IconCopy,
  IconFileText,
  IconFolderOpen,
  IconLink,
  IconMedia,
  IconTrash,
  IconUpload,
  IconVariant,
  IconWorkflow,
} from './Icons'
import { getMediaLibraryDoc } from './docsData'
import { DownloadMenu, type DownloadMenuGroup } from './DownloadMenu'
import { DropPreview } from './DropPreview'
import { PendingList } from './PendingList'
import { useToast } from './toastContext'
import { saveFile } from './saveFile'
import { MarkdownViewer } from './MarkdownViewer'

interface StepImagesProps {
  library: ImageLibrary
  onLibraryChange: (newLibrary: ImageLibrary) => void
  onNext: () => void
  /** Rows loaded in the Files step: they name the folders of the downloadable folder template. */
  documents?: Partial<Record<ResourceKind, ImportDocument | undefined>>
  /** What already exists in the store (slug / SKU -> id), for the review of a drop; empty until it is loaded. */
  storeIndex?: Partial<Record<ResourceKind, Map<string, string>>>
  /** Images uploaded and bound by name that wait for their product, variant... to be created; null = not loaded yet. */
  waiting?: WaitingMedia[] | null
  onRefreshWaiting?: () => Promise<void>
  onAutoConfigure?: (productDoc: ImportDocument, variantDoc?: ImportDocument) => void
  /** Start a configuration in the Graph Builder from these product folders (their photos and variants placed on the canvas). */
  onConfigureInGraph?: (folders: StructuredProductFolder[]) => void
  /** Assemble pending images (the place they wait for, with them) in the Graph Builder. */
  onAssemblePending?: (places: WaitingPlace[]) => void
}

const UPLOAD_KEY = 'store-importer.upload-panel-open'
const PREVIEW_KEY = 'store-importer.review-before-upload'

/** A drop is reviewed before it is uploaded, unless the user turned that off. */
function readPreviewFirst(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) !== '0'
  } catch {
    return true
  }
}

/** The upload panel is open unless the user closed it. */
function readUploadOpen(): boolean {
  try {
    return localStorage.getItem(UPLOAD_KEY) !== '0'
  } catch {
    return true
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StepImages({ library, onLibraryChange, onNext, documents, storeIndex, waiting, onRefreshWaiting, onAutoConfigure, onConfigureInGraph, onAssemblePending }: StepImagesProps) {
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const toast = useToast()
  const [plan, setPlan] = useState<DropPlan | null>(null)
  const [previewFirst, setPreviewFirst] = useState<boolean>(readPreviewFirst)
  const previewRef = useRef<HTMLDivElement>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [detectedProducts, setDetectedProducts] = useState<StructuredProductFolder[]>([])

  // Media Library folder parsing and bindings
  const [mediaFolderResult, setMediaFolderResult] = useState<ParseMediaFolderResult | null>(null)
  const [bindingStatuses, setBindingStatuses] = useState<Map<string, MediaBindingStatusDto[]>>(new Map())
  const [isSyncingBindings, setIsSyncingBindings] = useState(false)
  const [bindingSyncSummary, setBindingSyncSummary] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [templateNote, setTemplateNote] = useState<string | null>(null)
  const [waitingLoading, setWaitingLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState<boolean>(readUploadOpen)
  const changeUploadOpen = (open: boolean) => {
    setUploadOpen(open)
    try {
      localStorage.setItem(UPLOAD_KEY, open ? '1' : '0')
    } catch {
      // storage blocked: the choice only lasts for this visit
    }
  }
  const mediaDoc = useMemo(() => getMediaLibraryDoc(), [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  /** Empty folders for the rows loaded in the Files step: all of them, or one kind. */
  const downloadFolderTemplate = (kinds: (keyof FolderTemplateSource)[], fileSuffix: string) => {
    // nothing loaded for what was asked for: hand out the example layout so there is always a template to start from
    const useExample = kinds.every((kind) => !documents?.[kind]?.rows.length)
    const rows = (kind: keyof FolderTemplateSource) =>
      kinds.includes(kind) ? (useExample ? EXAMPLE_ROWS[kind] : documents?.[kind]?.rows) : undefined
    const template = buildFolderTemplate({
      products: rows('products'),
      variants: rows('variants'),
      categories: rows('categories'),
      brands: rows('brands'),
    })
    saveFile(`${FOLDER_TEMPLATE_ROOT}${fileSuffix}.zip`, folderTemplateZip(template), 'application/zip')
    setTemplateNote(
      [
        useExample
          ? `Downloaded an example layout${fileSuffix ? ` (${fileSuffix.slice(1)})` : ''}: rename the folders to your own slugs and SKUs, or load a data file in the Files step to get them named for you.`
          : `Downloaded ${template.folders.length} folders${fileSuffix ? ` (${fileSuffix.slice(1)})` : ''} from your loaded files.`,
        template.skipped.length > 0 ? `Skipped (name not usable as a folder on every OS): ${template.skipped.join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const waitingPlaces = useMemo(
    () =>
      groupWaiting(waiting ?? [], knownNames({
        products: documents?.products,
        variants: documents?.variants,
        categories: documents?.categories,
        brands: documents?.brands,
      })),
    [waiting, documents],
  )

  useEffect(() => {
    if (plan) previewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [plan])

  const handleRefreshWaiting = async () => {
    if (!onRefreshWaiting) return
    setWaitingLoading(true)
    try {
      await onRefreshWaiting()
    } finally {
      setWaitingLoading(false)
    }
  }

  /** A data file (CSV) with a row for each waiting name that no loaded file has a row for yet. */
  const downloadWaitingData = (target: SlotTarget) => {
    const names = withoutRow(waitingPlaces, target).map((place) => place.name)
    const blank = names.length === 0
    saveFile(`${TEMPLATE_OF[target]}-${blank ? 'template' : 'waiting'}.csv`, waitingDataCsv(target, names), 'text/csv')
    setTemplateNote(
      blank
        ? `Downloaded a blank ${target} CSV with the template columns. Add one row per ${target} and load it in the Files step.`
        : `Downloaded ${names.length} ${target} rows with the waiting names filled in. Fill in the other columns and load the file in the Files step; the images are attached when the rows are created.`,
    )
  }

  const withoutRowCount = (target: SlotTarget) => withoutRow(waitingPlaces, target).length
  const waitingDataItem = (target: SlotTarget, label: string) => ({
    id: `waiting-${target}`,
    label: withoutRowCount(target) > 0 ? `${label} (${withoutRowCount(target)})` : label,
    description:
      withoutRowCount(target) > 0
        ? 'CSV with the pending names filled in'
        : waiting
          ? `blank CSV with the template columns (no ${target} is pending without a row)`
          : 'blank CSV with the template columns (load the pending images to prefill names)',
    onSelect: () => downloadWaitingData(target),
  })

  const downloadExample = async (comboId: string) => {
    const combo = EXAMPLE_COMBOS.find((c) => c.id === comboId)
    if (!combo) return
    saveFile(`${combo.id}.zip`, await exampleComboZip(combo), 'application/zip')
    setTemplateNote(`Downloaded the example "${combo.title}" with ${combo.files.length - 1} sample photos and its README.`)
  }

  const loadedCount = (kind: keyof FolderTemplateSource) => documents?.[kind]?.rows.length ?? 0
  const loadedItem = (kind: keyof FolderTemplateSource, label: string, singular: string, suffix: string) => ({
    id: kind,
    label: loadedCount(kind) > 0 ? `${label} (${loadedCount(kind)})` : label,
    description:
      loadedCount(kind) > 0
        ? `empty folders named after each ${singular}`
        : `example layout (load a ${label.toLowerCase()} file to use your own names)`,
    onSelect: () => downloadFolderTemplate([kind], suffix),
  })
  const loadedTotal = loadedCount('products') + loadedCount('variants') + loadedCount('categories') + loadedCount('brands')

  const downloadGroups: DownloadMenuGroup[] = [
    {
      heading: 'Empty folders (named after your loaded files)',
      items: [
        {
          id: 'all',
          label: loadedTotal > 0 ? `Everything loaded (${loadedTotal})` : 'All four kinds',
          description: loadedTotal > 0 ? 'products, variants, categories and brands in one ZIP' : 'example layout for products, variants, categories and brands',
          onSelect: () => downloadFolderTemplate(['products', 'variants', 'categories', 'brands'], ''),
        },
        loadedItem('products', 'Products', 'product', '-products'),
        loadedItem('variants', 'Variants', 'variant', '-variants'),
        loadedItem('categories', 'Categories', 'category', '-categories'),
        loadedItem('brands', 'Brands', 'brand', '-brands'),
      ],
    },
    {
      heading: 'Data file templates (CSV)',
      items: [
        waitingDataItem('product', 'Products'),
        waitingDataItem('variant', 'Variants'),
        waitingDataItem('category', 'Categories'),
        waitingDataItem('brand', 'Brands'),
      ],
    },
    {
      heading: 'Examples with sample photos',
      items: EXAMPLE_COMBOS.map((combo) => ({
        id: combo.id,
        label: combo.title,
        description: combo.description,
        onSelect: () => downloadExample(combo.id),
      })),
    },
  ]

  /** Tells the user what a bind run did: errors one by one (grouped by message), the result as one line. */
  const reportBinding = (report: Awaited<ReturnType<typeof bindAssets>>) => {
    const byMessage = new Map<string, string[]>()
    for (const failure of report.failed) byMessage.set(failure.message, [...(byMessage.get(failure.message) ?? []), failure.fileName])
    for (const [message, files] of byMessage) {
      toast.error(files.length === 1 ? `${files[0]} was not bound: ${message}` : `${files.length} files were not bound: ${message} (${files.slice(0, 2).join(', ')}${files.length > 2 ? ` and ${files.length - 2} more` : ''})`)
    }
    if (report.applied + report.waiting > 0) {
      toast.success(
        `${report.applied} binding${report.applied === 1 ? '' : 's'} applied now` +
          (report.waiting > 0 ? `, ${report.waiting} waiting for their product, variant, category or brand to be created` : ''),
      )
    }
  }

  /** What a drop contains, as the review and the upload need it: the places that exist in the store and the rows of the loaded files. */
  const planContext = () => {
    const names = (kind: ResourceKind) => (storeIndex?.[kind] ? new Set(storeIndex[kind].keys()) : undefined)
    const existing: Partial<Record<StoreKind, ReadonlySet<string>>> = {}
    const pairs: [StoreKind, ResourceKind][] = [['product', 'products'], ['variant', 'variants'], ['category', 'categories'], ['brand', 'brands']]
    for (const [kind, resource] of pairs) {
      const set = names(resource)
      if (set && set.size > 0) existing[kind] = set
    }
    return { existing, inFiles: knownNames({ products: documents?.products, variants: documents?.variants, categories: documents?.categories, brands: documents?.brands }) }
  }

  /** A drop or a pick: say what is wrong at once, otherwise show the review (or upload straight away when the user turned it off). */
  const stageFiles = (picked: File[], unreadable: string[] = []) => {
    for (const message of unreadable) toast.error(message)
    // a picked and a dragged folder give the same paths, and a folder that holds products is never taken for one
    const dropped = normalizeDropRoot(picked)
    if (dropped.length === 0) {
      if (unreadable.length === 0) toast.error('Nothing to upload: no file was found in what you dropped.')
      return
    }
    if (!dropped.some((file) => isMediaFile(file.name))) {
      toast.error(describeNoMedia(dropped))
      return
    }
    const next = buildDropPlan(dropped, planContext())
    if (previewFirst) {
      setPlan(next)
      return
    }
    void applyPlan(next)
  }

  /** Uploads what the review shows (the files the store would refuse stay out) and binds each one as planned. */
  const applyPlan = async (reviewed: DropPlan) => {
    setPlan(null)
    if (reviewed.ignored.length > 0) toast.info(`${reviewed.ignored.length} file${reviewed.ignored.length === 1 ? ' is' : 's are'} not an image or video and ${reviewed.ignored.length === 1 ? 'was' : 'were'} left out.`)
    const refused = reviewed.files.filter((f) => !f.ready)
    for (const file of refused.slice(0, 3)) toast.error(`${file.relPath} was skipped: ${file.problems.join('; ')}`)
    if (refused.length > 3) toast.error(`${refused.length - 3} more files were skipped because the store would refuse them.`)
    const ready = reviewed.files.filter((f) => f.ready)
    if (ready.length === 0) {
      toast.error('Nothing to upload: the store would refuse every file.')
      return
    }
    if (!isLoggedIn()) {
      toast.error('Connect to the store first: uploading needs a login (Connect tab).')
      return
    }
    await uploadFiles(ready.map((f) => f.file), reviewed)
  }

  /** Keeps what a drop did in the store's History; a problem there is told, never thrown. */
  const saveToHistory = async (run: Parameters<typeof recordSafely>[0]) => {
    const stored = await recordSafely(run)
    if (stored && !stored.ok) toast.error(`Done, but it could not be saved in the History: ${stored.error}`)
  }

  const uploadFiles = async (files: File[], reviewed: DropPlan) => {
    setBindingSyncSummary(null)
    const startedAt = new Date().toISOString()
    try {
      // Check media library folder structure (targets, multi-name [a, b], roles, aspect ratios, orders)
      const mediaParsed = parseMediaFolder(files)
      // the positions the review showed, not new ones worked out from the files left after the refused ones were dropped
      const planned = new Map(reviewed.files.map((f) => [f.relPath, f]))
      for (const asset of mediaParsed.assets) {
        const reviewedFile = planned.get(asset.relativePath)
        if (reviewedFile) asset.bindings = reviewedFile.bindings
      }
      if (mediaParsed.assets.length > 0) {
        setMediaFolderResult(mediaParsed)
      }

      // product folders (the folder layout or the media library layout), to start a configuration from
      const folders = detectProductFolders(files)
      if (folders.length > 0) {
        setDetectedProducts(folders)
      }

      setUploadProgress({ done: 0, total: files.length })

      const updatedLibrary = new Map(library)
      const outcomes = await addToLibrary(files, updatedLibrary, {
        onProgress: (done, total) => {
          setUploadProgress({ done, total })
        },
      })
      setUploadProgress(null)
      onLibraryChange(updatedLibrary)

      for (const group of groupFailures(outcomes)) toast.error(describeFailure(group))
      const uploaded = outcomes.filter((o) => o.ok).length
      if (uploaded > 0) toast.success(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded.`)

      // dropping a folder also puts every file in its place: no second click
      let bound: Awaited<ReturnType<typeof bindAssets>> | null = null
      if (uploaded > 0 && mediaParsed.assets.length > 0) {
        setIsSyncingBindings(true)
        bound = await bindAssets(mediaParsed.assets, updatedLibrary)
        setIsSyncingBindings(false)
        setBindingStatuses((current) => new Map([...current, ...bound!.statuses]))
        reportBinding(bound)
        await onRefreshWaiting?.()
      }
      await saveToHistory(mediaRun(outcomes, mediaParsed.assets, bound, { startedAt, finishedAt: new Date().toISOString() }))
    } catch (error) {
      setUploadProgress(null)
      setIsSyncingBindings(false)
      toast.error(`The drop failed: ${(error as Error).message}`)
    }
  }

  /** Bind again what the last drop contains (after a failure was fixed in the store, or a place was created). */
  const handleSyncBindings = async () => {
    if (!mediaFolderResult || mediaFolderResult.assets.length === 0) return
    if (!isLoggedIn()) {
      toast.error('Connect to the store first (Connect tab).')
      return
    }
    setIsSyncingBindings(true)
    setBindingSyncSummary(null)
    const startedAt = new Date().toISOString()
    try {
      const report = await bindAssets(mediaFolderResult.assets, library)
      setBindingStatuses((current) => new Map([...current, ...report.statuses]))
      reportBinding(report)
      await onRefreshWaiting?.()
      await saveToHistory(bindingRun(mediaFolderResult.assets, report, { startedAt, finishedAt: new Date().toISOString() }))
    } catch (error) {
      toast.error(`Sync failed: ${(error as Error).message}`)
    } finally {
      setIsSyncingBindings(false)
    }
  }

  /** Rows (and graph nodes, in the app) for these product folders: the same SKU, price placeholder and images in both. */
  const handleAutoConfigure = (products: StructuredProductFolder[]) => {
    if (!onAutoConfigure || products.length === 0) return
    const generated = products.map((product) => generateRowsFromStructuredProduct(product))
    const productDoc: ImportDocument = { template: 'products', version: 1, rows: generated.map((g) => g.productRow) }
    const variantRows = generated.flatMap((g) => g.variantRows)
    const variantDoc: ImportDocument | undefined = variantRows.length > 0 ? { template: 'variants', version: 1, rows: variantRows } : undefined
    onAutoConfigure(productDoc, variantDoc)
  }

  const handleCopy = (fileName: string) => {
    const text = `media:${fileName}`
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(fileName)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  const handleRemove = (fileName: string) => {
    const updated = new Map(library)
    updated.delete(fileName)
    saveLibrary(updated)
    onLibraryChange(updated)
  }

  const imagesList = useMemo(() => Array.from(library.values()), [library])

  // Map of relativePath -> ParsedMediaAsset
  const assetMap = useMemo(() => {
    const map = new Map<string, ParsedMediaAsset>()
    if (mediaFolderResult) {
      for (const asset of mediaFolderResult.assets) {
        map.set(asset.relativePath, asset)
        map.set(asset.fileName, asset)
      }
    }
    return map
  }, [mediaFolderResult])

  return (
    <div
      className={`images-layout ${isDragOver ? 'drop-active' : ''}`}
      // a folder dropped anywhere on the step is taken (not only on the small drop zone, and never opened by the browser)
      onDragOver={(e) => {
        if (!dragHasFiles(e.dataTransfer)) return
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragOver(false)
      }}
      onDrop={(e) => {
        if (!dragHasFiles(e.dataTransfer)) return
        e.preventDefault()
        setIsDragOver(false)
        // read before anything is awaited: the browser empties the drop as soon as this handler returns
        const reading = readDroppedFiles(e.dataTransfer)
        void reading.then(({ files, errors }) => stageFiles(files, errors))
      }}
    >
    <div className="card images-main">
      <div className="step-header">
        <div className="step-header-text">
          <h2>2. Media Library</h2>
          <p style={{ color: 'var(--ds-color-text-secondary)', margin: 0 }}>
            Images waiting for their products, variants, categories and brands. Upload folders or files from the panel on the right: names are bound to a slug or SKU even before the data is imported.
          </p>
        </div>
        <button className="primary" type="button" onClick={onNext}>
          Next: Choose Files
          <IconArrowRight size={16} />
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <DownloadMenu
            label="Folder template"
            align="left"
            title="Empty folders named after your products, variants, categories and brands, or one of the documented examples. Fill them with photos, then drop the folder back in the upload panel"
            groups={downloadGroups}
          />
          <button type="button" aria-pressed={showGuide} onClick={() => setShowGuide(!showGuide)}>
            <IconFileText size={16} />
            Folder guide
          </button>
        </div>
        <button type="button" aria-pressed={uploadOpen} onClick={() => changeUploadOpen(!uploadOpen)}>
          <IconUpload size={16} />
          {uploadOpen ? 'Hide upload panel' : 'Show upload panel'}
        </button>
      </div>

      {templateNote && (
        <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', margin: '0 0 16px' }}>
          {templateNote} Unzip it, fill the folders with photos, then drop the extracted folder in the upload panel.
        </p>
      )}

      {/* Collapsible Folder Structure & Media Library Guide */}
      {showGuide && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '20px',
            marginBottom: '20px',
            maxHeight: '480px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--ds-color-accent)' }}>
              Media Library Folder Structure & Binding Specification
            </h3>
            <button className="small" type="button" onClick={() => setShowGuide(false)}>
              Close Guide
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <span className="badge">Multi-Name: [slug-a, slug-b]</span>
            <span className="badge">Order: [slug-a@1, slug-b@3]</span>
            <span className="badge">Roles: thumbnail | gallery | banner | logo</span>
            <span className="badge">Aspect Ratios: 1x1 | 4x5 | 16x9</span>
          </div>

          <MarkdownViewer content={mediaDoc} />
        </div>
      )}

      {plan && (
        <div ref={previewRef}>
          <DropPreview plan={plan} connected={isLoggedIn()} busy={uploadProgress !== null} onApply={() => void applyPlan(plan)} onCancel={() => setPlan(null)} />
        </div>
      )}

      <PendingList
        places={waitingPlaces}
        loaded={waiting !== null && waiting !== undefined}
        loading={waitingLoading}
        connected={isLoggedIn()}
        onRefresh={handleRefreshWaiting}
        onAssemble={onAssemblePending}
      />
    </div>
    {uploadOpen && (
      <aside className="sheet" aria-label="Upload images">
        <div className="sheet-header">
          <h3 style={{ margin: 0 }}>Upload images</h3>
          <button className="small" type="button" onClick={() => changeUploadOpen(false)} aria-label="Close upload panel" title="Close">
            <IconClose size={14} />
          </button>
        </div>
      <label className="review-toggle">
        <input
          type="checkbox"
          checked={previewFirst}
          onChange={(e) => {
            setPreviewFirst(e.target.checked)
            try {
              localStorage.setItem(PREVIEW_KEY, e.target.checked ? '1' : '0')
            } catch {
              // storage blocked: the choice only lasts for this visit
            }
          }}
        />
        Review what a drop will do before uploading
      </label>

      <div className={`dropzone ${isDragOver ? 'dragover' : ''}`} style={{ marginBottom: '16px' }}>
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>
          Select a structured media folder (or files), or drop it anywhere on this page
        </p>
        <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', marginBottom: '12px' }}>
          Supports: <code>[ring-a, ring-b]/gallery/01.jpg</code>, <code>category/rings/16x9/banner.jpg</code>, <code>product/slug/thumbnail.png</code>
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="primary"
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            <IconFolderOpen size={16} />
            Select Structured Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            <IconUpload size={16} />
            Select Individual Files
          </button>
        </div>
      </div>

      {/* Inputs for folder and file selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) stageFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in modern browsers
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) stageFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />

      {/* Upload progress indicator */}
      {uploadProgress && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: 'var(--ds-font-size-small)' }}>
              Uploading files ({uploadProgress.done} / {uploadProgress.total})...
            </span>
            <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
              {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%
            </span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Detected Media Library Bindings Banner */}
      {mediaFolderResult && mediaFolderResult.assets.length > 0 && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-accent)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--ds-color-accent)' }}>
                Media Library Bindings Detected ({mediaFolderResult.assets.length} assets)
              </h3>
              <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                Entities, roles, path-bound orders and aspect ratios parsed from directory structure.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isLoggedIn() ? (
                <button
                  className="primary small"
                  type="button"
                  onClick={handleSyncBindings}
                  disabled={isSyncingBindings || uploadProgress !== null}
                >
                  <IconLink size={14} />
                  {isSyncingBindings ? 'Syncing...' : 'Sync Bindings to Store'}
                </button>
              ) : (
                <span className="badge warning">Connect store to sync bindings</span>
              )}
            </div>
          </div>

          {/* Badges overview */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {Object.entries(mediaFolderResult.targetSummary).map(([target, count]) => (
              <span key={target} className="badge">
                {target}: {count} {count === 1 ? 'binding' : 'bindings'}
              </span>
            ))}
            {mediaFolderResult.multiBoundAssetsCount > 0 && (
              <span className="badge success">
                {mediaFolderResult.multiBoundAssetsCount} multi-bound assets ([a, b])
              </span>
            )}
          </div>

          {/* Binding sync summary notice */}
          {bindingSyncSummary && (
            <div
              style={{
                fontSize: 'var(--ds-font-size-small)',
                color: 'var(--ds-color-accent)',
                fontWeight: 500,
                marginBottom: '12px',
              }}
            >
              {bindingSyncSummary}
            </div>
          )}

          {/* Detected asset list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {mediaFolderResult.assets.map((asset) => {
              const image = library.get(asset.relativePath) || library.get(asset.fileName)
              const statuses = image?.id ? bindingStatuses.get(String(image.id)) : bindingStatuses.get(asset.relativePath)

              return (
                <div
                  key={asset.relativePath}
                  style={{
                    background: 'var(--ds-color-surface)',
                    border: '1px solid var(--ds-color-border)',
                    borderRadius: 'var(--ds-radius-inner)',
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--ds-font-size-small)' }}>
                      {asset.relativePath}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {asset.explicitAspectRatio && (
                        <span className="badge">{asset.explicitAspectRatio}</span>
                      )}
                      {asset.detectedAltText && (
                        <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                          Alt: &quot;{asset.detectedAltText}&quot;
                        </span>
                      )}
                      {asset.bindings.map((b, i) => (
                        <span key={i} className="badge">
                          {b.target}: <strong>{b.name}</strong> • {b.role} (#{b.order})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {statuses && statuses.length > 0 ? (
                      statuses.map((st, idx) => (
                        <span
                          key={idx}
                          className={`badge ${st.status === 'APPLIED' ? 'success' : 'warning'}`}
                          title={`${st.target}:${st.name} (${st.status})`}
                        >
                          {st.status === 'APPLIED' ? (
                            <IconCheckCircle size={12} />
                          ) : (
                            <IconClock size={12} />
                          )}
                          {st.status}
                        </span>
                      ))
                    ) : (
                      <span className="badge" style={{ color: 'var(--ds-color-text-secondary)' }}>
                        Pending Sync
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detected structured product folders banner (legacy/classic auto-configure) */}
      {detectedProducts.length > 0 && (
        <div
          style={{
            background: 'var(--ds-color-surface-muted)',
            border: '1px solid var(--ds-color-border)',
            borderRadius: 'var(--ds-radius-card)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                Product Folders Detected ({detectedProducts.length})
              </h3>
              <span style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)' }}>
                Auto-configure makes each product with a SKU, its photos and its variants, both as rows and in the Graph Builder, ready to edit there (the price is a placeholder to change).
              </span>
            </div>
            {onAutoConfigure && detectedProducts.length > 1 && (
              <button className="primary small" type="button" onClick={() => handleAutoConfigure(detectedProducts)}>
                <IconWorkflow size={14} />
                Auto-configure all {detectedProducts.length}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {detectedProducts.map((p) => (
              <div
                key={p.folderName}
                style={{
                  background: 'var(--ds-color-surface)',
                  border: '1px solid var(--ds-color-border)',
                  borderRadius: 'var(--ds-radius-inner)',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name} (slug: <code>{p.slug}</code>)</div>
                  <div style={{ fontSize: 'var(--ds-font-size-small)', color: 'var(--ds-color-text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconMedia size={14} />
                      Thumbnail: <strong>{p.thumbnailFile?.name ?? 'None'}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconCamera size={14} />
                      Gallery: <strong>{p.galleryFiles.length} images</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconVariant size={14} />
                      Variants: <strong>{p.variants.length} ({p.variants.map((v) => v.name).join(', ') || 'None'})</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {onAutoConfigure && (
                    <button
                      className="primary small"
                      type="button"
                      onClick={() => handleAutoConfigure([p])}
                      title="Adds the product (and its variants) with a SKU and these photos to the rows and to the Graph Builder"
                    >
                      <IconWorkflow size={14} />
                      Auto-configure
                    </button>
                  )}
                  {onConfigureInGraph && (
                    <button
                      className="small"
                      type="button"
                      onClick={() => onConfigureInGraph([p])}
                      title="Only in the Graph Builder, without rows and without a placeholder price"
                    >
                      Graph only
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3>Uploaded Library ({imagesList.length})</h3>
        </div>

        {imagesList.length === 0 ? (
          <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)' }}>
            No images uploaded yet. Select a structured folder or images above.
          </p>
        ) : (
          <div className="image-grid">
            {imagesList.map((img) => {
              const ratio = img.width && img.height ? calculateAspectRatio(img.width, img.height) : undefined
              const matchedAsset = assetMap.get(img.fileName)
              const statuses = img.id ? bindingStatuses.get(String(img.id)) : undefined

              return (
                <div key={img.fileName} className="image-card">
                  {img.mediaType === 'VIDEO' ? (
                    <video src={img.url} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--ds-radius-inner)' }} />
                  ) : (
                    <img src={img.url} alt={img.fileName} loading="lazy" />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 'var(--ds-font-size-caption)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={img.fileName}
                    >
                      {img.fileName}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                        {formatSize(img.sizeBytes)}
                      </span>
                      {img.width && img.height && (
                        <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
                          • {img.width}×{img.height}
                        </span>
                      )}
                      {ratio && (
                        <span className="badge" title={`Aspect ratio: ${ratio.formatted} (${ratio.orientation})`}>
                          {ratio.formatted}
                        </span>
                      )}
                      {img.duplicate && (
                        <span className="badge">already in store</span>
                      )}
                    </div>

                    {/* Bindings & store status if present */}
                    {matchedAsset && matchedAsset.bindings.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {matchedAsset.bindings.map((b, bi) => (
                          <span
                            key={bi}
                            className="badge"
                            style={{ fontSize: 'var(--ds-font-size-caption)' }}
                          >
                            {b.target}:{b.name} ({b.role.toLowerCase()})
                          </span>
                        ))}
                      </div>
                    )}

                    {statuses && statuses.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {statuses.map((st, si) => (
                          <span
                            key={si}
                            className={`badge ${st.status === 'APPLIED' ? 'success' : 'warning'}`}
                          >
                            {st.status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                    <button
                      className="small"
                      type="button"
                      style={{ flex: 1, gap: '4px' }}
                      onClick={() => handleCopy(img.fileName)}
                    >
                      <IconCopy size={13} />
                      {copiedKey === img.fileName ? 'Copied!' : 'Copy media:name'}
                    </button>
                    <button
                      className="small danger"
                      type="button"
                      title="Remove from local library"
                      aria-label="Remove image"
                      onClick={() => handleRemove(img.fileName)}
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </aside>
    )}
    </div>
  )
}
