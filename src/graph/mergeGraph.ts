/**
 * Puts nodes into a graph that already has some, without duplicating what is the same: a node is the same when its kind and its
 * identifier (slug, SKU, file name) are. A node that is there is updated with what the incoming one says (fields the incoming
 * one does not have stay as they are, and the node keeps its place on the canvas); a new one is added below what is there,
 * and edges are added unless they exist. So auto-configuring the same product twice, or loading rows again, updates it.
 */
import { createPresetGraph } from './bundler'
import type { GraphNode, ProductGraph } from './types'

export interface MergeResult {
  graph: ProductGraph
  /** Nodes that were not in the graph. */
  added: number
  /** Nodes that were there and got the incoming data. */
  updated: number
  /** Ids of the nodes that were added or updated, for selecting them. */
  touched: string[]
}

const identifierOf = (node: GraphNode): string => {
  const data = node.data as { slug?: string; sku?: string; fileName?: string }
  return String(data.slug ?? data.sku ?? data.fileName ?? '').trim()
}

const identityOf = (node: GraphNode): string => `${node.type}:${identifierOf(node)}`

/** The built-in sample graph, exactly as it was created: nothing the user has changed is in it. */
export function isUntouchedPreset(graph: ProductGraph): boolean {
  if (!graph.preset) return false
  const fresh = createPresetGraph(graph.preset)
  const signature = (g: ProductGraph) => JSON.stringify([g.nodes.map((n) => [n.id, n.type, n.data]), g.edges.map((e) => [e.source, e.target, e.type])])
  return signature(graph) === signature(fresh)
}

export function mergeGraphs(base: ProductGraph, incoming: ProductGraph): MergeResult {
  // the sample graph that nobody touched is not the user's work: the incoming graph replaces it
  if (base.nodes.length === 0 || isUntouchedPreset(base)) {
    return { graph: { ...incoming, preset: undefined }, added: incoming.nodes.length, updated: 0, touched: incoming.nodes.map((n) => n.id) }
  }

  const byIdentity = new Map(base.nodes.map((n) => [identityOf(n), n]))
  const usedIds = new Set(base.nodes.map((n) => n.id))
  const idMap = new Map<string, string>() // incoming id -> id in the merged graph
  const nodes = base.nodes.map((n) => ({ ...n }))
  const touched: string[] = []
  let added = 0
  let updated = 0

  // new nodes go below everything that is there, keeping the layout they came with
  const bottom = Math.max(0, ...base.nodes.map((n) => n.y))
  const top = Math.min(...incoming.nodes.map((n) => n.y), 0)
  const offset = base.nodes.length > 0 ? bottom + 260 - top : 0

  for (const node of incoming.nodes) {
    const existing = byIdentity.get(identityOf(node))
    if (existing) {
      const target = nodes.find((n) => n.id === existing.id)
      if (target) target.data = { ...target.data, ...definedOnly(node.data) } as never
      idMap.set(node.id, existing.id)
      touched.push(existing.id)
      updated++
      continue
    }
    let id = node.id
    for (let n = 2; usedIds.has(id); n++) id = `${node.id}-${n}`
    usedIds.add(id)
    idMap.set(node.id, id)
    nodes.push({ ...node, id, y: node.y + offset })
    byIdentity.set(identityOf(node), nodes[nodes.length - 1] as GraphNode)
    touched.push(id)
    added++
  }

  const edges = base.edges.map((e) => ({ ...e }))
  const seen = new Set(edges.map((e) => `${e.source}|${e.target}|${e.type}`))
  for (const edge of incoming.edges) {
    const source = idMap.get(edge.source)
    const target = idMap.get(edge.target)
    if (!source || !target) continue
    // an edge is the same in either direction
    if (seen.has(`${source}|${target}|${edge.type}`) || seen.has(`${target}|${source}|${edge.type}`)) continue
    seen.add(`${source}|${target}|${edge.type}`)
    edges.push({ ...edge, id: `edge-${source}-${target}-${edge.type}`, source, target })
  }

  return { graph: { ...base, nodes, edges, updatedAt: new Date().toISOString() }, added, updated, touched }
}

/** The fields an incoming node actually has: a missing one must not erase what the graph already holds. */
function definedOnly(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}
