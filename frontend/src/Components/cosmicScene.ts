/**
 * Animated cosmic backdrop rendered on a 2D canvas.
 *
 * Layers, back to front: sky gradient, nebula band, starfield, shooting stars,
 * orbits with small bodies, and a backlit planet horizon at the bottom.
 * The sky (nebula + stars) slowly wheels around the planet's center.
 *
 * Everything expensive (noise textures, sprites) is rendered once into offscreen
 * canvases; a frame is a handful of drawImage calls plus ~1-2k star sprites.
 */

type Rand = () => number
type RGB = [number, number, number]

type Star = {
  // offset from the rotation pivot, in units of the sky radius
  x: number
  y: number
  size: number
  sprite: number
  alpha: number
  twinkleSpeed: number
  twinklePhase: number
  twinkleAmp: number
  depth: number
}

type Orbit = {
  rx: number
  ry: number
  speed: number
  phase: number
  color: RGB
  sprite: number
  size: number
}

type ShootingStar = {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  age: number
  life: number
}

type Layout = {
  w: number
  h: number
  // planet center (also the sky rotation pivot) and radius
  cx: number
  cy: number
  r: number
  // sky radius: distance from the pivot to the farthest screen corner (plus margin)
  skyR: number
  // orbits' center and tilt
  ox: number
  oy: number
}

const SKY_ROTATION_SPEED = 0.0011 // rad/s
const PARALLAX_PX = 22
const LIGHT: [number, number, number] = normalize3([-0.35, -0.62, -0.7])
const LIGHT_2D: [number, number] = normalize2([-0.45, -0.9])
const PLANET_FILL_RGB: RGB = [6, 9, 26]
const PLANET_FILL = `rgb(${PLANET_FILL_RGB.join(',')})`

const STAR_COLORS: RGB[] = [
  [170, 191, 255],
  [202, 215, 255],
  [248, 247, 255],
  [255, 244, 234],
  [255, 214, 170],
]
// weighted towards bluish-white, like a real sky
const STAR_COLOR_WEIGHTS = [0.18, 0.3, 0.32, 0.13, 0.07]

const NEBULA_PALETTE: RGB[] = [
  [52, 140, 168], // teal (orbitar primary)
  [46, 72, 160], // deep blue
  [104, 58, 160], // violet
  [168, 66, 128], // rose
  [60, 120, 170], // back to blue-teal
]

