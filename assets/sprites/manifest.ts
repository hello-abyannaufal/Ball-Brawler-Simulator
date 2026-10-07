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
  slot: '#3a4466',
  slotEdge: '#262b44',
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
/** Fallback if shuriken.png fails: 9×9 four-point shuriken, scaled to fit. */
const SHURIKEN_9 = [
  '....#....',
  '...##....',
  '...#L....',
  '.#.LDL##.',
  '##LDODL##',
  '.##LDL.#.',
  '....L#...',
  '....##...',
  '....#....',
]
const shurikenProc: ProceduralDraw = (ctx, w, h) => {
  const k = Math.max(1, Math.floor(Math.min(w, h) / 9))
  const ox = Math.floor((w - 9 * k) / 2)
  const oy = Math.floor((h - 9 * k) / 2)
  const col: Record<string, string> = { '#': C.steel, L: C.white, D: C.steelDark, O: C.ink }
  SHURIKEN_9.forEach((row, y) => {
    for (let x = 0; x < 9; x++) {
      const c = col[row[x]!]
      if (c) px(ctx, ox + x * k, oy + y * k, k, k, c)
    }
  })
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
const blasterShotProc: ProceduralDraw = (ctx) => {
  px(ctx, 2, 3, 4, 2, C.cyan)
  px(ctx, 1, 3, 1, 2, C.blue)
}

// ---- Hit-flash: distinct by SHAPE (round / diamond) ----
const hitContactProc: ProceduralDraw = (ctx, w, h) => {
  ctx.fillStyle = C.white
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2
    px(ctx, Math.round(w / 2 + Math.cos(ang) * 8) - 1, Math.round(h / 2 + Math.sin(ang) * 8) - 1, 2, 2, C.white)
  }
}
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

// ---- Generic icon fallback (badge variant reserved for skills, plain for weapons) ----
function iconProc(color: string, badge: boolean): ProceduralDraw {
  return (ctx, w, h) => {
    if (badge) {
      px(ctx, 1, 1, w - 2, h - 2, C.slotEdge)
      px(ctx, 2, 2, w - 4, h - 4, C.slot)
    }
    px(ctx, 5, 5, w - 10, h - 10, color)
  }
}

const SIZE_ENTITY = 32
const SIZE_SPEAR_W = 48
const SIZE_SPEAR_H = 12
const SIZE_PROJ = 8
const SIZE_ICON = 16

/** The full sprite registry. */
export const SPRITE_MANIFEST: Record<string, SpriteSource> = {
  // Weapons — PNGs already present under public/sprites/weapons/.
  'weapon:sword': { kind: 'image', src: '/sprites/weapons/sword.png', width: SIZE_ENTITY, height: SIZE_ENTITY },
  'weapon:hammer': { kind: 'image', src: '/sprites/weapons/hammer.png', width: SIZE_ENTITY, height: SIZE_ENTITY },
  'weapon:spear': { kind: 'image', src: '/sprites/weapons/spear.png', width: SIZE_SPEAR_W, height: SIZE_SPEAR_H },
  'weapon:shuriken': { kind: 'image', src: '/sprites/weapons/shuriken.png', width: SIZE_ENTITY, height: SIZE_ENTITY },
  'weapon:bow': { kind: 'image', src: '/sprites/weapons/bow.png', width: SIZE_ENTITY, height: SIZE_ENTITY },

  // Projectiles — procedural until PNGs exist.
  'projectile:arrow': { kind: 'procedural', width: 12, height: 5, draw: arrowProc },
  'projectile:blaster-shot': { kind: 'procedural', width: SIZE_PROJ, height: SIZE_PROJ, draw: blasterShotProc },

  // Hit-flash FX.
  'fx:hit-contact': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: hitContactProc },
  'fx:hit-projectile': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: hitProjectileProc },

  // Weapon icons (plain silhouette).
  'icon:weapon:sword': { kind: 'procedural', width: SIZE_ICON, height: SIZE_ICON, draw: iconProc(C.steel, false) },
  'icon:weapon:hammer': { kind: 'procedural', width: SIZE_ICON, height: SIZE_ICON, draw: iconProc(C.steel, false) },
  'icon:weapon:spear': { kind: 'procedural', width: SIZE_ICON, height: SIZE_ICON, draw: iconProc(C.wood, false) },
  'icon:weapon:shuriken': { kind: 'procedural', width: SIZE_ICON, height: SIZE_ICON, draw: shurikenProc },
  'icon:weapon:bow': { kind: 'procedural', width: SIZE_ICON, height: SIZE_ICON, draw: iconProc(C.wood, false) },

  // Weapon procedural fallbacks are also exposed under *:proc ids so the
  // renderer can prefer them if an image fails to load.
  'weapon:sword:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: swordProc },
  'weapon:hammer:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: hammerProc },
  'weapon:shuriken:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: shurikenProc },
  'weapon:spear:proc': { kind: 'procedural', width: SIZE_SPEAR_W, height: SIZE_SPEAR_H, draw: spearProc },
  'weapon:bow:proc': { kind: 'procedural', width: SIZE_ENTITY, height: SIZE_ENTITY, draw: bowProc },
}

/** Resolve a spriteId to its source, or the placeholder when unknown. */
export function spriteSource(id: string): SpriteSource {
  return SPRITE_MANIFEST[id] ?? PLACEHOLDER
}
