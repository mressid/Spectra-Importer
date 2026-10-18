import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconChevronDown, IconDownload } from './Icons'

export interface DownloadMenuItem {
  id: string
  label: string
  description?: string
  disabled?: boolean
  /** Starts the download. The menu closes first; an error is shown under the menu. */
  onSelect: () => void | Promise<void>
}

export interface DownloadMenuGroup {
  heading: string
  items: DownloadMenuItem[]
}

interface DownloadMenuProps {
  label: ReactNode
  title?: string
  groups: DownloadMenuGroup[]
  /** Which edge of the button the list lines up with; use `left` for a button at the left of the screen. */
  align?: 'left' | 'right'
}

/** A button that opens a list of downloads; every row has a download icon. Closes on a choice, Escape or a click outside. */
export function DownloadMenu({ label, title, groups, align = 'right' }: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const items = () => Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    if (!open) {
      setOpen(true)
      return
    }
    const list = items()
    if (list.length === 0) return
    const current = list.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : event.key === 'ArrowDown' ? (current + 1) % list.length : (current - 1 + list.length) % list.length
    list[next].focus()
  }

  const choose = async (item: DownloadMenuItem) => {
    setOpen(false)
    setError(null)
    try {
      await item.onSelect()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={title}
        onClick={() => setOpen(!open)}
      >
        <IconDownload size={16} />
        {label}
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className={`menu-panel ${align === 'left' ? 'menu-left' : ''}`} id={menuId} role="menu">
          {groups.map((group) => (
            <div key={group.heading} role="group" aria-label={group.heading}>
              <div className="menu-heading">{group.heading}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  disabled={item.disabled}
                  onClick={() => choose(item)}
                >
                  <span className="menu-item-text">
                    <span className="menu-item-label">{item.label}</span>
                    {item.description && <span className="menu-item-description">{item.description}</span>}
                  </span>
                  <IconDownload size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {error && <div className={`menu-error ${align === 'left' ? 'menu-left' : ''}`} role="alert">{error}</div>}
    </div>
  )
}
