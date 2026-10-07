# Assets Plan — Ball Battle Simulator (Retro / Pixel-Art)

This document is the single catalog of visual assets for the project and the
generation prompts for each one. The whole app uses a retro, pixel-art look.

## Global Rules (apply to EVERY asset)

- **Style:** 16-bit retro pixel art, crisp hard edges, no anti-aliasing, no
  gradients, limited palette. Think SNES / GBA era.
- **Theme:** Dungeon / fantasy, minimalist. Stone arena, RPG-style window/panel
  UI, medieval weapons. Keep designs clean and uncluttered for the 9:16 portrait
  layout.
- **Transparency:** PNG with a fully transparent background (alpha), unless the
  asset is explicitly a tile/background. Alpha (fully transparent) is NOT one of
  the 32 palette colors — the palette is only for solid pixels; never fill the
  background with a palette color.
- **No blur / no smoothing:** pixels are square and sharp. Rendered in-app with
  `imageSmoothingEnabled = false` at integer scale (×2, ×3, ×4).
- **Readability:** each asset must read clearly at 1× (its native pixel grid).
- **Distinction without color:** where variants must be distinguishable
  (hit-flash), differ by SHAPE/PATTERN, not color alone (color-blind + reduced
  motion safe).

### Official Palette — Endesga 32 (EDG32)

Use ONLY these 32 colors across every asset (plus full transparency for
backgrounds). Do not introduce other hues.

```
#be4a2f #d77643 #ead4aa #e4a672 #b86f50 #733e39 #3e2731 #a22633
#e43b44 #f77622 #feae34 #fee761 #63c74d #3e8948 #265c42 #193c3e
#124e89 #0099db #2ce8f5 #ffffff #c0cbdc #8b9bb4 #5a6988 #3a4466
#262b44 #181425 #ff0044 #68386c #b55088 #f6757a #e8b796 #c28569
```

### Pivot / centering (directional items)

- "Forward" always points **right (+x)**.
- Every directional sprite has a **pivot** `(x, y)` in sprite pixels: the point
  that sits on the ball's hand and that the sprite rotates around. The
  renderer draws it as:
  `ctx.translate(handX, handY); ctx.rotate(angle); ctx.drawImage(img, -pivot.x * scale, -pivot.y * scale, ...)`.
- **Default pivot = left-middle** `(grip x, height/2)`: held weapons put the
  grip on the left so the blade/head/tip has room to the right and covers its
  hitbox. On rotation the tip swings while the grip stays at the hand.
