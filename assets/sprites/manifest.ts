// Sprite manifest: maps every spriteId to a source.
// - 'image'      → a PNG under public/sprites/ (preferred when present)
// - 'procedural' → drawn in code (default fallback so the game runs with
//                  zero external files). Any entry can later switch to 'image'
//                  with no other code change.
//
// This layer is app/client-only. The engine never imports it.

export type ProceduralDraw = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void

export type SpriteSource =
  | { kind: 'image'; src: string; width: number; height: number }
  | { kind: 'procedural'; width: number; height: number; draw: ProceduralDraw }

// ---- EDG32 palette subset used by procedural fallbacks ----
const C = {
  steel: '#c0cbdc',
  steelDark: '#8b9bb4',
  wood: '#b86f50',
  woodDark: '#733e39',
  gold: '#feae34',
  red: '#e43b44',
  green: '#63c74d',
  blue: '#0099db',
  cyan: '#2ce8f5',
  white: '#ffffff',
  ink: '#181425',
  purple: '#b55088',
} as const

/** Fill a crisp rectangle in integer pixels. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** Highly visible placeholder for missing/unknown sprites. */
const placeholderDraw: ProceduralDraw = (ctx, w, h) => {
  px(ctx, 0, 0, w, h, '#ff00ff')
  px(ctx, 1, 1, w - 2, h - 2, C.ink)
  ctx.fillStyle = '#ff00ff'
  ctx.fillRect(1, 1, (w - 2) / 2, (h - 2) / 2)
  ctx.fillRect(1 + (w - 2) / 2, 1 + (h - 2) / 2, (w - 2) / 2, (h - 2) / 2)
}

export const PLACEHOLDER: SpriteSource = {
  kind: 'procedural',
  width: 16,
  height: 16,
  draw: placeholderDraw,
}

// ---- Procedural weapon fallbacks (used only if the PNG is absent) ----
const swordProc: ProceduralDraw = (ctx) => {
  px(ctx, 6, 15, 3, 3, C.woodDark) // grip
  px(ctx, 9, 14, 2, 5, C.gold) // guard
  px(ctx, 11, 15, 16, 2, C.steel) // blade
  px(ctx, 25, 15, 3, 2, C.steelDark) // tip
}
const hammerProc: ProceduralDraw = (ctx) => {
  px(ctx, 4, 15, 14, 2, C.wood) // handle
  px(ctx, 18, 10, 9, 12, C.steel) // head
  px(ctx, 18, 10, 9, 2, C.steelDark)
}
const spearProc: ProceduralDraw = (ctx, w) => {
  px(ctx, 4, 5, w - 10, 2, C.wood) // shaft
  px(ctx, w - 6, 4, 4, 4, C.steel) // tip
}
const bowProc: ProceduralDraw = (ctx) => {
  px(ctx, 18, 8, 2, 16, C.wood) // right-bulging limb
  px(ctx, 16, 6, 2, 4, C.wood)
  px(ctx, 16, 22, 2, 4, C.wood)
  px(ctx, 14, 10, 1, 12, C.white) // string on the left
}

// ---- Projectiles ----
/** 12×5 arrow pointing RIGHT (+x): fletching, wooden shaft, steel head. */
const arrowProc: ProceduralDraw = (ctx) => {
  px(ctx, 0, 0, 2, 1, C.red) // fletching
  px(ctx, 0, 4, 2, 1, C.red)
  px(ctx, 1, 1, 2, 1, C.red)
  px(ctx, 1, 3, 2, 1, C.red)
  px(ctx, 0, 2, 9, 1, C.wood) // shaft
  px(ctx, 9, 1, 1, 3, C.steelDark) // head
  px(ctx, 10, 1, 1, 3, C.steel)
  px(ctx, 11, 2, 1, 1, C.white) // tip
}

// ---- Hit-flash (projectile hits): concentric diamond ----
const hitProjectileProc: ProceduralDraw = (ctx, w, h) => {
  const cx = w / 2
  const cy = h / 2
  for (let r = 3; r <= 9; r += 3) {
    px(ctx, cx - 1, cy - r, 2, 2, C.red)
    px(ctx, cx - 1, cy + r - 1, 2, 2, C.red)
    px(ctx, cx - r, cy - 1, 2, 2, C.red)
    px(ctx, cx + r - 1, cy - 1, 2, 2, C.red)
  }
}

/** A pixel map (one char per pixel, '.' transparent), rows starting at `top`. */
function gridProc(colors: Record<string, string>, rows: string[], top = 0): ProceduralDraw {
  return (ctx) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = colors[row[x]!]
        if (c) px(ctx, x, top + y, 1, 1, c)
      }
    })
  }
}