export function startCosmicScene(canvas: HTMLCanvasElement): () => void {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) {
    return () => undefined
  }
  const ctx: CanvasRenderingContext2D = maybeCtx

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const seed = (Math.random() * 2 ** 32) >>> 0
  const starSprites = STAR_COLORS.map((c) => makeGlowSprite(c))
  const spikeSprite = makeSpikeSprite()

  let dpr = 1
  let layout = computeLayout(1, 1)
  let nebula: HTMLCanvasElement | undefined
  let nebulaSkyR = 0
  let stars: Star[] = []
  let planet: ReturnType<typeof makePlanet> | undefined
  let orbits: Orbit[] = []
  const shooting: ShootingStar[] = []
  let nextShootingAt = 2 + Math.random() * 3

  // parallax: target follows the pointer, current eases towards it
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, hasMouse: false }

  let raf = 0
  let lastTime = 0
  let time = 0
  let planetTimer: number | undefined
  let disposed = false

  function resize() {
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    layout = computeLayout(w, h)

    // Stars and nebula live in sky-radius units, so a resize just rescales them.
    // Regenerate only when the sky grew enough for the textures to look soft.
    if (!nebula || layout.skyR > nebulaSkyR * 1.35) {
      const rand = mulberry32(seed)
      nebula = makeNebula(layout, rand)
      stars = makeStars(layout, rand)
      nebulaSkyR = layout.skyR
    }
    orbits = makeOrbits(layout, mulberry32(seed ^ 0x9e3779b9))

    // The planet texture depends on exact geometry; rebuilding it is ~20-50ms,
    // so debounce it during continuous resizes (mobile URL bar, window drag).
    if (!planet) {
      planet = makePlanet(layout, mulberry32(seed ^ 0x51ed270b))
    } else {
      window.clearTimeout(planetTimer)
      planetTimer = window.setTimeout(() => {
        planet = makePlanet(layout, mulberry32(seed ^ 0x51ed270b))
      }, 150)
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || reducedMotion) return
    pointer.hasMouse = true
    pointer.tx = (e.clientX / layout.w) * 2 - 1
    pointer.ty = (e.clientY / layout.h) * 2 - 1
  }

  function draw() {
    const { w, h, cx, cy, skyR } = layout
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1

    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#03040a')
    sky.addColorStop(0.55, '#070a19')
    sky.addColorStop(1, '#0c1430')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // reduced motion keeps the orbits and twinkling but holds the sky still
    const rot = reducedMotion ? 0 : time * SKY_ROTATION_SPEED
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const px = pointer.x * PARALLAX_PX
    const py = pointer.y * PARALLAX_PX

    // nebula
    if (nebula) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.translate(cx - px * 0.25, cy - py * 0.25)
      ctx.rotate(rot)
      ctx.drawImage(nebula, -skyR, -skyR, skyR * 2, skyR * 2)
      ctx.restore()
    }

    // stars
    ctx.globalCompositeOperation = 'lighter'
    for (const s of stars) {
      const sx = cx + (s.x * cos - s.y * sin) * skyR - px * s.depth
      const sy = cy + (s.x * sin + s.y * cos) * skyR - py * s.depth
      if (sx < -8 || sx > w + 8 || sy < -8 || sy > h + 8) continue
      const tw = 1 - s.twinkleAmp * (0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinklePhase))
      ctx.globalAlpha = s.alpha * tw
      const d = s.size * 4
      ctx.drawImage(starSprites[s.sprite], sx - d / 2, sy - d / 2, d, d)
      if (s.size > 1.9) {
        const k = d * 2.6
        ctx.globalAlpha = s.alpha * tw * 0.35
        ctx.drawImage(spikeSprite, sx - k / 2, sy - k / 2, k, k)
      }
    }
    ctx.globalAlpha = 1

    drawShootingStars()
    drawOrbits(px, py)
    drawPlanet(px, py)
    ctx.globalCompositeOperation = 'source-over'
  }

  function drawShootingStars() {
    for (const s of shooting) {
      const k = s.age / s.life
      const fade = Math.sin(Math.PI * Math.min(1, k)) ** 1.5
      const speed = Math.hypot(s.vx, s.vy)
      const tx = s.x - (s.vx / speed) * s.length
      const ty = s.y - (s.vy / speed) * s.length
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty)
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`)
      g.addColorStop(0.2, `rgba(190,225,255,${0.45 * fade})`)
      g.addColorStop(1, 'rgba(120,180,255,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.globalAlpha = fade
      ctx.drawImage(starSprites[2], s.x - 6, s.y - 6, 12, 12)
      ctx.globalAlpha = 1
    }
  }

  function drawOrbits(px: number, py: number) {
    const { ox, oy } = layout
    ctx.save()
    ctx.translate(ox - px * 0.7, oy - py * 0.7)
    ctx.rotate(-0.14)
    ctx.globalCompositeOperation = 'lighter'

    for (const o of orbits) {
      // the near (lower) half of the orbit is a bit brighter than the far one
      const g = ctx.createLinearGradient(0, -o.ry, 0, o.ry)
      g.addColorStop(0, 'rgba(150,205,230,0.035)')
      g.addColorStop(1, 'rgba(150,205,230,0.13)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    for (const o of orbits) {
      const a = o.phase + time * o.speed
      const depth = 0.5 + 0.5 * Math.sin(a) // 0 far .. 1 near
      // comet-like trail along the orbit
      const trail = 0.55
      const steps = 22
      ctx.lineWidth = 1.2 + depth * 0.8
      ctx.lineCap = 'round'
      let prevX = o.rx * Math.cos(a)
      let prevY = o.ry * Math.sin(a)
      for (let i = 1; i <= steps; i++) {
        const b = a - (trail * i) / steps
        const x = o.rx * Math.cos(b)
        const y = o.ry * Math.sin(b)
        const k = 1 - i / steps
        ctx.strokeStyle = rgba(o.color, k * k * (0.25 + 0.35 * depth))
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(x, y)
        ctx.stroke()
        prevX = x
        prevY = y
      }
      const x = o.rx * Math.cos(a)
      const y = o.ry * Math.sin(a)
      const d = o.size * (0.75 + 0.5 * depth) * 7
      ctx.globalAlpha = 0.55 + 0.45 * depth
      ctx.drawImage(starSprites[o.sprite], x - d / 2, y - d / 2, d, d)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  function drawPlanet(px: number, py: number) {
    if (!planet) return
    const p = planet
    const { cx, cy, r } = layout
    const ppx = cx - px * 1.2
    const ppy = cy - py * 1.2
    // While a resize is in progress the texture still has the previous geometry
    // (the rebuild is debounced), so scale it around its own center onto the
    // current planet, keeping it aligned with the limb and rim drawn below.
    const k = r / p.r
    const place = (img: HTMLCanvasElement) =>
      ctx.drawImage(
        img,
        ppx + (p.x - p.cx) * k,
        ppy + (p.y - p.cy) * k,
        (img.width / p.scale) * k,
        (img.height / p.scale) * k,
      )

    // atmosphere glow around the limb
    ctx.globalCompositeOperation = 'lighter'
    place(p.glow)

    // a soft sunrise flare where the light grazes the limb
    const fx = ppx + LIGHT_2D[0] * r
    const fy = ppy + LIGHT_2D[1] * r
    const flare = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 0.45)
    flare.addColorStop(0, 'rgba(255,235,220,0.22)')
    flare.addColorStop(0.25, 'rgba(160,215,245,0.08)')
    flare.addColorStop(1, 'rgba(90,150,220,0)')
    ctx.fillStyle = flare
    ctx.fillRect(fx - r * 0.45, fy - r * 0.45, r * 0.9, r * 0.9)

    // the body itself, clipped at full resolution so the limb stays crisp
    ctx.globalCompositeOperation = 'source-over'
    ctx.save()
    ctx.beginPath()
    ctx.arc(ppx, ppy, r, 0, Math.PI * 2)
    ctx.clip()
    // base tone of the unlit side, in case a stale texture doesn't reach the screen edge
    ctx.fillStyle = PLANET_FILL
    ctx.fillRect(ppx - r, ppy - r, r * 2, r * 2)
    place(p.surface)
    ctx.restore()

    // thin bright rim on the lit side
    const rim = ctx.createLinearGradient(
      ppx + LIGHT_2D[0] * r,
      ppy + LIGHT_2D[1] * r,
      ppx - LIGHT_2D[0] * r * 0.4,
      ppy - LIGHT_2D[1] * r * 0.4,
    )
    rim.addColorStop(0, 'rgba(220,245,255,0.85)')
    rim.addColorStop(0.35, 'rgba(140,210,240,0.35)')
    rim.addColorStop(1, 'rgba(120,190,230,0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = rim
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(ppx, ppy, r - 0.5, 0, Math.PI * 2)
    ctx.stroke()
  }

  function step(now: number) {
    if (disposed) return
    const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0
    lastTime = now
    time += dt

    // pointer parallax; touch devices get a slow autonomous sway instead
    if (!pointer.hasMouse && !reducedMotion) {
      pointer.tx = Math.sin(time * 0.09) * 0.45
      pointer.ty = Math.cos(time * 0.07) * 0.25
    }
    const ease = 1 - Math.exp(-dt * 2.2)
    pointer.x += (pointer.tx - pointer.x) * ease
    pointer.y += (pointer.ty - pointer.y) * ease

    updateShootingStars(dt)
    draw()
    raf = requestAnimationFrame(step)
  }

  function updateShootingStars(dt: number) {
    for (let i = shooting.length - 1; i >= 0; i--) {
      const s = shooting[i]
      s.age += dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (s.age >= s.life) shooting.splice(i, 1)
    }
    if (time >= nextShootingAt) {
      nextShootingAt = time + 3.5 + Math.random() * 6
      const { w, h } = layout
      const dir = Math.random() < 0.5 ? -1 : 1
      const angle = (0.35 + Math.random() * 0.35) * (dir > 0 ? 1 : -1)
      const speed = Math.max(w, h) * (0.55 + Math.random() * 0.35)
      shooting.push({
        x: dir > 0 ? Math.random() * w * 0.6 : w * 0.4 + Math.random() * w * 0.6,
        y: Math.random() * h * 0.45,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.abs(Math.sin(angle)) * speed,
        length: 90 + Math.random() * 140,
        age: 0,
        life: 0.7 + Math.random() * 0.6,
      })
    }
  }

  resize()
  const onResize = () => resize()
  window.addEventListener('resize', onResize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  raf = requestAnimationFrame(step)
  // fade in once the first frame is on screen
  requestAnimationFrame(() => (canvas.style.opacity = '1'))

  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    window.clearTimeout(planetTimer)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('pointermove', onPointerMove)
  }
}

function computeLayout(w: number, h: number): Layout {
  const portrait = h > w
  const r = Math.max(w, h) * (portrait ? 0.95 : 0.9)
  const capHeight = h * (portrait ? 0.17 : 0.24)
  const cx = w * (portrait ? 0.62 : 0.58)
  const cy = h - capHeight + r
  const margin = PARALLAX_PX * 2
  const skyR = Math.max(Math.hypot(cx + margin, cy + margin), Math.hypot(w + margin - cx, cy + margin)) + margin
  return { w, h, cx, cy, r, skyR, ox: w * 0.5, oy: h * (portrait ? 0.42 : 0.44) }
}

// ---------------------------------------------------------------------------
// Scene content generation

function makeStars(layout: Layout, rand: Rand): Star[] {
  const { skyR, r, w, h } = layout
  const band = nebulaBand(layout)
  // the planet always covers the inner part of the sky disc
  const minRadius = (r * 0.97) / skyR
  const area = Math.PI * skyR * skyR
  // density scales with the viewport so phones don't get a crowded sky
  const densityScale = Math.min(1, Math.sqrt((w * h) / (1440 * 900)) + 0.35)
  const classes = [
    { perPx: 1 / 1500, size: [0.55, 1.0], alpha: [0.35, 0.8], depth: 0.25, twinkle: 0.35 },
    { perPx: 1 / 9000, size: [1.0, 1.7], alpha: [0.6, 1.0], depth: 0.55, twinkle: 0.5 },
    { perPx: 1 / 70000, size: [1.9, 2.8], alpha: [0.85, 1.0], depth: 1, twinkle: 0.3 },
  ]
  const stars: Star[] = []
  for (const c of classes) {
    const n = Math.round(area * c.perPx * densityScale)
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt(minRadius ** 2 + rand() * (1 - minRadius ** 2))
      const a = rand() * Math.PI * 2
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr
      // more stars inside the milky-way band
      const inBand = Math.exp(-((band.distance(x, y) / band.width) ** 2))
      if (rand() > 0.3 + 0.7 * inBand) continue
      stars.push({
        x,
        y,
        size: lerp(c.size[0], c.size[1], rand() ** 2),
        sprite: pickWeighted(STAR_COLOR_WEIGHTS, rand()),
        alpha: lerp(c.alpha[0], c.alpha[1], rand()),
        twinkleSpeed: 0.6 + rand() * 2.4,
        twinklePhase: rand() * Math.PI * 2,
        twinkleAmp: c.twinkle * rand(),
        depth: c.depth * (0.7 + rand() * 0.6),
      })
    }
  }
  return stars
}

function makeOrbits(layout: Layout, rand: Rand): Orbit[] {
  const { w, h } = layout
  const base = Math.min(Math.max(w, h * 0.8) * 0.5, 900)
  const radii = h > w ? [0.62, 0.95, 1.35] : [0.5, 0.78, 1.1]
  const colors: [RGB, number][] = [
    [[140, 220, 240], 1],
    [[255, 220, 190], 3],
    [[200, 190, 255], 0],
  ]
  return radii.map((k, i) => {
    const rx = base * k
    return {
      rx,
      ry: rx * 0.26,
      // Kepler-ish: outer bodies move slower
      speed: 0.16 / Math.pow(k, 1.5),
      phase: rand() * Math.PI * 2,
      color: colors[i][0],
      sprite: colors[i][1],
      size: [1.1, 1.4, 1.0][i],
    }
  })
}

function nebulaBand(layout: Layout) {
  const { w, h, cx, cy, skyR } = layout
  // a diagonal band rising to the right, crossing the upper part of the screen
  const qx = (w * 0.35 - cx) / skyR
  const qy = (h * 0.3 - cy) / skyR
  const angle = -0.5
  const nx = -Math.sin(angle)
  const ny = Math.cos(angle)
  return {
    width: (h > w ? h * 0.26 : w * 0.2) / skyR,
    distance: (x: number, y: number) => (x - qx) * nx + (y - qy) * ny,
    along: (x: number, y: number) => (x - qx) * Math.cos(angle) + (y - qy) * Math.sin(angle),
  }
}

function makeNebula(layout: Layout, rand: Rand): HTMLCanvasElement {
  const { skyR } = layout
  const size = Math.round(Math.min(760, Math.max(320, skyR * 0.45)))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = context2d(canvas)
  const img = ctx.createImageData(size, size)
  const data = img.data
  const noise = makeNoise(rand)
  const band = nebulaBand(layout)
  // noise frequency in sky units, independent of the texture resolution
  const f = (skyR / 900) * 3.2
  const ox = rand() * 100
  const oy = rand() * 100

  for (let j = 0; j < size; j++) {
    const y = (j / size) * 2 - 1
    for (let i = 0; i < size; i++) {
      const x = (i / size) * 2 - 1
      const wx = noise.fbm(x * f * 0.6 + ox, y * f * 0.6 + oy, 3)
      const wy = noise.fbm(x * f * 0.6 + oy, y * f * 0.6 + ox + 7, 3)
      const d = band.distance(x, y) + (wx - 0.5) * band.width * 1.2
      const inBand = Math.exp(-((d / band.width) ** 2))
      const clouds = noise.fbm(x * f + wx * 1.6 + ox, y * f + wy * 1.6 + oy, 5)
      const dust = smoothstep(0.45, 0.8, noise.fbm(x * f * 2.6 + wx + 31, y * f * 2.6 + wy + 17, 5))
      const patches = Math.pow(noise.fbm(x * f * 0.5 + 53, y * f * 0.5 + 11, 4), 3) * 0.22

      let density = inBand * Math.pow(clouds, 1.8) * 0.95 + patches * clouds
      density *= 1 - 0.45 * dust * Math.sqrt(inBand)

      const along = band.along(x, y) / (band.width * 6) + clouds * 0.6
      const color = samplePalette(NEBULA_PALETTE, fract(along))
      // a faint warm core along the band's spine
      const core = Math.pow(inBand, 4) * clouds * 0.5

      const k = (i + j * size) * 4
      data[k] = clamp255(color[0] * density + 230 * core * density)
      data[k + 1] = clamp255(color[1] * density + 190 * core * density)
      data[k + 2] = clamp255(color[2] * density + 210 * core * density)
      data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function makePlanet(layout: Layout, rand: Rand) {
  const { w, h, cx, cy, r } = layout
  const margin = PARALLAX_PX * 2
  // tall enough for the outer glow to decay below one 8-bit step (no visible edge)
  const glowHeight = 320
  // extra room on the sides so a stale texture still covers the limb while the window grows
  const x0 = Math.max(cx - r, -w * 0.5)
  const x1 = Math.min(cx + r, w * 1.5)
  const y0 = Math.max(cy - r - glowHeight, -margin)
  // Below the screen the surface fades into the flat fill drawn under it, so when a
  // stale texture is scaled up mid-resize its lower edge blends in instead of showing.
  const fadeFrom = h + margin
  const y1 = fadeFrom + h * 0.25
  const scale = 0.5
  const cw = Math.max(1, Math.ceil((x1 - x0) * scale))
  const ch = Math.max(1, Math.ceil((y1 - y0) * scale))

  const surface = document.createElement('canvas')
  const glow = document.createElement('canvas')
  surface.width = glow.width = cw
  surface.height = glow.height = ch
  const sctx = context2d(surface)
  const gctx = context2d(glow)
  const simg = sctx.createImageData(cw, ch)
  const gimg = gctx.createImageData(cw, ch)
  const noise = makeNoise(rand)

  const dark: RGB = [5, 8, 20]
  const bandA: RGB = [26, 44, 80]
  const bandB: RGB = [58, 90, 132]
  const atmo: RGB = [110, 200, 235]

  for (let j = 0; j < ch; j++) {
    const py = y0 + j / scale
    for (let i = 0; i < cw; i++) {
      const px = x0 + i / scale
      const dx = (px - cx) / r
      const dy = (py - cy) / r
      const d2 = dx * dx + dy * dy
      const k = (i + j * cw) * 4
      if (d2 <= 1.0) {
        const nz = Math.sqrt(1 - d2)
        const lambert = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2])
        const lit = 0.02 + 0.9 * Math.pow(lambert, 4)
        // spherical bands: latitude drives the stripes, longitude warps them
        const lat = Math.asin(Math.max(-1, Math.min(1, dy)))
        const lon = Math.atan2(dx, nz)
        const warp = noise.fbm(lon * 3 + 5, lat * 6, 3)
        const bands = noise.fbm(lon * 1.2, lat * 26 + warp * 3, 4)
        const t = smoothstep(0.3, 0.75, bands)
        const fresnel = Math.pow(1 - nz, 3)
        const rimLight = fresnel * (0.25 + 0.75 * Math.max(0, dx * LIGHT_2D[0] + dy * LIGHT_2D[1]))
        const fade = py > fadeFrom ? smoothstep(fadeFrom, y1, py) : 0
        for (let c = 0; c < 3; c++) {
          const base = lerp(bandA[c], bandB[c], t)
          const color = dark[c] + base * lit + atmo[c] * rimLight * 0.7
          simg.data[k + c] = clamp255(lerp(color, PLANET_FILL_RGB[c], fade))
        }
        simg.data[k + 3] = 255
      } else {
        const dist = (Math.sqrt(d2) - 1) * r
        const dirX = dx / Math.sqrt(d2)
        const dirY = dy / Math.sqrt(d2)
        const light = 0.2 + 0.8 * Math.pow(Math.max(0, dirX * LIGHT_2D[0] + dirY * LIGHT_2D[1]), 2)
        const g = (Math.exp(-dist / 9) * 0.55 + Math.exp(-dist / 55) * 0.2) * light
        gimg.data[k] = clamp255(atmo[0] * g)
        gimg.data[k + 1] = clamp255(atmo[1] * g)
        gimg.data[k + 2] = clamp255(atmo[2] * g)
        gimg.data[k + 3] = 255
      }
    }
  }
  sctx.putImageData(simg, 0, 0)
  gctx.putImageData(gimg, 0, 0)
  // the geometry it was rendered for, to map it onto a newer layout until it is rebuilt
  return { surface, glow, x: x0, y: y0, scale, cx, cy, r }
}

// ---------------------------------------------------------------------------
// Sprites

function makeGlowSprite([r, g, b]: RGB): HTMLCanvasElement {
  const s = 32
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = context2d(c)
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.12, `rgba(${r},${g},${b},0.95)`)
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.28)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, s, s)
  return c
}

function makeSpikeSprite(): HTMLCanvasElement {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = context2d(c)
  const h = ctx.createLinearGradient(0, 0, s, 0)
  h.addColorStop(0, 'rgba(210,230,255,0)')
  h.addColorStop(0.5, 'rgba(230,240,255,0.9)')
  h.addColorStop(1, 'rgba(210,230,255,0)')
  ctx.fillStyle = h
  ctx.fillRect(0, s / 2 - 0.5, s, 1)
  const v = ctx.createLinearGradient(0, 0, 0, s)
  v.addColorStop(0, 'rgba(210,230,255,0)')
  v.addColorStop(0.5, 'rgba(230,240,255,0.9)')
  v.addColorStop(1, 'rgba(210,230,255,0)')
  ctx.fillStyle = v
  ctx.fillRect(s / 2 - 0.5, 0, 1, s)
  return c
}

// ---------------------------------------------------------------------------
// Math helpers

function mulberry32(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(rand: Rand) {
  const perm = new Uint8Array(512)
  const values = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    perm[i] = i
    values[i] = rand()
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = perm[i]
    perm[i] = perm[j]
    perm[j] = t
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]

  const noise = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const X = xi & 255
    const Y = yi & 255
    const a = values[perm[perm[X] + Y]]
    const b = values[perm[perm[X + 1] + Y]]
    const c = values[perm[perm[X] + Y + 1]]
    const d = values[perm[perm[X + 1] + Y + 1]]
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }

  const fbm = (x: number, y: number, octaves: number) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += noise(x, y) * amp
      norm += amp
      x = x * 2.03 + 17.1
      y = y * 2.03 + 9.7
      amp *= 0.5
    }
    return sum / norm
  }

  return { noise, fbm }
}

function samplePalette(palette: RGB[], t: number): RGB {
  const p = t * (palette.length - 1)
  const i = Math.min(palette.length - 2, Math.floor(p))
  const k = smoothstep(0, 1, p - i)
  const a = palette[i]
  const b = palette[i + 1]
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
}

function pickWeighted(weights: number[], r: number): number {
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (r < acc) return i
  }
  return weights.length - 1
}

function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function fract(x: number) {
  return x - Math.floor(x)
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function normalize2([x, y]: [number, number]): [number, number] {
  const l = Math.hypot(x, y)
  return [x / l, y / l]
}

function normalize3([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context is unavailable')
  return ctx
}