- **Anchor point (held weapons):** the renderer places the pivot at the
  ball's surface along its facing, `hand = owner.position + facing ×
  owner.radius`, NOT at `WeaponEntity.position`. The engine sets
  `WeaponEntity.position` to the hitbox center (mid-blade,
  `owner.radius + length/2`) for collision; do not change it, and do not draw
  the grip there or the weapon appears pushed forward by half its length.
- **Anchor point (orbit weapons):** draw at `WeaponEntity.position` (the
  orbiting center) with pivot `(16, 16)`.
- Pivots live on `WeaponDefinition.pivot` (optional, render-only; see
  tasks.md 16.0b). If a pivot is missing, use the default left-middle.
- **Per-weapon pivots** (these override the default):

  | Weapon         | Canvas | Pivot (x, y) | Where                            |
  | -------------- | ------ | ------------ | -------------------------------- |
  | sword          | 32×32  | (7, 16)      | middle of the grip               |
  | hammer         | 32×32  | (5, 16)      | end of the handle                |
  | spear          | 48×12  | (6, 6)       | near the butt of the shaft       |
  | bow            | 32×32  | (19, 16)     | the grip at the middle of the bow |
  | orbiting-blade | 32×32  | (16, 16)     | canvas center (spins in place)   |

### Spritesheet rules

- Multi-state/multi-frame assets are a single **horizontal strip**, frames in
  order, left to right.
- **No padding / no gutter** between frames; frames are flush so the renderer
  slices by `frameIndex × frameWidth`.
- Single-state assets are one PNG with no frames.

## Base Sizes

| Category                 | Pixel grid | Notes                                   |
| ------------------------ | ---------- | --------------------------------------- |
| Arena weapon sprites     | 32×32      | spear is 48×12 (long)                   |
| Projectile               | 8×8        | arrows / blaster shots                  |
| Hit-flash                | 32×32      | 3 shape-distinct variants               |
| Skill icon               | 16×16      | roulette + library slots                |
| Weapon icon              | 16×16      | roulette + library slots (≠ arena art)  |
| Nav / UI icon            | 16×16      | menu + toggles                          |
| Button (9-slice)         | 96×24 strip | 4 frames of 24×24 (9-slice margin 8px) |
| Panel / window (9-slice) | 24×24      | 3×3 grid of 8×8 tiles (margin 8px)      |
| HP bar frame             | 64×12      | empty frame                             |
| HP bar fill              | 1×8        | 1px-wide tileable fill, clipped to %    |
| Checkbox                 | 32×16 strip | 2 frames of 16×16 (unchecked, checked) |
| Toggle                   | 32×16 strip | 2 frames of 16×16 (off, on)            |
| Spin button              | strip      | 2 frames (idle, pressed)                |
| Roulette reel            | tileable   | strip background + highlight            |
| Arena floor tile         | 32×32      | seamless/tileable                       |
| Arena wall border        | 9-slice    | tile 16×16                              |
| Bitmap font              | 8×8 grid   | fixed-width, ASCII 32–126, 16 columns   |

### Icon style distinction (16×16)

Weapon icons and skill icons both appear 16×16 in roulette/library slots. Keep
them visually distinct so users can tell them apart in one row:

- **Weapon icon:** a full object silhouette (just the weapon).
- **Skill icon:** a symbol inside a round badge / circular frame.

### Bitmap font (fixed grid, no external metrics)

- Atlas of **8×8 cells**, ASCII 32–126, laid out in **16 columns**.
- Glyph index from char code: `col = (code - 32) % 16`, `row = ⌊(code - 32) / 16⌋`.
- No JSON/BMFont metrics file — fixed-width grid only.

> NOTE: Balls are NOT sprites. A ball is a circle-clipped fill (solid color /
> pixel pattern / user image) handled by the renderer, so ball skins are fully
> customizable. No ball PNG is needed. (Optional: pixel "pattern" fills listed
> at the end are the only ball-related assets.)

## File Layout

```
public/sprites/
  weapons/   sword.png hammer.png spear.png orbiting-blade.png bow.png
  projectiles/ arrow.png blaster-shot.png
  fx/        hit-contact.png hit-weapon.png hit-projectile.png
  icons/
    skills/  vampire.png spike.png blaster.png splitter.png grower.png
    weapons/ sword.png hammer.png spear.png shuriken.png bow.png  (shuriken.png = the former orbiting-blade.png)
    nav/     home.png versus.png roulette.png library.png recordings.png settings.png
  ui/        button.png panel.png hpbar-frame.png hpbar-fill.png checkbox.png toggle.png winner-banner.png
  roulette/  reel-bg.png spin-button.png landing-glow.png
  arena/     floor-tile.png wall-border.png
  patterns/  stripes.png checker.png dots.png   (optional ball fills)
  font/      pixel-font.png  (fixed 8×8 grid, no metrics file)
