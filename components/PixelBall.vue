<script setup lang="ts">
import {
  BALL_CIRCLE, BALL_OUTLINE_COLOR, BALL_OUTLINE_OFFSETS, BALL_SHADE, BALL_SHADE_STYLE, BALL_SHINE, BALL_SHINE_STYLE, rectsToPath,
} from '~/utils/pixelBall'

type BallColor = 'blue' | 'red'

const props = withDefaults(defineProps<{
  color?: BallColor
  /** Any CSS color (e.g. a ball's appearance); overrides `color`. */
  fill?: string
}>(), {
  color: 'blue',
  fill: undefined,
})

// 12×12 pixel circle, drawn on a 14×14 grid so a 1px outline fits around it.
const CIRCLE = rectsToPath(BALL_CIRCLE)
const SHADE = rectsToPath(BALL_SHADE)
const SHINE = rectsToPath(BALL_SHINE)
const OUTLINE_OFFSETS = BALL_OUTLINE_OFFSETS.map(([x, y]) => `${x} ${y}`)

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
</script>

<template>
  <svg viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">
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
