// virtualized.ts — thin, rAF‑friendly virtual‑list helper
// Public surface: IVirtualizedItem + VirtualizedContainer
// Internals (_VirtualizedItem) are hidden, so callers cannot mutate visibility.

import { action, makeObservable, observable } from 'mobx'

/**
 * What React components receive.
 *   • call `setRef(domNode)` once in useEffect
 *   • read `isVisible` (mobx observable)
 */
export interface VirtualizedItem {
  setRef(node: HTMLElement | null): void
  readonly isVisible: boolean
}

/**
 * Implementation (private to this module)
 */
class _VirtualizedItem implements VirtualizedItem {
  private ref: HTMLElement | null = null
  isVisible = false

  constructor() {
    makeObservable<this, 'isVisible' | 'setVisible'>(this, {
      isVisible: observable,
      setVisible: action,
    })
  }

  // React component connects its DOM node here
  setRef = (node: HTMLElement | null) => {
    this.ref = node
  }

  /** Document‑space top edge (re‑measured every call). */
  getTop(): number {
    if (!this.ref) return Infinity // treat unmounted nodes as off‑screen
    const { top } = this.ref.getBoundingClientRect()
    return top + (window.scrollY || document.documentElement.scrollTop)
  }

  /** Document‑space bottom edge (re‑measured every call). */
  getBottom(): number {
    if (!this.ref) return -Infinity
    const { bottom } = this.ref.getBoundingClientRect()
    return bottom + (window.scrollY || document.documentElement.scrollTop)
  }

  /** Only the container may flip visibility. */
  setVisible = (v: boolean) => {
    if (v !== this.isVisible) this.isVisible = v
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container — maintains a sorted array of items and diff‑updates visibility
// ─────────────────────────────────────────────────────────────────────────────
export class VirtualizedContainer {
  private items: _VirtualizedItem[] = []
  private visStart = 0
  private visEnd = -1

  constructor(private bufferPx = 600) {}

  /**
   * Create an item and hand it to the caller as an **interface** only.
   * They can’t mutate internals this way.
   */
  createChild(): VirtualizedItem {
    const it = new _VirtualizedItem()
    this.items.push(it)
    return it
  }

  /** Call from scroll / resize / rAF.  O(log n) reads + O(diff) mobx writes. */
  updateVisibility = () => {
    if (!this.items.length) return

    const vpTop = window.scrollY
    const vpBottom = vpTop + window.innerHeight
    const min = vpTop - this.bufferPx
    const max = vpBottom + this.bufferPx

    const newStart = this.lowerBound(min)
    const newEnd = this.upperBound(max)

    if (newStart === this.visStart && newEnd === this.visEnd) return // no diff

    // Turn on newcomers
    for (let i = newStart; i <= newEnd; i++) {
      if (i < this.visStart || i > this.visEnd) this.items[i].setVisible(true)
    }
    // Turn off leavers
    for (let i = this.visStart; i <= this.visEnd; i++) {
      if (i < newStart || i > newEnd) this.items[i].setVisible(false)
    }

    this.visStart = newStart
    this.visEnd = newEnd
  }

  // ───────────── helpers ─────────────

  /** first index whose bottom ≥ value */
  private lowerBound(value: number): number {
    let lo = 0,
      hi = this.items.length - 1,
      res = this.items.length
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this.items[mid].getBottom() < value) lo = mid + 1
      else {
        res = mid
        hi = mid - 1
      }
    }
    return res
  }

  /** last index whose top ≤ value */
  private upperBound(value: number): number {
    let lo = 0,
      hi = this.items.length - 1,
      res = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this.items[mid].getTop() <= value) {
        res = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return res
  }
}
