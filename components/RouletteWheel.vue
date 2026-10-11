<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useSprites } from '~/composables/useSprites'

/**
 * Pixel-art roulette wheel. Rasterised per pixel on a small canvas (hard edges,
 * no anti-aliasing) and upscaled with `image-rendering: pixelated`. Slice size
 * is proportional to weight. Purely visual: the parent decides the result and
 * calls `spinTo` so the wheel lands on it.
 */
export interface WheelSlice {
  id: string
  weight: number // > 0 (zero-weight entries should not be passed)
  color: string // #rrggbb
  spriteId?: string // sprite drawn on the slice (native size, pointing outward)
  label?: string // name written upright on the slice (instead of a sprite)
}

const props = defineProps<{ slices: WheelSlice[] }>()

const SIZE = 192 // canvas px
const C = SIZE / 2
const R = 90 // wheel radius
const RIM = 2 // dark rim thickness
const HUB = 10
const INK: [number, number, number] = [24, 20, 37] // #181425
const TAU = Math.PI * 2
const FONT = '8px "Press Start 2P"'
const LABEL_R = (R - RIM) * 0.58 // labels sit centered this far out
const LABEL_MAX = 8 // chars (8px font)

const canvas = ref<HTMLCanvasElement | null>(null)
const { preloadAll, drawSprite } = useSprites()
let rotation = 0 // radians, clockwise
let raf = 0
const labels = new Map<string, HTMLCanvasElement>()

/**
 * A label baked once: white pixel-font text with an ink outline, alpha snapped
 * to on/off so it stays crisp on the pixelated canvas.
 */
function labelCanvas(text: string): HTMLCanvasElement {
  const cached = labels.get(text)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = text.length * 8 + 2
  c.height = 10
  const g = c.getContext('2d')!
  g.font = FONT
  g.textBaseline = 'top'
  g.fillStyle = '#181425'
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.fillText(text, dx!, dy!)
  g.fillStyle = '#ffffff'
  g.fillText(text, 1, 1)
  const img = g.getImageData(0, 0, c.width, c.height)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 128 ? 255 : 0
  g.putImageData(img, 0, 0)
  // Only cache with the real font; before it loads this is a fallback.
  if (document.fonts?.check(FONT)) labels.set(text, c)
  return c
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Cumulative slice boundaries as fractions of the circle, clockwise from top. */
function bounds(): number[] {
  const total = props.slices.reduce((s, x) => s + x.weight, 0) || 1
  const out = [0]
  for (const s of props.slices) out.push(out[out.length - 1]! + s.weight / total)
  return out
}

function draw(): void {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!ctx) return
  const b = bounds()
  const colors = props.slices.map((s) => hexToRgb(s.color))
  const img = ctx.createImageData(SIZE, SIZE)
  const data = img.data

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - C
      const dy = y + 0.5 - C
      const d = Math.hypot(dx, dy)
      if (d > R) continue // transparent outside
      const i = (y * SIZE + x) * 4
      let rgb: number[] = INK
      if (d <= R - RIM && d > HUB) {
        // Angle clockwise from top, in wheel-local space (undo rotation).
        let a = (Math.atan2(dx, -dy) - rotation) / TAU
        a -= Math.floor(a)
        let k = 0
        while (k < props.slices.length - 1 && a >= b[k + 1]!) k++
        // 1px-ish dark divider on each slice boundary (skip a lone slice).
        const edge = Math.min(a - b[k]!, b[k + 1]! - a) * TAU * d
        if (props.slices.length > 1 && edge < 0.9) {
          rgb = INK
        } else {
          const c = colors[k] ?? INK
          // Darker outer band for a bit of retro depth.
          const shade = d > R - RIM - 4 ? 0.78 : 1
          rgb = [c[0] * shade, c[1] * shade, c[2] * shade]
        }
      } else if (d <= HUB) {
        rgb = d <= HUB - 2 ? [254, 174, 52] : INK // gold hub with ink outline
      }
      data[i] = rgb[0]!
      data[i + 1] = rgb[1]!
      data[i + 2] = rgb[2]!
      data[i + 3] = 255
    }
  }
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.putImageData(img, 0, 0)

  // Icons ride the wheel at mid-slice, pointing outward; labels ride it too
  // but stay upright, so they read (and stay crisp) while it spins.
  ctx.imageSmoothingEnabled = false
  props.slices.forEach((s, k) => {
    const span = b[k + 1]! - b[k]!
    if (s.label) {
      if (span * TAU * LABEL_R < 12) return // too thin for a line of text
      const text = s.label.length > LABEL_MAX ? `${s.label.slice(0, LABEL_MAX - 1)}.` : s.label
      const a = ((b[k]! + b[k + 1]!) / 2) * TAU + rotation
      const img = labelCanvas(text.toUpperCase())
      const x = Math.round(C + Math.sin(a) * LABEL_R - img.width / 2)
      const y = Math.round(C - Math.cos(a) * LABEL_R - img.height / 2)
      ctx.drawImage(img, x, y)
      return
    }
    if (!s.spriteId) return
    if (span < 0.07) return // too thin to fit an icon
    const a = ((b[k]! + b[k + 1]!) / 2) * TAU + rotation
    const rr = (R - RIM) * 0.6
    drawSprite(ctx, s.spriteId, C + Math.sin(a) * rr, C - Math.cos(a) * rr, 1, a - Math.PI / 2) // weapons point right
  })

  drawPointer(ctx)
}

