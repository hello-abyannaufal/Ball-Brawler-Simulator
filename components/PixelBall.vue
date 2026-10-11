<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RACE_LOOKS } from '~/assets/sprites/races'
import { BALL_PIXEL, isSpiked, useBallSprite } from '~/composables/useBallSprite'
import { useSprites } from '~/composables/useSprites'
import { raceRegistry } from '~/engine/races/registry'
import {
  BALL_CIRCLE, BALL_DEFAULT_FILL, BALL_OUTLINE_COLOR, BALL_OUTLINE_OFFSETS, BALL_SHADE, BALL_SHADE_STYLE, BALL_SHINE, BALL_SHINE_STYLE, rectsToPath,
} from '~/utils/pixelBall'

type BallColor = 'blue' | 'red'

const props = withDefaults(defineProps<{
  color?: BallColor
  /** Any CSS color (e.g. a ball's appearance); overrides `color`. */
  fill?: string
  /** Draws the race's parts on the ball, as in the arena. */
  raceId?: string
  /** Draws the trait's look on the ball (Spike: spikes), as in the arena. */
  traitId?: string
}>(), {
  color: 'blue',
  fill: undefined,
  raceId: undefined,
  traitId: undefined,
})

// 12×12 pixel circle, drawn on a 14×14 grid so a 1px outline fits around it.
const CIRCLE = rectsToPath(BALL_CIRCLE)
const SHADE = rectsToPath(BALL_SHADE)
const SHINE = rectsToPath(BALL_SHINE)
const OUTLINE_OFFSETS = BALL_OUTLINE_OFFSETS.map(([x, y]) => `${x} ${y}`)
/** Size a race-less baked ball is drawn at (a saved ball's default radius). */
const DEFAULT_RADIUS = 32

interface Palette { fill: string, shade: string, shine: string, shadeOpacity: number, shineOpacity: number }

const PALETTES: Record<BallColor, Palette> = {
  blue: { fill: '#0099db', shade: '#124e89', shine: '#2ce8f5', shadeOpacity: 1, shineOpacity: 1 },
  red: { fill: '#e43b44', shade: '#a22633', shine: '#f6757a', shadeOpacity: 1, shineOpacity: 1 },
}

// A free fill color gets a translucent dark shade and light shine on top.
const palette = computed<Palette>(() =>
  props.fill
    ? {
        fill: props.fill,
        shade: BALL_SHADE_STYLE.color,
        shine: BALL_SHINE_STYLE.color,
        shadeOpacity: BALL_SHADE_STYLE.opacity,
        shineOpacity: BALL_SHINE_STYLE.opacity,
      }
    : PALETTES[props.color],
)

// A ball with a race or spikes is the arena's baked sprite (ball + parts, at
// the race's size), cropped to its pixels. Client-only: the plain ball shows
// until then.
const raceImage = ref<string | null>(null)
const { preloadAll } = useSprites()
const { ballSprite } = useBallSprite()

async function bakeRace(): Promise<void> {
  const race = props.raceId !== undefined ? raceRegistry.get(props.raceId) : undefined
  const spiked = isSpiked(props.traitId)
  if ((!race || !RACE_LOOKS[race.id]) && !spiked) {
    raceImage.value = null
    return
  }
  await preloadAll()
  const cells = Math.max(4, Math.round(((race?.radius ?? DEFAULT_RADIUS) * 2) / BALL_PIXEL))
  raceImage.value = cropped(ballSprite(cells, props.fill ?? BALL_DEFAULT_FILL, race?.id, spiked).canvas)
}

/** Data URL of the canvas cropped to its non-transparent pixels. */
function cropped(src: HTMLCanvasElement): string {
  const { data, width, height } = src.getContext('2d')!.getImageData(0, 0, src.width, src.height)
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
  }
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL()
}

onMounted(bakeRace)
watch(() => [props.raceId, props.traitId, props.fill], bakeRace)
</script>

<template>
  <img
    v-if="raceImage"
    :src="raceImage"
    alt=""
    aria-hidden="true"
    class="object-contain [image-rendering:pixelated]"
  >
  <svg v-else viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">
    <path
      v-for="offset in OUTLINE_OFFSETS"
      :key="offset"
      :transform="`translate(${offset})`"
      :fill="BALL_OUTLINE_COLOR"
      :d="CIRCLE"
    />
    <path transform="translate(1 1)" :fill="palette.fill" :d="CIRCLE" />
    <path transform="translate(1 1)" :fill="palette.shade" :fill-opacity="palette.shadeOpacity" :d="SHADE" />
    <path transform="translate(1 1)" :fill="palette.shine" :fill-opacity="palette.shineOpacity" :d="SHINE" />
  </svg>
</template>
