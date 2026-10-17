export const NODE_WIDTH = 240
export const NODE_HEIGHT = 120

export interface MarqueeBox {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

/**
 * Determines whether a graph node is completely covered by a marquee selection box (full element cover).
 * A node is covered only if its entire bounding rectangle [x, x + width] x [y, y + height]
 * is strictly inside [minX, maxX] x [minY, maxY].
 */
export function isNodeFullyCovered(
  node: { x: number; y: number },
  box: MarqueeBox,
  nodeWidth = NODE_WIDTH,
  nodeHeight = NODE_HEIGHT,
): boolean {
  const minX = Math.min(box.startX, box.currentX)
  const maxX = Math.max(box.startX, box.currentX)
  const minY = Math.min(box.startY, box.currentY)
  const maxY = Math.max(box.startY, box.currentY)

  return (
    node.x >= minX &&
    node.x + nodeWidth <= maxX &&
    node.y >= minY &&
    node.y + nodeHeight <= maxY
  )
}

/**
 * Filters a list of nodes to those fully covered by the marquee box.
 */
export function getFullyCoveredNodeIds<T extends { id: string; x: number; y: number }>(
  nodes: T[],
  box: MarqueeBox,
  nodeWidth = NODE_WIDTH,
  nodeHeight = NODE_HEIGHT,
): string[] {
  return nodes
    .filter((node) => isNodeFullyCovered(node, box, nodeWidth, nodeHeight))
    .map((node) => node.id)
}
