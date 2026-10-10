// How each race looks: feature sprites drawn on the ball. Render-only, like
// the manifest; the engine never imports it and parts have no hitbox.

/** A feature sprite placed on the ball, in ball pixels. */
export interface RacePart {
  spriteId: string
  /** Point on the ball's edge the sprite's `pivot` is put on (`upperRight`:
   *  45° up from `right`), or its center. */
  anchor: 'top' | 'bottom' | 'right' | 'upperRight' | 'center'
  pivot: { x: number; y: number }
  /** 'back' parts are drawn under the ball (ears), 'front' over it. */
  layer: 'back' | 'front'
  /** Also draw a mirrored copy on the left side (a pair of ears). */
  mirror?: boolean
}

export interface RaceLook {
  iconId: string // roulette wheel icon, upright
  parts: readonly RacePart[]
}

/** Skin marker colors in part sprites, recolored to the ball's fill / its shade. */
export const RACE_SKIN = { fill: '#ff0044', shade: '#f6757a' } as const

/** Ball pixels around the ball reserved for parts that stick out. */
export const RACE_PART_MARGIN = 8

export const RACE_LOOKS: Record<string, RaceLook> = {
  human: {
    iconId: 'race-icon:human',
    parts: [{ spriteId: 'race:human-hair', anchor: 'top', pivot: { x: 6, y: 4 }, layer: 'front' }],
  },
  elf: {
    iconId: 'race-icon:elf',
    parts: [{ spriteId: 'race:elf-ear', anchor: 'right', pivot: { x: 1, y: 5 }, layer: 'back', mirror: true }],
  },
  orc: {
    iconId: 'race-icon:orc',
    parts: [{ spriteId: 'race:orc-tusks', anchor: 'bottom', pivot: { x: 5.5, y: 8 }, layer: 'front' }],
  },
  dwarf: {
    iconId: 'race-icon:dwarf',
    parts: [
      { spriteId: 'race:dwarf-helm', anchor: 'top', pivot: { x: 6.5, y: 4 }, layer: 'front' },
      { spriteId: 'race:dwarf-beard', anchor: 'bottom', pivot: { x: 6.5, y: 6 }, layer: 'front' },
    ],
  },
  goblin: {
    iconId: 'race-icon:goblin',
    parts: [{ spriteId: 'race:goblin-ear', anchor: 'right', pivot: { x: 2, y: 7 }, layer: 'back', mirror: true }],
  },
  giant: {
    iconId: 'race-icon:giant',
    parts: [{ spriteId: 'race:giant-horn', anchor: 'upperRight', pivot: { x: 2, y: 8 }, layer: 'back', mirror: true }],
  },
}
