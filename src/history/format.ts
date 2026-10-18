import type { ItemStatus, RunCounts, RunStatus } from './types'

/** "3 created · 1 failed · 2 files stored · 4 images placed", only what is not zero; "nothing" for an empty run. */
export function describeCounts(counts: RunCounts): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const parts = [
    counts.created > 0 && `${counts.created} created`,
    counts.updated > 0 && `${counts.updated} updated`,
    counts.skipped > 0 && `${counts.skipped} skipped`,
    counts.failed > 0 && `${counts.failed} failed`,
    counts.blocked > 0 && `${counts.blocked} blocked`,
    counts.uploaded > 0 && `${plural(counts.uploaded, 'file', 'files')} stored`,
    counts.bound > 0 && `${plural(counts.bound, 'image', 'images')} placed`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'nothing'
}

/** 850 → "0.9 s", 65_000 → "1 min 5 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)} s`
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`
}

/** The badge colour of a run or of one of its items. */
export function badgeClass(status: RunStatus | ItemStatus): 'success' | 'warning' | 'error' | 'info' | '' {
  switch (status) {
    case 'SUCCEEDED':
    case 'CREATED':
    case 'UPDATED':
    case 'UPLOADED':
    case 'APPLIED':
      return 'success'
    case 'PARTIAL':
    case 'BLOCKED':
    case 'WAITING':
      return 'warning'
    case 'FAILED':
      return 'error'
    case 'CANCELLED':
      return 'info'
    default:
      return ''
  }
}

/** Items that need a look: failed, blocked, or never run. */
export const isProblem = (status: ItemStatus): boolean => status === 'FAILED' || status === 'BLOCKED' || status === 'CANCELLED'
