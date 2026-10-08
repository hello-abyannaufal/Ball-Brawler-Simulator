<script setup lang="ts">
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
const CIRCLE = 'M4 0h4v1h-4zM2 1h8v1h-8zM1 2h10v2h-10zM0 4h12v4h-12zM1 8h10v2h-10zM2 10h8v1h-8zM4 11h4v1h-4z'
const SHADE = 'M10 5h2v3h-2zM8 8h3v2h-3zM5 10h5v1h-5z'
const SHINE = 'M3 2h3v1h-3zM2 3h1v2h-1z'
const OUTLINE_OFFSETS = ['0 1', '2 1', '1 0', '1 2']

interface Palette { fill: string, shade: string, shine: string, shadeOpacity: number, shineOpacity: number }

const PALETTES: Record<BallColor, Palette> = {
  blue: { fill: '#0099db', shade: '#124e89', shine: '#2ce8f5', shadeOpacity: 1, shineOpacity: 1 },
  red: { fill: '#e43b44', shade: '#a22633', shine: '#f6757a', shadeOpacity: 1, shineOpacity: 1 },
}

// A free fill color gets a translucent dark shade and light shine on top.
const palette = computed<Palette>(() =>
  props.fill
    ? { fill: props.fill, shade: '#181425', shine: '#ffffff', shadeOpacity: 0.35, shineOpacity: 0.55 }
    : PALETTES[props.color],
)
</script>

<template>
  <svg viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">
    <path
      v-for="offset in OUTLINE_OFFSETS"
      :key="offset"
      :transform="`translate(${offset})`"
      fill="#181425"
      :d="CIRCLE"
    />
    <path transform="translate(1 1)" :fill="palette.fill" :d="CIRCLE" />
    <path transform="translate(1 1)" :fill="palette.shade" :fill-opacity="palette.shadeOpacity" :d="SHADE" />
    <path transform="translate(1 1)" :fill="palette.shine" :fill-opacity="palette.shineOpacity" :d="SHINE" />
  </svg>
</template>
