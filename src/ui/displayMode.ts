import { useEffect, useState } from 'react'

/** How the controls are drawn: with their words, with their icons, or both. */
export type DisplayMode = 'both' | 'text' | 'icons'

export const DISPLAY_MODES: { id: DisplayMode; label: string }[] = [
  { id: 'both', label: 'Icons and text' },
  { id: 'text', label: 'Text only' },
  { id: 'icons', label: 'Icons only' },
]

const KEY = 'store-importer:display'

export function readDisplayMode(storage: Pick<Storage, 'getItem'> = localStorage): DisplayMode {
  try {
    const stored = storage.getItem(KEY)
    return stored === 'text' || stored === 'icons' ? stored : 'both'
  } catch {
    return 'both'
  }
}

/**
 * Applies the display mode to the page (`<html data-display>`, read by index.css) and remembers it. The sidebar is not part of it.
 * - A button with an icon and no words keeps its icon in "text only" (it is marked `data-iconly`).
 * - In "icons only" a button gets its words as a tooltip, unless it has a title already.
 */
export function useDisplayMode(): [DisplayMode, (mode: DisplayMode) => void] {
  const [mode, setMode] = useState<DisplayMode>(() => readDisplayMode())

  useEffect(() => {
    document.documentElement.dataset.display = mode
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      // storage blocked: the choice only lasts for this visit
    }
  }, [mode])

  useEffect(() => {
    const mark = () => {
      for (const button of document.querySelectorAll('button:not(.dashboard-sidebar button)')) {
        const words = button.textContent?.trim() ?? ''
        if (words === '') button.setAttribute('data-iconly', '')
        else button.removeAttribute('data-iconly')
        if (mode === 'icons' && words !== '' && (!button.hasAttribute('title') || button.hasAttribute('data-auto-title'))) {
          button.setAttribute('title', words)
          button.setAttribute('data-auto-title', '')
        } else if (mode !== 'icons' && button.hasAttribute('data-auto-title')) {
          button.removeAttribute('title')
          button.removeAttribute('data-auto-title')
        }
      }
    }
    mark()
    const observer = new MutationObserver(mark)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [mode])

  return [mode, setMode]
}
