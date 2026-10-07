/**
 * Client-only retro bitmap font.
 *
 * When `/sprites/font/pixel-font.png` is present (an 8×8 fixed-grid atlas,
 * ASCII 32–126, 16 columns), text is drawn glyph-by-glyph from it. Until then,
 * a crisp monospace canvas-font fallback keeps labels readable.
 *
 * Glyph index: col = (code - 32) % 16, row = ⌊(code - 32) / 16⌋.
 */

const CELL = 8
const COLS = 16
const FIRST = 32
const LAST = 126

let atlas: HTMLImageElement | null = null
let atlasReady = false
let atlasFailed = false

function loadAtlas(): void {
  if (atlas || atlasFailed) return
  const img = new Image()
  img.onload = () => {
    atlas = img
    atlasReady = true
  }
  img.onerror = () => {
    atlasFailed = true
  }
  img.src = '/sprites/font/pixel-font.png'
}

export function usePixelFont() {
  function preloadFont(): void {
    loadAtlas()
  }

  /** Draw a left-aligned string at (x, y) top-left, integer `scale`. */
  function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    scale = 1,
    color = '#ffffff',
  ): void {
    ctx.save()
    ctx.imageSmoothingEnabled = false

    if (atlasReady && atlas) {
      let cx = x
      for (const ch of text) {
        const code = ch.charCodeAt(0)
        if (code >= FIRST && code <= LAST) {
          const idx = code - FIRST
          const sx = (idx % COLS) * CELL
          const sy = Math.floor(idx / COLS) * CELL
          ctx.drawImage(atlas, sx, sy, CELL, CELL, cx, y, CELL * scale, CELL * scale)
        }
        cx += CELL * scale
      }
    } else {
      // Fallback: crisp monospace. Not pixel-perfect but readable.
      ctx.fillStyle = color
      ctx.textBaseline = 'top'
      ctx.font = `${CELL * scale}px monospace`
      ctx.fillText(text, x, y)
    }

    ctx.restore()
  }

  /** Pixel width of a string at the given scale. */
  function measureText(text: string, scale = 1): number {
    return text.length * CELL * scale
  }

  return { preloadFont, drawText, measureText }
}
