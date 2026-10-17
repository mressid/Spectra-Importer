import { describe, expect, it } from 'vitest'
import {
  getFullyCoveredNodeIds,
  isNodeFullyCovered,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './selectionUtils'

describe('selectionUtils - full element cover', () => {
  const node = { id: 'node-1', x: 100, y: 100 }

  it('returns true when marquee completely encloses node', () => {
    // Marquee enclosing [100, 340] x [100, 220]
    const box = {
      startX: 50,
      startY: 50,
      currentX: 400,
      currentY: 300,
    }
    expect(isNodeFullyCovered(node, box, NODE_WIDTH, NODE_HEIGHT)).toBe(true)
  })

  it('works regardless of drag direction (e.g. dragging bottom-right to top-left)', () => {
    const box = {
      startX: 400,
      startY: 300,
      currentX: 50,
      currentY: 50,
    }
    expect(isNodeFullyCovered(node, box, NODE_WIDTH, NODE_HEIGHT)).toBe(true)
  })

  it('returns false when marquee only partially intersects node', () => {
    // Only covers half of the node width
    const partialBox = {
      startX: 50,
      startY: 50,
      currentX: 200, // < 100 + 240 (340)
      currentY: 300,
    }
    expect(isNodeFullyCovered(node, partialBox, NODE_WIDTH, NODE_HEIGHT)).toBe(false)
  })

  it('returns false when node is completely outside marquee', () => {
    const outsideBox = {
      startX: 500,
      startY: 500,
      currentX: 800,
      currentY: 800,
    }
    expect(isNodeFullyCovered(node, outsideBox, NODE_WIDTH, NODE_HEIGHT)).toBe(false)
  })

  it('filters multiple nodes based on full element cover', () => {
    const nodes = [
      { id: 'fully-inside', x: 100, y: 100 },
      { id: 'partially-inside', x: 250, y: 100 },
      { id: 'completely-outside', x: 800, y: 800 },
    ]

    const box = {
      startX: 80,
      startY: 80,
      currentX: 360, // encloses [100, 340], does not enclose [250, 490]
      currentY: 240, // encloses [100, 220]
    }

    const covered = getFullyCoveredNodeIds(nodes, box, NODE_WIDTH, NODE_HEIGHT)
    expect(covered).toEqual(['fully-inside'])
  })
})
