import { useMemo, useState } from 'react'
import { WAITING_TARGETS, type WaitingPlace } from '../upload/waitingMedia'
import type { SlotTarget } from '../upload/folderTemplate'
import { IconRefresh, IconSearch, IconWorkflow } from './Icons'

interface PendingListProps {
  places: WaitingPlace[]
  /** The list has been read from the store (an empty list is then a real answer). */
  loaded: boolean
  loading: boolean
  connected: boolean
  onRefresh: () => void
  /** Put these places and their images in the Graph Builder, to set the rest of their data there. */
  onAssemble?: (places: WaitingPlace[]) => void
}

const LABEL: Record<SlotTarget, string> = { product: 'Products', variant: 'Variants', category: 'Categories', brand: 'Brands' }
const MAX_ROWS = 300

/**
 * The main view of the Images step: photos already in the store and bound to a slug or SKU whose product, variant,
 * category or brand has not been created yet. Uploading is in the side panel; what it binds shows up here.
 */
export function PendingList({ places, loaded, loading, connected, onRefresh, onAssemble }: PendingListProps) {
  const [kind, setKind] = useState<SlotTarget | 'all'>('all')
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return places.filter((p) => (kind === 'all' || p.target === kind) && (!needle || p.name.toLowerCase().includes(needle)))
  }, [places, kind, query])

  const count = (target: SlotTarget) => places.filter((p) => p.target === target).length
  const inFiles = places.filter((p) => p.inFiles).length

  return (
    <section aria-label="Pending images">
      <div className="pending-header">
        <div>
          <h3 style={{ margin: 0 }}>
            Pending images {loaded && <span className="badge">{places.length}</span>}
          </h3>
          <div className="pending-hint">
            Already in the store, waiting for their product, variant, category or brand to be created.
            {loaded && places.length > 0 && ` ${inFiles} of ${places.length} have a row in your loaded files.`}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || !connected} title={connected ? undefined : 'Connect to the store first'}>
          <IconRefresh size={16} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!connected && <p className="pending-note">Connect to the store to see the pending images.</p>}
      {connected && !loaded && <p className="pending-note">{loading ? 'Loading...' : 'Not loaded yet. Press Refresh.'}</p>}
      {connected && loaded && places.length === 0 && (
        <p className="pending-note">
          Nothing is pending. Upload a folder in the panel on the right and press Sync Bindings: names that are not in the store yet will appear here.
        </p>
      )}

      {places.length > 0 && (
        <>
          <div className="pending-tools">
            <div className="pending-filters" role="group" aria-label="Filter by kind">
              <button className={`small ${kind === 'all' ? 'primary' : ''}`} type="button" onClick={() => setKind('all')}>
                All {places.length}
              </button>
              {WAITING_TARGETS.filter((t) => count(t) > 0).map((t) => (
                <button key={t} className={`small ${kind === t ? 'primary' : ''}`} type="button" onClick={() => setKind(t)}>
                  {LABEL[t]} {count(t)}
                </button>
              ))}
            </div>
            {onAssemble && shown.length > 0 && (
              <button
                className="small"
                type="button"
                onClick={() => onAssemble(shown)}
                title="Put every place in this list, with its images, in the Graph Builder"
              >
                <IconWorkflow size={14} />
                Assemble {shown.length === places.length ? 'all' : shown.length} in graph
              </button>
            )}
            <label className="pending-search">
              <IconSearch size={14} />
              <input type="search" placeholder="Find a slug or SKU" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a slug or SKU" />
            </label>
          </div>

          <ul className="pending-list">
            {shown.slice(0, MAX_ROWS).map((place) => {
              const images = [place.thumbnail, ...place.gallery].filter((m) => m !== null)
              const parts = [place.thumbnail ? 'thumbnail' : null, place.gallery.length > 0 ? `${place.gallery.length} gallery` : null].filter(Boolean)
              return (
                <li key={`${place.target}/${place.name}`} className="pending-row">
                  <div className="pending-text">
                    <code className="pending-name">{place.name}</code>
                    <span className="pending-meta">
                      {place.target} · {parts.join(' + ')}
                    </span>
                  </div>
                  <div className="pending-strip">
                    {images.slice(0, 5).map((m, i) =>
                      m.mediaType === 'IMAGE' ? (
                        <img key={`${m.uploadedFileId}|${m.role}${m.order}|${i}`} src={m.url} alt="" width={56} height={56} className="pending-thumb" />
                      ) : (
                        <span key={`${m.uploadedFileId}|${m.role}${m.order}|${i}`} className="pending-thumb" aria-hidden="true" />
                      ),
                    )}
                    {images.length > 5 && <span className="pending-more">+{images.length - 5}</span>}
                  </div>
                  {onAssemble && (
                    <button
                      className="small"
                      type="button"
                      onClick={() => onAssemble([place])}
                      title={`Put ${place.name} and its images in the Graph Builder, to set its price and the rest there`}
                    >
                      <IconWorkflow size={14} />
                      Assemble in graph
                    </button>
                  )}
                  <span
                    className={`badge ${place.inFiles ? 'success' : 'warning'}`}
                    title={place.inFiles ? 'A row of your loaded data files has this name: importing it attaches the images' : 'No loaded data file has a row with this name'}
                  >
                    {place.inFiles ? 'row loaded' : 'no row'}
                  </span>
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && <p className="pending-note">No match.</p>}
          {shown.length > MAX_ROWS && <p className="pending-note">and {shown.length - MAX_ROWS} more: narrow the list with the filter.</p>}
        </>
      )}
    </section>
  )
}
