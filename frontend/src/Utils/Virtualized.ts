// virtualized.ts — thin, rAF‑friendly virtual‑list helper
// Public surface: IVirtualizedItem + VirtualizedContainer
// Internals (_VirtualizedItem) are hidden, so callers cannot mutate visibility.

import { action, makeObservable, observable } from 'mobx'

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

export interface VirtualizedItem {
  setRef(node: HTMLElement | null): void
  readonly isVisible: boolean
}

export class VirtualizedContainer {
  private items: VirtualizedItemImpl[] = []
  private visStart = 0
  private visEnd = -1

  /** bufferPx   – extra guard band above & below viewport (default 600 px) */
  constructor(
    private bufferPx = 600,
    private hideWhenLeaving = true,
  ) {}

  /** give the returned item to each comment as a prop */
  createChild(): VirtualizedItem {
    const impl = new VirtualizedItemImpl()
    this.items.push(impl)
    return impl // typed as interface – mutation API hidden
  }

  /**
   * Main loop – call from throttled scroll / resize / rAF handler.
   *   • reads:  O(log n) DOM rects via binary search
   *   • writes: O(diff) mobx actions
   */
  updateVisibility(): void {
    if (!this.items.length) return

    /* ────────── viewport‑relative range we consider “visible” ───────── */
    const vpMin = -this.bufferPx
    const vpMax = window.innerHeight + this.bufferPx

    /* binary search for first item whose bottom ≥ vpMin */
    const newStart = this.lowerBound(vpMin)
    /* binary search for last  item whose top    ≤ vpMax */
    const newEnd = this.upperBound(vpMax)

    if (newStart === this.visStart && newEnd === this.visEnd) return // nothing changed

    // invisible → visible
    let cnt = 0
    for (let i = newStart; i <= newEnd; i++) {
      if (i < this.visStart || i > this.visEnd) {
        this.items[i].setVisible(true)
        cnt++
      }
    }
    // visible → invisible
    if (this.hideWhenLeaving) {
      for (let i = this.visStart; i <= this.visEnd; i++) {
        if (i < newStart || i > newEnd) this.items[i].setVisible(false)
      }
    }

    console.log('update cnt: ', cnt)

    this.visStart = newStart
    this.visEnd = newEnd
  }

  /* ------------------------------------------------------------------ */
  /* Binary‑search helpers (viewport coordinates only)                  */
  /* ------------------------------------------------------------------ */

  /**
   * Monotone property we rely on:
   *   items are stored in DOM order, so
   *     item[i].bottom ≤ item[i+1].bottom   AND   item[i].top ≤ item[i+1].top
   *   even when heights differ.
   */

  /** first index whose `bottom` ≥ value (or items.length if none) */
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

  /** last index whose `top` ≤ value (or -1 if none) */
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

/* ------------------------------------------------------------------ */
/* Item implementation (private)                                      */
/* ------------------------------------------------------------------ */

class VirtualizedItemImpl implements VirtualizedItem {
  private ref: HTMLElement | null = null

  isVisible = false

  constructor() {
    makeObservable(this, {
      isVisible: observable,
      setVisible: action,
    })
  }

  /* -------- public surface -------- */

  setRef = (node: HTMLElement | null): void => {
    this.ref = node
  }

  /* -------- container helpers ----- */

  /** viewport‑relative `top` */
  getTop(): number {
    return this.measure().top
  }
  /** viewport‑relative `bottom` */
  getBottom(): number {
    return this.measure().bottom
  }

  /* mobx action – only container calls this */
  setVisible(v: boolean): void {
    if (v !== this.isVisible) this.isVisible = v
  }

  /* ---- internal DOM measurement ---- */
  private measure(): { top: number; bottom: number } {
    if (!this.ref) {
      const far = Number.POSITIVE_INFINITY
      return { top: far, bottom: far }
    }
    const rect = this.ref.getBoundingClientRect() // already viewport coords
    return { top: rect.top, bottom: rect.bottom }
  }
}
