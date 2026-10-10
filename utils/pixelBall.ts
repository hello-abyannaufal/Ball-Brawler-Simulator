/**
 * The pixel-art ball of the fighter picker (PixelBall.vue). Rects are
 * [x, y, w, h] on a 12×12 grid; the 1-cell outline makes the full sprite 14×14.
 * The Versus canvas draws the same look (colors and styles below) at a finer
 * pixel size to match the weapon sprites.
 */
export type PixelRect = readonly [number, number, number, number]

export const BALL_CIRCLE: readonly PixelRect[] = [
  [4, 0, 4, 1], [2, 1, 8, 1], [1, 2, 10, 2], [0, 4, 12, 4], [1, 8, 10, 2], [2, 10, 8, 1], [4, 11, 4, 1],
]
export const BALL_SHADE: readonly PixelRect[] = [[10, 5, 2, 3], [8, 8, 3, 2], [5, 10, 5, 1]]
export const BALL_SHINE: readonly PixelRect[] = [[3, 2, 3, 1], [2, 3, 1, 2]]
/** Circle copies drawn in the outline color, offset on the 14×14 grid. */
export const BALL_OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [[0, 1], [2, 1], [1, 0], [1, 2]]
export const BALL_OUTLINE_COLOR = '#181425'
/** Fill for a ball without a color appearance. */
export const BALL_DEFAULT_FILL = '#c0cbdc'

/** A free fill color gets a translucent dark shade and light shine on top. */
export const BALL_SHADE_STYLE = { color: '#181425', opacity: 0.35 }
export const BALL_SHINE_STYLE = { color: '#ffffff', opacity: 0.55 }

/** SVG path data for a list of rects. */
export function rectsToPath(rects: readonly PixelRect[]): string {
  return rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join('')
}
