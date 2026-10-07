/**
 * Client-only 9-slice panel/button drawer for retro UI.
 *
 * When a source PNG is present (24×24 panel, or a 96×24 button strip of four
 * 24×24 frames), the 8px corners/edges are drawn un-stretched and the center/
 * edges are tiled/stretched to fill the target rect. Until the PNGs exist, a
 * procedural beveled frame keeps the UI usable.
 *
 * All drawing uses `imageSmoothingEnabled = false`.
 */

const MARGIN = 8 // 9-slice corner/edge size in source pixels

type Loaded = { img: HTMLImageElement } | null

const panelImg: { value: Loaded } = { value: null }
const buttonImg: { value: Loaded } = { value: null }
let panelFailed = false
let buttonFailed = false

function load(src: string, slot: { value: Loaded }, onFail: () => void): void {
  const img = new Image()
  img.onload = () => (slot.value = { img })
  img.onerror = onFail
  img.src = src
}

// EDG32 UI colors.
const UI = {
  faceNormal: '#5a6988',
  faceHover: '#8b9bb4',
  facePressed: '#3a4466',
  faceDisabled: '#3a4466',
  light: '#c0cbdc',
  dark: '#262b44',
  ink: '#181425',
} as const

export type ButtonState = 'normal' | 'hover' | 'pressed' | 'disabled'

function drawProceduralFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  face: string,
  pressed: boolean,
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  // outer ink border
  ctx.fillStyle = UI.ink
  ctx.fillRect(x, y, w, h)
  // bevel
  ctx.fillStyle = pressed ? UI.dark : UI.light
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
  ctx.fillStyle = pressed ? UI.light : UI.dark
  ctx.fillRect(x + 2, y + 2, w - 3, h - 3)
  // face
  ctx.fillStyle = face
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
  ctx.restore()
}

function draw9SliceImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const m = MARGIN
  ctx.imageSmoothingEnabled = false
  const rows = [
    [0, m],
    [m, sh - 2 * m],
    [sh - m, m],
  ] as const
  const colsSrc = [
    [sx, m],
    [sx + m, sw - 2 * m],
    [sx + sw - m, m],
  ] as const
  const colsDst = [
    [dx, m],
    [dx + m, dw - 2 * m],
    [dx + dw - m, m],
  ] as const
  const rowsDst = [
    [dy, m],
    [dy + m, dh - 2 * m],
    [dy + dh - m, m],
  ] as const
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.drawImage(
        img,
        colsSrc[c]![0], rows[r]![0], colsSrc[c]![1], rows[r]![1],
        colsDst[c]![0], rowsDst[r]![0], colsDst[c]![1], rowsDst[r]![1],
      )
    }
  }
}

export function useNineSlice() {
  function preloadUi(): void {
    if (!panelImg.value && !panelFailed) {
      load('/sprites/ui/panel.png', panelImg, () => (panelFailed = true))
    }
    if (!buttonImg.value && !buttonFailed) {
      load('/sprites/ui/button.png', buttonImg, () => (buttonFailed = true))
    }
  }

  function drawPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (panelImg.value) {
      draw9SliceImage(ctx, panelImg.value.img, 0, 24, 24, x, y, w, h)
    } else {
      drawProceduralFrame(ctx, x, y, w, h, UI.facePressed, false)
    }
  }

  function drawButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    state: ButtonState = 'normal',
  ): void {
    const frame = { normal: 0, hover: 1, pressed: 2, disabled: 3 }[state]
    if (buttonImg.value) {
      draw9SliceImage(ctx, buttonImg.value.img, frame * 24, 24, 24, x, y, w, h)
    } else {
      const face = {
        normal: UI.faceNormal,
        hover: UI.faceHover,
        pressed: UI.facePressed,
        disabled: UI.faceDisabled,
      }[state]
      drawProceduralFrame(ctx, x, y, w, h, face, state === 'pressed')
    }
  }

  return { preloadUi, drawPanel, drawButton }
}