// Scythe: the same pixels as scythe.png.
const scytheProc = gridProc({
  K: C.ink, s: '#5a6988', d: C.steelDark, l: C.steel, W: C.white,
  t: '#e4a672', w: C.wood, p: C.purple, k: C.woodDark, q: '#68386c',
}, [
  '.............KKKKKKKKKK.........',
  '...........KKssssssssssKK.......',
  '..........KssddddddddddssK......',
  '.........KllllllllldddddssK.....',
  '........KllWWWWWWWllldddddsK....',
  '........KWWKKKKKKKWWWllddddsK...',
  '.........KK.......KKWWlldddssK..',
  '....................KKWlldddsK..',
  '......................KWlldddsK.',
  '.......................KWllddsK.',
  '........................KKKKKsK.',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKldKsK.',
  'KttwttpppwttwttwttwttwttwKddKK..',
  'KwwkwwqqqkwwkwwkwwkwwkwwkKddK...',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKdsK...',
  '.........................KKKK...',
], 4)

// ---- Status icons (8×8, drawn at 2× in the HUD); same art as the PNGs ----
const STATUS_COLORS: Record<string, string> = {
  K: C.ink, W: C.white, G: C.green, g: '#3e8948', B: C.blue, b: '#124e89',
  C: C.cyan, y: '#fee761', Y: C.gold, o: '#f77622',
}
const poisonProc = gridProc(STATUS_COLORS, ['...KK...', '..KGGK..', '..KGGK..', '.KGWGGK.', 'KGWGGGgK', 'KGGGGggK', '.KggggK.', '..KKKK..'])
const slowProc = gridProc(STATUS_COLORS, ['KKKKKKKK', '.KbbbbK.', '..KBBK..', '...KK...', '...KK...', '..KbBK..', '.KBBBCK.', 'KKKKKKKK'])
const stunProc = gridProc(STATUS_COLORS, ['...KK...', '..KyYK..', '.KKyYKK.', 'KyyWYYoK', 'KYyYYooK', '.KKYoKK.', '..KYoK..', '...KK...'])

const SIZE_ENTITY = 32
const SIZE_SPEAR_W = 48
const SIZE_SPEAR_H = 12
const SIZE_STATUS = 8

/** The full sprite registry. */
export const SPRITE_MANIFEST: Record<string, SpriteSource> = {
  // Weapons — PNGs already present under public/sprites/weapons/.
  'weapon:sword': { kind: 'image', src: '/sprites/weapons/sword.png', width: SIZE_ENTITY, height: SIZE_ENTITY },
  'weapon:hammer': { kind: 'image', src: '/sprites/weapons/hammer.png', width: SIZE_ENTITY, height: SIZE_ENTITY },
  'weapon:spear': { kind: 'image', src: '/sprites/weapons/spear.png', width: SIZE_SPEAR_W, height: SIZE_SPEAR_H },
  'weapon:bow': { kind: 'image', src: '/sprites/weapons/bow.png', width: SIZE_ENTITY, height: SIZE_ENTITY },
  'weapon:scythe': { kind: 'image', src: '/sprites/weapons/scythe.png', width: SIZE_ENTITY, height: SIZE_ENTITY },

  // Projectiles — procedural until PNGs exist.
  'projectile:arrow': { kind: 'procedural', width: 12, height: 5, draw: arrowProc },

  // Hit-flash FX.
  'fx:hit-projectile': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: hitProjectileProc },

  // Status icons (HUD). Keyed by status id: `status:<id>`.
  'status:poison': { kind: 'image', src: '/sprites/icons/status/poison.png', width: SIZE_STATUS, height: SIZE_STATUS },
  'status:slow': { kind: 'image', src: '/sprites/icons/status/slow.png', width: SIZE_STATUS, height: SIZE_STATUS },
  'status:stun': { kind: 'image', src: '/sprites/icons/status/stun.png', width: SIZE_STATUS, height: SIZE_STATUS },
  'status:poison:proc': { kind: 'procedural', width: SIZE_STATUS, height: SIZE_STATUS, draw: poisonProc },
  'status:slow:proc': { kind: 'procedural', width: SIZE_STATUS, height: SIZE_STATUS, draw: slowProc },
  'status:stun:proc': { kind: 'procedural', width: SIZE_STATUS, height: SIZE_STATUS, draw: stunProc },

  // Weapon procedural fallbacks are also exposed under *:proc ids so the
  // renderer can prefer them if an image fails to load.
  'weapon:sword:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: swordProc },
  'weapon:hammer:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: hammerProc },
  'weapon:spear:proc': { kind: 'procedural', width: SIZE_SPEAR_W, height: SIZE_SPEAR_H, draw: spearProc },
  'weapon:bow:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: bowProc },
  'weapon:scythe:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: scytheProc },
}

/** Resolve a spriteId to its source, or the placeholder when unknown. */
export function spriteSource(id: string): SpriteSource {
  return SPRITE_MANIFEST[id] ?? PLACEHOLDER
}
