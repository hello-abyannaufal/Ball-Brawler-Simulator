import {
  SPRITE_MANIFEST,
  PLACEHOLDER,
  spriteSource,
  type SpriteSource,
} from '~/assets/sprites/manifest'

/**
 * Client-only sprite cache for the retro renderer.
 *
 * Every spriteId is baked once into an offscreen canvas at its native pixel
 * grid. Procedural entries are drawn in code; image entries load their PNG and
 * fall back to the `<id>:proc` procedural variant (if present) or the visible
 * placeholder on failure — the game never crashes on a missing asset.
 *
 * All drawing uses `imageSmoothingEnabled = false` and integer scaling to keep
 * pixels crisp.
 */

type Baked = { canvas: HTMLCanvasElement; width: number; height: number }

const cache = new Map<string, Baked>()
let preloaded = false

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function bakeProcedural(id: string, src: SpriteSource): Baked {
  const canvas = makeCanvas(src.width, src.height)
  // No 2D context (e.g. happy-dom in tests): keep the blank canvas.
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = false
    if (src.kind === 'procedural') src.draw(ctx, src.width, src.height)
  }
  const baked = { canvas, width: src.width, height: src.height }
  cache.set(id, baked)
  return baked
}

function bakeImage(id: string, src: Extract<SpriteSource, { kind: 'image' }>): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = makeCanvas(src.width, src.height)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, src.width, src.height)
      }
      cache.set(id, { canvas, width: src.width, height: src.height })
      resolve()
    }
    img.onerror = () => {
      // Fall back to the procedural variant, then the placeholder.
      const proc = SPRITE_MANIFEST[`${id}:proc`]
      if (proc && proc.kind === 'procedural') {
        bakeProcedural(id, proc)
      } else {
        bakeProcedural(id, PLACEHOLDER)
      }
      resolve()
    }
    img.src = src.src
  })
}

async function preloadAll(): Promise<void> {
  if (preloaded) return
  const pending: Promise<void>[] = []
  for (const [id, src] of Object.entries(SPRITE_MANIFEST)) {
    if (src.kind === 'image') {
      pending.push(bakeImage(id, src))
    } else {
      bakeProcedural(id, src)
    }
  }
  await Promise.all(pending)
  preloaded = true
}

function ensureBaked(id: string): Baked {
  const hit = cache.get(id)
  if (hit) return hit
  // Lazily bake unknown/procedural ids on first use.
  const src = spriteSource(id)
  if (src.kind === 'procedural') return bakeProcedural(id, src)
  // Image not preloaded yet: bake placeholder now; preload will replace it.
  return bakeProcedural(id, PLACEHOLDER)
}

export function useSprites() {
  /**
   * Draw a sprite at (x, y). `scale` is an integer pixel scale. When `angle`
   * is given, the sprite rotates around `pivot` (in sprite pixels, default the
   * canvas center).
   */
  function drawSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    scale = 1,
    angle?: number,
    pivot?: { x: number; y: number },
  ): void {
    const baked = ensureBaked(id)
    const px = pivot?.x ?? baked.width / 2
    const py = pivot?.y ?? baked.height / 2

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.translate(x, y)
    if (angle) ctx.rotate(angle)
    ctx.drawImage(
      baked.canvas,
      -px * scale,
      -py * scale,
      baked.width * scale,
      baked.height * scale,
    )
    ctx.restore()
  }

  return { preloadAll, drawSprite }
}
