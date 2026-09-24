import { PostCommentIndexEntry } from '../API/PostAPI'

export const COMMENT_PAGE_SIZE = 25

export function groupThreadedComments(
  index: PostCommentIndexEntry[],
  unreadOnly: boolean,
  targetId?: number,
  addedIds: number[] = [],
): Record<number, number[]> {
  const byId = new Map(index.map((entry) => [entry.id, entry]))
  const visible = unreadOnly ? new Set<number>() : undefined
  if (visible) {
    for (const entry of index) {
      if (!entry.isNew && entry.id !== targetId && !addedIds.includes(entry.id)) continue
      let current: PostCommentIndexEntry | undefined = entry
      while (current && !visible.has(current.id)) {
        visible.add(current.id)
        current = current.parentComment ? byId.get(current.parentComment) : undefined
      }
    }
  }

  const groups: Record<number, number[]> = {}
  for (const entry of index) {
    if (visible && !visible.has(entry.id)) continue
    const parent = entry.parentComment || 0
    ;(groups[parent] ||= []).push(entry.id)
  }
  return groups
}

export function getTargetPathState(
  targetId: number,
  index: PostCommentIndexEntry[],
  groups: Record<number, number[]>,
): { pages: Record<number, number>; expanded: Record<number, boolean> } {
  const byId = new Map(index.map((entry) => [entry.id, entry]))
  const path = getCommentPath(targetId, index)
  const pages: Record<number, number> = {}
  const expanded: Record<number, boolean> = {}
  for (const id of path) {
    const parent = byId.get(id)?.parentComment || 0
    const position = (groups[parent] || []).indexOf(id)
    if (parent && position >= 0) pages[parent] = Math.floor(position / COMMENT_PAGE_SIZE) * COMMENT_PAGE_SIZE
    if (parent) expanded[parent] = true
  }
  return { pages, expanded }
}

export function getCommentPath(targetId: number, index: PostCommentIndexEntry[]): number[] {
  const byId = new Map(index.map((entry) => [entry.id, entry]))
  const path: number[] = []
  const seen = new Set<number>()
  let current = byId.get(targetId)
  while (current && !seen.has(current.id)) {
    path.unshift(current.id)
    seen.add(current.id)
    current = current.parentComment ? byId.get(current.parentComment) : undefined
  }
  return path
}

export function getVisibleCommentIds(
  groups: Record<number, number[]>,
  pageStarts: Record<number, number>,
  expanded: Record<number, boolean>,
): number[] {
  const ids: number[] = []
  const visit = (parent: number) => {
    const children = groups[parent] || []
    const start = pageStarts[parent] || 0
    const shown = parent ? children.slice(start, start + COMMENT_PAGE_SIZE) : children
    for (const id of shown) {
      ids.push(id)
      if (expanded[id]) visit(id)
    }
  }
  visit(0)
  return ids
}

export function getCommentBatch(
  visibleIds: number[],
  loadedIds: Set<number>,
  pendingIds: Set<number>,
  priorityIds: number[] = [],
): number[] {
  const selected = new Set<number>()
  const visible = new Set(visibleIds)
  for (const id of [...priorityIds, ...visibleIds]) {
    if (selected.size >= COMMENT_PAGE_SIZE) break
    if (!loadedIds.has(id) && !pendingIds.has(id) && visible.has(id)) selected.add(id)
  }
  return Array.from(selected)
}
