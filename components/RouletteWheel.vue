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
}

const props = defineProps<{ slices: WheelSlice[] }>()

const SIZE = 192 // canvas px
const C = SIZE / 2
const R = 90 // wheel radius
const RIM = 2 // dark rim thickness
const HUB = 10
const INK: [number, number, number] = [24, 20, 37] // #181425
const TAU = Math.PI * 2

const canvas = ref<HTMLCanvasElement | null>(null)
const { preloadAll, drawSprite } = useSprites()
let rotation = 0 // radians, clockwise
let raf = 0

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

  // Icons ride the wheel at mid-slice, pointing outward.
  ctx.imageSmoothingEnabled = false
  props.slices.forEach((s, k) => {
    if (!s.spriteId) return
    const span = b[k + 1]! - b[k]!
    if (span < 0.07) return // too thin to fit an icon
    const a = ((b[k]! + b[k + 1]!) / 2) * TAU + rotation
    const rr = (R - RIM) * 0.6
    drawSprite(ctx, s.spriteId, C + Math.sin(a) * rr, C - Math.cos(a) * rr, 1, a - Math.PI / 2)
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
  await preloadAll()
  draw() // redraw once icon PNGs are in
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
