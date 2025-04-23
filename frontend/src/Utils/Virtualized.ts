// Virtualized.ts
// ---------------------------------------------------------------------
// Tiny, allocation-free virtual-list helper – tuned for mobile smoothness
//
//  • VirtualizedContainer(bufferPx = 600, incremental = true)
//      - bufferPx:   guard band around viewport
//      - incremental: false  ⇒   immediate mount/unmount   (old behaviour)
//                      true   ⇒   queue + trickle-flush     (default)
//
//  Typical React wiring shown at the bottom of the file.
//
// ---------------------------------------------------------------------
import { action, makeObservable, observable } from 'mobx'

/* ===================================================================== */
/*   Public surface                                                      */
/* ===================================================================== */

export interface VirtualizedItem {
  setRef(node: HTMLElement | null): void
  readonly isVisible: boolean
}

export class VirtualizedContainer {
  /* -------------------------------- constructor -------------------- */
  constructor(
    private bufferPx = 600,
    private incremental = true,
    /** items to (un)mount per animation frame when incremental = true */
    private maxPerFrame = 3,
    /** ms without scroll events before we start flushing */
    private idleMs = 120,
  ) {}

  /* ------------------- item creation (called from render) ---------- */
  createChild(): VirtualizedItem {
    const impl = new VirtualizedItemImpl()
    this.items.push(impl)
    return impl
  }

  /* ------------------------------ main API ------------------------- */
  /** call this from a passive scroll / resize listener or rAF */
  updateVisibility(): void {
    if (!this.items.length) return

    /* 1. figure out which indices *should* be visible */
    const vpMin = -this.bufferPx
    const vpMax = window.innerHeight + this.bufferPx

    const newStart = this.lowerBound(vpMin)
    const newEnd = this.upperBound(vpMax)

    if (newStart === this.visStart && newEnd === this.visEnd) return

    /* 2. queue diffs instead of mutating instantly */
    if (this.incremental) {
      for (let i = newStart; i <= newEnd; i++) {
        if (i < this.visStart || i > this.visEnd) this.enqueueShow(i)
      }
      for (let i = this.visStart; i <= this.visEnd; i++) {
        if (i < newStart || i > newEnd) this.toHide.push(i)
      }
      this.scheduleFlush()
    } else {
      /* old immediate behaviour */
      for (let i = newStart; i <= newEnd; i++) {
        if (i < this.visStart || i > this.visEnd) this.items[i].setVisible(true)
      }
      for (let i = this.visStart; i <= this.visEnd; i++) {
        if (i < newStart || i > newEnd) this.items[i].setVisible(false)
      }
    }

    this.visStart = newStart
    this.visEnd = newEnd
  }

  /* ================================================================= */
  /*   Implementation details below                                    */
  /* ================================================================= */

  /* -------- state -------- */
  private items: VirtualizedItemImpl[] = []
  private visStart = 0
  private visEnd = -1

  /* -------- diff queues (incremental mode) -------- */
  private toShow: number[] = [] // sorted by distance to viewport centre
  private toHide: number[] = [] // FIFO is fine
  private flushScheduled = false
  private lastScroll = performance.now()

  /* ------------------------------------------------ scroll idle ---- */
  private isScrollIdle = () => performance.now() - this.lastScroll > this.idleMs

  /* ---------------------- binary search helpers ------------------- */
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

  /* ------------------ diff-queue helpers -------------------------- */
  private enqueueShow(idx: number) {
    // compute distance to viewport centre for prioritisation
    const mid = this.items[idx].getMid()
    const dist = mid === null ? Number.POSITIVE_INFINITY : Math.abs(mid - window.innerHeight * 0.5)

    // simple insertion sort at tail (queues are very small)
    let i = this.toShow.length
    this.toShow.push(idx)
    while (i > 0 && dist < this.showDist(i - 1)) {
      this.toShow[i] = this.toShow[i - 1]
      i--
    }
    this.toShow[i] = idx
  }
  private showDist = (i: number) => {
    const mid = this.items[this.toShow[i]].getMid()
    return mid === null ? Number.POSITIVE_INFINITY : Math.abs(mid - window.innerHeight * 0.5)
  }

  /* ----------------------- flush logic ---------------------------- */
  private scheduleFlush() {
    if (this.flushScheduled) return
    this.flushScheduled = true
    requestAnimationFrame(this.flushQueues)
  }

  private flushQueues = () => {
    this.flushScheduled = false

    if (!this.isScrollIdle()) {
      // postpone until scrolling slows down
      this.scheduleFlush()
      return
    }

    let budget = this.maxPerFrame

    // 1) mount items closest to viewport first
    while (budget && this.toShow.length) {
      const idx = this.toShow.shift()!
      this.items[idx].setVisible(true)
      budget--
    }
    // 2) unmount items (cheaper)
    while (budget && this.toHide.length) {
      const idx = this.toHide.shift()!
      this.items[idx].setVisible(false)
      budget--
    }

    if (this.toShow.length || this.toHide.length) this.scheduleFlush()
  }

  /* make callers register scroll activity so we can detect idle time */
  public registerScroll = () => {
    this.lastScroll = performance.now()
  }
}

/* ===================================================================== */
/*   Item implementation (private)                                       */
/* ===================================================================== */

class VirtualizedItemImpl implements VirtualizedItem {
  private ref: HTMLElement | null = null
  isVisible = false

  constructor() {
    makeObservable(this, { isVisible: observable, setVisible: action })
  }

  setRef = (node: HTMLElement | null) => {
    this.ref = node
  }

  getTop(): number {
    const r = this.ref?.getBoundingClientRect()
    return r ? r.top : Number.POSITIVE_INFINITY
  }
  getBottom(): number {
    const r = this.ref?.getBoundingClientRect()
    return r ? r.bottom : Number.POSITIVE_INFINITY
  }
  getMid(): number | null {
    const r = this.ref?.getBoundingClientRect()
    return r ? (r.top + r.bottom) * 0.5 : null
  }

  setVisible(v: boolean) {
    if (v !== this.isVisible) {
      this.isVisible = v
      console.log('visible', v)
    }
  }
}