```

> Every entry has a procedural fallback drawn in code, so the game runs even
> before any PNG exists. Dropping a PNG at the path above swaps it in with no
> code change.

---

## Hitbox Reference (for aligning weapon sprites)

Weapon sprites must visually cover their logical hitbox (collision truth lives
in the engine, not the sprite). Tune art to these:

| Weapon         | Mode  | Hitbox            | Pivot    | Art guidance                                  |
| -------------- | ----- | ----------------- | -------- | --------------------------------------------- |
| sword          | held  | segment 20×4      | (7, 16)  | blade spans ~20px of the 32px canvas, thin    |
| hammer         | held  | circle r=10       | (5, 16)  | heavy head ~20px diameter near the tip        |
| spear          | held  | segment 40×3      | (6, 6)   | very long thin shaft, fills the 48px length   |
| orbiting-blade | orbit | circle r=6        | (16, 16) | compact blade ~12px, spins around owner       |
| bow            | held  | segment 16×2      | (19, 16) | bow body ~16px; damage comes from its arrow   |

---

## Generation Prompts

Each prompt is written to feed a pixel-art generator or a human artist. Keep the
Global Rules in mind for all of them.

### Weapons (arena, 32×32; spear 48×12), transparent, forward = right

1. **sword.png** — "16-bit pixel-art sword, side view, blade pointing right,
   steel blade with a simple crossguard and a wrapped grip, ~20px blade on a
   32×32 transparent canvas, grip on the left (pivot (7, 16)), hard edges,
   limited palette, no anti-aliasing."
2. **hammer.png** — "16-bit pixel-art war hammer, side view, head pointing
   right, large blocky metal head (~20px) with a short wooden handle on the left
   (pivot (5, 16)), heavy and chunky, 32×32 transparent, hard edges, limited palette."
3. **spear.png** — "16-bit pixel-art spear, horizontal, tip pointing right, very
   long thin wooden shaft with a small steel tip, fills a 48×12 transparent
   canvas, butt on the left (pivot (6, 6)), hard edges, limited palette."
4. **orbiting-blade.png** — "16-bit pixel-art small curved blade / shuriken,
   compact (~12px), designed to spin, centered on 32×32 transparent (pivot (16, 16)), hard
   edges, limited palette."
5. **bow.png** — "16-bit pixel-art short bow, side view, limbs bulge toward the
   right (+x, toward the target), taut string on the left (archer side),
   wooden limbs with a grip at the pivot (19, 16), ~16px tall on 32×32
   transparent, hard edges, limited palette."

### Projectiles (8×8), transparent, forward = right

6. **arrow.png** — "tiny 16-bit pixel arrow pointing right, 8×8 transparent,
   wooden shaft with a steel tip and a hint of fletching, hard edges."
7. **blaster-shot.png** — "tiny 16-bit pixel energy bolt, 8×8 transparent,
   bright core with a short tail pointing right, hard edges."

### Hit-flash FX (32×32), transparent, SHAPE-distinct per source

8. **hit-contact.png** — "16-bit pixel impact burst, soft round starburst /
   radial spark shape (circular motif), 32×32 transparent, hard edges."
9. **hit-weapon.png** — "16-bit pixel slash mark, sharp diagonal slash / X
   shape (linear motif), 32×32 transparent, hard edges."
10. **hit-projectile.png** — "16-bit pixel pierce mark, small concentric
    diamond / crosshair shape (angular motif), 32×32 transparent, hard edges."
    > The three must be distinguishable by SHAPE alone (round vs slash vs
    > diamond), independent of color.

### Skill icons (16×16), transparent

11. **vampire.png** — "16-bit pixel icon, a red droplet with small fangs,
    16×16 transparent, bold readable silhouette."
12. **spike.png** — "16-bit pixel icon, outward-pointing spikes / caltrop,
    16×16 transparent, bold silhouette."
13. **blaster.png** — "16-bit pixel icon, a small cannon muzzle firing a dot,
    16×16 transparent."
14. **splitter.png** — "16-bit pixel icon, one circle splitting into two,
    16×16 transparent."
15. **grower.png** — "16-bit pixel icon, a small circle with up-arrows showing
    growth, 16×16 transparent."

### Weapon icons (16×16), transparent — simplified versions of the arena art

16. **icons/weapons/sword.png** … **bow.png** — "16-bit pixel inventory icon of
    the [weapon], centered, bold readable silhouette, 16×16 transparent." (one
    per weapon: sword, hammer, spear, orbiting-blade, bow)

### Navigation / UI icons (16×16), transparent

17. **nav icons** — home (house), versus (two crossed swords or "VS"), roulette
    (slot/wheel), library (book/shelf), recordings (film reel / play), settings
    (gear). "16-bit pixel UI icon of [concept], bold 1px-outline silhouette,
    16×16 transparent."
18. **checkbox.png / toggle.png** — "16-bit pixel checkbox as a 32×16 strip of
    two 16×16 frames (unchecked, checked), and an on/off slider toggle as a
    32×16 strip of two 16×16 frames (off, on); retro RPG UI, EDG32 palette,
    transparent, no gutter between frames."

### UI chrome (9-slice, tile 8×8 unless noted)

19. **button.png** — "16-bit pixel UI button as a 96×24 horizontal strip of four
    24×24 frames in order: normal, hover, pressed, disabled; beveled retro look,
    EDG32 palette, 8px 9-slice margins that tile cleanly, no gutter between
    frames."
20. **panel.png** — "16-bit pixel RPG window/panel border, 24×24, a 3×3 grid of
    8×8 tiles (8px 9-slice margins), ornate but clean corners, solid or subtly
    textured center, EDG32 palette."
21. **hpbar-frame.png / hpbar-fill.png** — "16-bit pixel HP bar: `hpbar-frame`
    is a 64×12 empty frame; `hpbar-fill` is a 1×8 one-pixel-wide tileable fill
    bar (so it can be stretched/clipped to a fraction inside the frame), EDG32
    palette, retro."
22. **winner-banner.png** — "16-bit pixel victory banner/ribbon suitable to
    overlay the word WINNER (and a DRAW variant), transparent, bold retro."

### Roulette (pixel reel)

23. **reel-bg.png** — "16-bit pixel slot-machine reel background strip, vertical
    or horizontal, tileable, subtle shading, slots sized to hold a 16×16 icon."
24. **spin-button.png** — "16-bit pixel SPIN button as a horizontal strip of two
    equal frames (idle, pressed), chunky arcade/RPG style, EDG32 palette,
    transparent, no gutter between frames."
25. **landing-glow.png** — "16-bit pixel highlight/glow frame to mark the
    selected slot when the reel lands, transparent overlay, bold border."

### Arena

26. **floor-tile.png** — "16-bit pixel arena floor tile, 32×32, seamless/
    tileable, subtle dungeon or stone pattern, limited palette." (no alpha)
27. **wall-border.png** — "16-bit pixel arena wall/border, 9-slice, tiles at
    16×16, reads as a solid boundary." (no alpha on solid parts)

### Font

28. **pixel-font.png** — "monospace 16-bit pixel bitmap font atlas, fixed 8×8
    glyph cells, ASCII 32–126 laid out in 16 columns (so 16 wide × 6 rows of
    cells = 128×48 px), uppercase + lowercase + digits + basic punctuation,
    white glyphs on a fully transparent background, no padding between cells,
    even spacing. No separate metrics file (fixed-width grid)."

### Optional ball fill patterns (16×16 or 32×32, tileable)

29. **stripes.png / checker.png / dots.png** — "16-bit pixel seamless pattern
    (diagonal stripes / checkerboard / polka dots), tileable, two-tone, used as
    a ball fill clipped to a circle." (These are the ONLY ball-related assets;
    solid-color and user-image fills need no asset.)

---

## Delivery / Hand-off Checklist

- [ ] All PNGs transparent (except floor/wall solids), native pixel grid, no
      scaling baked in.
- [ ] Every pixel uses an EDG32 color; backgrounds are true alpha transparency.
- [ ] Multi-frame assets are flush horizontal strips (no gutter) at the stated
      dimensions.
- [ ] Weapon sprites visually cover their hitbox (see Hitbox Reference); verify
      with the in-app `showHitboxes` debug overlay.
- [ ] Hit-flash variants distinguishable by shape alone.
- [ ] Files placed under `public/sprites/...` matching the File Layout so they
      swap in over the procedural fallbacks with no code change.