/**
 * Fixed pointer at the top: a regular pentagon (flat top, flaring sides, tip
 * pointing down into the wheel) in the sword blade's steel — light left face,
 * white center ridge, darker right face, ink outline.
 */
function drawPointer(ctx: CanvasRenderingContext2D): void {
  const PR = 10.5 // circumradius (px)
  const cy = 0.809 * PR // puts the flat top edge at y = 0
  const verts = Array.from({ length: 5 }, (_, k) => {
    const a = Math.PI / 2 + (k * TAU) / 5 // k = 0 is the bottom tip
    return [PR * Math.cos(a), cy + PR * Math.sin(a)] as const
  })
  // Convex polygon test: same side of every edge.
  const inside = (x: number, y: number): boolean => {
    let sign = 0
    for (let i = 0; i < 5; i++) {
      const [ax, ay] = verts[i]!
      const [bx, by] = verts[(i + 1) % 5]!
      const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
      const s = c >= 0 ? 1 : -1
      if (sign === 0) sign = s
      else if (s !== sign) return false
    }
    return true
  }
  const half = Math.ceil(PR)
  for (let y = 0; y <= Math.ceil(cy + PR); y++) {
    for (let x = -half; x <= half; x++) {
      const py = y + 0.5
      if (!inside(x, py)) continue
      const edge = !inside(x + 1, py) || !inside(x - 1, py) || !inside(x, py + 1) || !inside(x, py - 1)
      ctx.fillStyle = edge ? '#181425' : x < 0 ? '#c0cbdc' : x === 0 ? '#ffffff' : '#8b9bb4'
      ctx.fillRect(C + x, y + 1, 1, 1)
    }
  }
}

/**
 * Spin so the pointer stops on slice `id` at `landing` ∈ [0, 1) within it.
 * Resolves when the wheel stops. `durationMs` 0 = jump (reduced motion).
 */
function spinTo(id: string, landing: number, durationMs: number): Promise<void> {
  cancelAnimationFrame(raf)
  const k = props.slices.findIndex((s) => s.id === id)
  if (k < 0) return Promise.resolve()
  const b = bounds()
  const target = (b[k]! + (b[k + 1]! - b[k]!) * landing) * TAU
  // Pointer reads local angle -rotation, so stop where rotation ≡ -target.
  const start = rotation
  const base = Math.ceil(start / TAU) * TAU
  const end = base + 5 * TAU + (TAU - target)

  if (durationMs <= 0) {
    rotation = end % TAU
    draw()
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs)
      const eased = 1 - (1 - t) ** 4 // fast start, long slow-down
      rotation = start + (end - start) * eased
      draw()
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        rotation %= TAU
        resolve()
      }
    }
    raf = requestAnimationFrame(tick)
  })
}

defineExpose({ spinTo })

watch(() => props.slices, draw, { deep: true })

onMounted(async () => {
  draw()
  await Promise.all([preloadAll(), document.fonts?.load(FONT).catch(() => undefined)])
  draw() // redraw once icon PNGs and the label font are in
})

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas
    ref="canvas"
    :width="SIZE"
    :height="SIZE"
    class="aspect-square w-full max-w-[420px]"
    style="image-rendering: pixelated;"
  />
</template>
