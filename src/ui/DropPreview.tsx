import { useEffect, useState } from 'react'
import type { DropPlan, PlanImage, PlanPlace } from '../upload/dropPlan'
import { IconChevronDown, IconClose, IconUpload } from './Icons'

interface DropPreviewProps {
  plan: DropPlan
  /** Logged in to the store: without it the plan can be read but not applied. */
  connected: boolean
  /** An upload is running. */
  busy: boolean
  onApply: () => void
  onCancel: () => void
}

const PLACES_SHOWN = 40
const THUMBS_PER_PLACE = 5
const PROBLEMS_SHOWN = 8

/**
 * A small picture of a photo about to be uploaded. The blob address is created when the picture mounts and revoked when it unmounts,
 * both inside the effect: React's development mode mounts, cleans up and mounts again, and an address created outside the effect
 * would already be revoked by the second mount.
 */
function Thumb({ image }: { image: PlanImage }) {
  const [url, setUrl] = useState<string | null>(null)
  // a file the store refuses is not drawn: it may not even be a picture (an SVG, a file that is too large)
  const isImage = image.file.mediaType === 'IMAGE' && image.file.ready
  const source = image.file.file
  useEffect(() => {
    if (!isImage || typeof URL.createObjectURL !== 'function') return
    const created = URL.createObjectURL(source)
    // the blob address is an external resource owned by this effect: it has to be kept in state to be rendered
    // eslint-disable-next-line react/set-state-in-effect
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [isImage, source])
  const caption = image.role === 'THUMBNAIL' ? 'thumbnail' : `#${image.order}`
  return (
    <figure className={`preview-thumb ${image.file.ready ? '' : 'refused'}`} title={`${image.file.relPath}${image.file.problems.length ? `: ${image.file.problems.join('; ')}` : ''}`}>
      {url ? <img src={url} alt="" /> : <span className="preview-thumb-empty" aria-hidden="true" />}
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

const STATUS_LABEL = { 'in-store': 'in the store: applied now', 'not-in-store': 'not in the store yet: reserved', unknown: '' } as const

function PlaceRow({ place }: { place: PlanPlace }) {
  const counts = [
    place.images.some((i) => i.role === 'THUMBNAIL') ? 'thumbnail' : null,
    place.images.filter((i) => i.role === 'GALLERY').length > 0 ? `${place.images.filter((i) => i.role === 'GALLERY').length} gallery` : null,
  ].filter(Boolean)
  const refused = place.images.filter((i) => !i.file.ready).length
  return (
    <li className="preview-row">
      <div className="preview-text">
        <code className="preview-name">{place.name}</code>
        <span className="preview-meta">
          {place.target} · {counts.join(' + ')}
          {refused > 0 ? ` · ${refused} refused` : ''}
        </span>
      </div>
      <div className="preview-strip">
        {place.images.slice(0, THUMBS_PER_PLACE).map((image) => (
          <Thumb key={`${image.file.relPath}|${image.role}|${image.order}`} image={image} />
        ))}
        {place.images.length > THUMBS_PER_PLACE && <span className="preview-more">+{place.images.length - THUMBS_PER_PLACE}</span>}
      </div>
      <div className="preview-badges">
        {place.status !== 'unknown' && <span className={`badge ${place.status === 'in-store' ? 'success' : 'warning'}`}>{STATUS_LABEL[place.status]}</span>}
        {place.inFiles && <span className="badge success" title="A row of your loaded data files has this name">row loaded</span>}
      </div>
    </li>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * What a drop will do, shown before anything is sent: each place with its photos, whether it exists in the store (the image is
 * set at once) or will be reserved, what the store would refuse and why. Nothing happens until "Upload".
 */
export function DropPreview({ plan, connected, busy, onApply, onCancel }: DropPreviewProps) {
  const [showAll, setShowAll] = useState(false)
  const { totals } = plan
  const refused = plan.files.filter((f) => !f.ready)
  const places = showAll ? plan.places : plan.places.slice(0, PLACES_SHOWN)
  const kinds = Object.entries(totals.places).map(([kind, n]) => plural(n, kind, kind === 'category' ? 'categories' : `${kind}s`))

  return (
    <section className="preview" aria-label="Review before uploading">
      <div className="preview-header">
        <div>
          <h3 style={{ margin: 0 }}>Review before uploading</h3>
          <div className="pending-hint">
            {totals.ready === 0
              ? 'Nothing in this drop can be uploaded.'
              : `${plural(totals.ready, 'file')} to upload, ${plural(totals.bindings, 'binding')}${kinds.length ? `: ${kinds.join(', ')}` : ''}.`}
            {totals.inStore + totals.reserved > 0 && ` ${totals.inStore} set now, ${totals.reserved} reserved.`}
          </div>
        </div>
        <div className="preview-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            <IconClose size={15} />
            Cancel
          </button>
          <button className="primary" type="button" onClick={onApply} disabled={busy || totals.ready === 0 || !connected} title={connected ? undefined : 'Connect to the store first'}>
            <IconUpload size={15} />
            Upload {plural(totals.ready, 'file')}
          </button>
        </div>
      </div>

      {!connected && <p className="pending-note">Connect to the store to upload.</p>}

      {(refused.length > 0 || plan.warnings.length > 0 || plan.ignored.length > 0) && (
        <ul className="preview-issues">
          {refused.slice(0, PROBLEMS_SHOWN).map((file) => (
            <li key={file.relPath} className="issue error">
              <span className="toast-dot" aria-hidden="true" />
              <span>
                <code>{file.relPath}</code> will not be uploaded: {file.problems.join('; ')}
              </span>
            </li>
          ))}
          {refused.length > PROBLEMS_SHOWN && (
            <li className="issue error">
              <span className="toast-dot" aria-hidden="true" />
              <span>and {refused.length - PROBLEMS_SHOWN} more files the store would refuse.</span>
            </li>
          )}
          {plan.warnings.slice(0, PROBLEMS_SHOWN).map((warning) => (
            <li key={warning} className="issue warning">
              <span className="toast-dot" aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
          {plan.ignored.length > 0 && (
            <li className="issue info">
              <span className="toast-dot" aria-hidden="true" />
              <span>
                {plural(plan.ignored.length, 'file is', 'files are')} not an image or video and will be left out ({plan.ignored.slice(0, 4).map((f) => f.name).join(', ')}
                {plan.ignored.length > 4 ? ', …' : ''}).
              </span>
            </li>
          )}
        </ul>
      )}

      <ul className="preview-list">
        {places.map((place) => (
          <PlaceRow key={`${place.target}/${place.name}`} place={place} />
        ))}
      </ul>
      {plan.places.length > PLACES_SHOWN && (
        <button className="small" type="button" onClick={() => setShowAll(!showAll)}>
          <IconChevronDown size={14} style={showAll ? { transform: 'rotate(180deg)' } : undefined} />
          {showAll ? 'Show fewer places' : `Show all ${plan.places.length} places`}
        </button>
      )}
    </section>
  )
}
