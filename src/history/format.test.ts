import { describe, expect, it } from 'vitest'
import { badgeClass, describeCounts, formatDuration, isProblem } from './format'

const counts = { items: 0, created: 0, updated: 0, skipped: 0, failed: 0, blocked: 0, uploaded: 0, bound: 0 }

describe('describeCounts', () => {
  it('lists only what is not zero', () => {
    expect(describeCounts({ ...counts, created: 3, failed: 1, uploaded: 2, bound: 1 })).toBe('3 created · 1 failed · 2 files stored · 1 image placed')
    expect(describeCounts({ ...counts, updated: 1, skipped: 4, blocked: 2, uploaded: 1, bound: 5 })).toBe('1 updated · 4 skipped · 2 blocked · 1 file stored · 5 images placed')
  })
  it('says nothing for an empty run', () => expect(describeCounts(counts)).toBe('nothing'))
})

describe('formatDuration', () => {
  it('reads like a person would say it', () => {
    expect(formatDuration(850)).toBe('850 ms')
    expect(formatDuration(3500)).toBe('3.5 s')
    expect(formatDuration(42_400)).toBe('42 s')
    expect(formatDuration(65_000)).toBe('1 min 5 s')
  })
})

describe('badges', () => {
  it('colours runs and items by outcome', () => {
    expect(badgeClass('SUCCEEDED')).toBe('success')
    expect(badgeClass('PARTIAL')).toBe('warning')
    expect(badgeClass('FAILED')).toBe('error')
    expect(badgeClass('CANCELLED')).toBe('info')
    expect(badgeClass('SKIPPED')).toBe('')
    expect(badgeClass('WAITING')).toBe('warning')
  })
  it('flags the items that need a look', () => {
    expect(['FAILED', 'BLOCKED', 'CANCELLED'].every((s) => isProblem(s as never))).toBe(true)
    expect(['CREATED', 'SKIPPED', 'WAITING', 'DUPLICATE'].some((s) => isProblem(s as never))).toBe(false)
  })
})
