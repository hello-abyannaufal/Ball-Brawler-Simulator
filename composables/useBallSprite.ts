import { spriteSource } from '~/assets/sprites/manifest'
import { RACE_LOOKS, RACE_PART_MARGIN, RACE_SKIN, type RacePart } from '~/assets/sprites/races'
import { useSprites } from '~/composables/useSprites'
import { BALL_OUTLINE_COLOR, BALL_SHADE_STYLE, BALL_SHINE_STYLE } from '~/utils/pixelBall'

/** Ball pixel size in arena units. A bit chunkier than the weapon sprites
 *  (drawn at ~2×) so the 1-pixel outline stays readable while the ball moves. */
export const BALL_PIXEL = 3

/** A baked ball: `margin` ball pixels of room for race parts on every side. */
export interface BallSprite {
  canvas: HTMLCanvasElement
  margin: number
}

const cache = new Map<string, BallSprite>()

/**
 * The pixel-art ball (PixelBall.vue's look: outline, shade crescent, shine)
 * `cells` ball pixels wide, with its race's parts, baked once per size, fill
 * and race. Client-only; call after `preloadAll()` so part PNGs are in.
 */
export function useBallSprite() {
  const { drawSprite } = useSprites()

  function ballSprite(cells: number, fill: string, raceId?: string): BallSprite {
    const key = `${cells}|${fill}|${raceId ?? ''}`
    const cached = cache.get(key)
    if (cached) return cached
    const look = raceId !== undefined ? RACE_LOOKS[raceId] : undefined
    const margin = look ? RACE_PART_MARGIN : 0
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = cells + 2 * margin
    const g = canvas.getContext('2d')!
    g.imageSmoothingEnabled = false
    const parts = look?.parts ?? []
    for (const p of parts) if (p.layer === 'back') drawPart(g, p, cells, margin, fill)
    g.drawImage(plainBall(cells, fill), margin, margin)
    for (const p of parts) if (p.layer === 'front') drawPart(g, p, cells, margin, fill)
    const baked = { canvas, margin }
    cache.set(key, baked)
    return baked
  }

  /** One part with its pivot on its anchor (plus a mirrored copy on the left). */
  function drawPart(g: CanvasRenderingContext2D, p: RacePart, cells: number, margin: number, fill: string): void {
    const c = margin + cells / 2
    const q = (cells / 2) * Math.SQRT1_2
    const anchors: Record<RacePart['anchor'], [number, number]> = {
      top: [c, margin],
      bottom: [c, margin + cells],
      right: [margin + cells, c],
      upperRight: [c + q, c - q],
      center: [c, c],
    }
    const [ax, ay] = anchors[p.anchor]
    const x = Math.round(ax - p.pivot.x)
    const y = Math.round(ay - p.pivot.y)
    const sprite = skinned(p.spriteId, fill)
    g.drawImage(sprite, x, y)
    if (p.mirror) {
      g.save()
      g.translate(2 * c, 0) // flip about the ball's vertical axis
      g.scale(-1, 1)
      g.drawImage(sprite, x, y)
      g.restore()
    }
  }

  /** A part sprite with its skin markers recolored to the ball's fill and shade. */
  function skinned(spriteId: string, fill: string): HTMLCanvasElement {
    const { width, height } = spriteSource(spriteId)
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    const g = c.getContext('2d')!
    drawSprite(g, spriteId, 0, 0, 1, undefined, { x: 0, y: 0 })
    const [skin, skinShade] = [rgb(fill), rgb(fill, BALL_SHADE_STYLE)]
    const [markFill, markShade] = [rgb(RACE_SKIN.fill), rgb(RACE_SKIN.shade)]
    const img = g.getImageData(0, 0, width, height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      const to = same(d, i, markFill) ? skin : same(d, i, markShade) ? skinShade : null
      if (to) [d[i], d[i + 1], d[i + 2]] = to
    }
    g.putImageData(img, 0, 0)
    return c
  }

  return { ballSprite }
}

/** The ball itself, `cells` wide. The outline sits inside the hitbox. */
function plainBall(cells: number, fill: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = cells
  const g = c.getContext('2d')!
  const r = cells / 2
  const shift = cells * 0.18 // shade crescent: what a circle moved up-left misses
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const dx = x + 0.5 - r
      const dy = y + 0.5 - r
      const d = Math.hypot(dx, dy)
      if (d > r) continue
      if (d > r - 1) {
        g.fillStyle = BALL_OUTLINE_COLOR
        g.fillRect(x, y, 1, 1)
        continue
      }
      g.globalAlpha = 1
      g.fillStyle = fill
      g.fillRect(x, y, 1, 1)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      if (Math.hypot(dx + shift, dy + shift) > r - 1.5) {
        g.globalAlpha = BALL_SHADE_STYLE.opacity
        g.fillStyle = BALL_SHADE_STYLE.color
        g.fillRect(x, y, 1, 1)
      } else if (d > r - 3 && d <= r - 2 && angle > -165 && angle < -105) {
        g.globalAlpha = BALL_SHINE_STYLE.opacity
        g.fillStyle = BALL_SHINE_STYLE.color
        g.fillRect(x, y, 1, 1)
      }
      g.globalAlpha = 1
    }
  }
  return c
}

/** A CSS color as RGB, optionally with a translucent color laid over it. */
function rgb(color: string, over?: { color: string; opacity: number }): [number, number, number] {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  if (over) {
    g.globalAlpha = over.opacity
    g.fillStyle = over.color
    g.fillRect(0, 0, 1, 1)
  }
  const d = g.getImageData(0, 0, 1, 1).data
  return [d[0]!, d[1]!, d[2]!]
}

function same(d: Uint8ClampedArray, i: number, [r, g, b]: [number, number, number]): boolean {
  return d[i] === r && d[i + 1] === g && d[i + 2] === b
}
