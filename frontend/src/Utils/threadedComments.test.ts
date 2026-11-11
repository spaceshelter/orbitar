import { PostCommentIndexEntry } from '../API/PostAPI'
import { getCommentBatch, getTargetPathState, getVisibleCommentIds, groupThreadedComments } from './threadedComments'

describe('threaded post navigation', () => {
  const index: PostCommentIndexEntry[] = [
    { id: 1 },
    ...Array.from({ length: 60 }, (_, i) => ({ id: i + 2, parentComment: 1 })),
    { id: 62, parentComment: 55, isNew: true },
    ...Array.from({ length: 1971 }, (_, i) => ({ id: i + 63 })),
  ]

  it('loads every first-level comment in bounded requests while descendants stay collapsed', () => {
    const groups = groupThreadedComments(index, false)
    const visible = getVisibleCommentIds(groups, {}, {})
    expect(index).toHaveLength(2033)
    expect(visible).toHaveLength(1972)
    expect(visible).not.toContain(62)
    const loaded = new Set<number>()
    let requests = 0
    while (loaded.size < visible.length) {
      const batch = getCommentBatch(visible, loaded, new Set())
      expect(batch.length).toBeGreaterThan(0)
      expect(batch.length).toBeLessThanOrEqual(25)
      batch.forEach((id) => loaded.add(id))
      requests++
    }
    expect(loaded.size).toBe(1972)
    expect(requests).toBe(79)
  })

  it('opens only the pages and ancestors needed for a deep permalink', () => {
    const groups = groupThreadedComments(index, false)
    const state = getTargetPathState(62, index, groups)
    expect(state.pages[1]).toBe(50)
    expect(state.pages[0]).toBeUndefined()
    expect(state.expanded).toEqual({ 1: true, 55: true })
    const visible = getVisibleCommentIds(groups, state.pages, state.expanded)
    expect(visible).toContain(62)
    expect(visible).not.toContain(2)
    expect(getCommentBatch(visible, new Set(), new Set(), [1, 55, 62])).toEqual(expect.arrayContaining([1, 55, 62]))
  })

  it('keeps unread ancestor paths, explicit links, and newly posted replies', () => {
    const unread = groupThreadedComments(index, true)
    expect(unread[0]).toEqual([1])
    expect(unread[1]).toEqual([55])
    expect(unread[55]).toEqual([62])

    const linked = groupThreadedComments(index, true, 60, [61])
    expect(linked[1]).toEqual([55, 60, 61])
    expect(linked[55]).toEqual([62])
  })
})
