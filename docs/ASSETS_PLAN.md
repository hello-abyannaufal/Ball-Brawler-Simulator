# Assets Plan — Ball Battle Simulator (Retro / Pixel-Art)

This document is the single catalog of visual assets for the project: what
exists, how each one is made, and what is still planned. The whole app uses a
retro, pixel-art look.

**Status legend** used below:

- ✅ **PNG** — a file under `public/sprites/`, registered in `assets/sprites/manifest.ts`.
- 🧩 **Code** — drawn in code (canvas or inline SVG); no file needed.
- ⏳ **Planned** — not made yet.

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
  `imageSmoothingEnabled = false`. Prefer integer scales (×2, ×3, ×4); see the
  weapon note below for the one exception.
- **Readability:** each asset must read clearly at 1× (its native pixel grid).
- **Distinction without color:** where variants must be distinguishable
  (status icons, hit FX), differ by SHAPE/PATTERN, not color alone
  (color-blind + reduced motion safe).

### Official Palette — Endesga 32 (EDG32)

Use ONLY these 32 colors across every asset (plus full transparency for
backgrounds). Do not introduce other hues.

```
#be4a2f #d77643 #ead4aa #e4a672 #b86f50 #733e39 #3e2731 #a22633
#e43b44 #f77622 #feae34 #fee761 #63c74d #3e8948 #265c42 #193c3e
#124e89 #0099db #2ce8f5 #ffffff #c0cbdc #8b9bb4 #5a6988 #3a4466
#262b44 #181425 #ff0044 #68386c #b55088 #f6757a #e8b796 #c28569
```

### How PNGs are made

PNGs are generated **in code** with the `pixel-art` skill (Pillow, palette
locked to EDG32, validated, previewed upscaled before hand-off), not with an
image model. Each manifest image entry can have a procedural copy under
`<id>:proc`, used if the PNG fails to load; for the status icons and the scythe
that copy holds the exact same pixel map, so the art can be regenerated from it.

### Weapon sprites: pivot, anchor and scale

- "Forward" always points **right (+x)**.
- Every weapon sprite has a **pivot** `(x, y)` in sprite pixels: the grip, the
  point the sprite rotates around (`WeaponDefinition.pivot`, render-only).
- **Anchor:** the renderer puts the pivot on the ball's surface along the
  weapon's angle (`gripAnchor`: `owner.position + facing × owner.radius`), NOT
  at `WeaponEntity.position`. The engine sets `WeaponEntity.position` to the
  hitbox center for collision; do not draw the grip there or the weapon appears
  pushed forward by half its length.
- **Scale:** `WeaponDefinition.spriteReach` is the sprite pixels from pivot to
  tip; the renderer scales the sprite by `length / spriteReach` so the drawn
  grip→tip span equals the engine's weapon length (what you see is the hitbox).
  This makes weapon scales **non-integer** (≈1.6–2.4×) — the one exception to
  the integer-scale rule.
- Verify every weapon with *Show hitboxes* on `/versus`.

### Spritesheet rules

- Multi-state/multi-frame assets are a single **horizontal strip**, frames in
  order, left to right.
- **No padding / no gutter** between frames; frames are flush so the renderer
  slices by `frameIndex × frameWidth`.
- Single-state assets are one PNG with no frames.

## Asset Inventory

| Asset | Size | Status | Where / notes |
| ----- | ---- | ------ | ------------- |
| Weapon sprites (sword, hammer, spear, bow, scythe, revolver) | 32×32 (spear 48×12) | ✅ PNG | `public/sprites/weapons/`; also used on the roulette wheel, Versus/Library cards (cropped), menu and splash |
| Weapon procedural fallbacks | — | 🧩 Code | `weapon:<id>:proc`; simple shapes for sword, hammer, spear, bow; scythe is an exact pixel copy of its PNG |
| Status icons (poison, slow, stun) | 8×8, drawn 2× | ✅ PNG | `public/sprites/icons/status/`, id `status:<status id>`; in-frame HUD |
| Status icons (freeze, frozen) | 8×8 | ⏳ Planned | with the Freeze status |
| Projectiles (arrow, bullet) | 12×5 / 6×3, drawn 2× | ✅ PNG | `public/sprites/projectiles/`; pivot on the tip, where the hit circle is; exact-copy fallbacks |
| Hit flash (projectile) | 32×32 | 🧩 Code | `fx:hit-projectile`, concentric diamond; only projectile hits flash |
| Blood burst, sparks, clash flash | particles | 🧩 Code | `useVersusDuel.ts`, render-only |
| Shockwave (wall slam gray, parry white) | ring | 🧩 Code | `useVersusDuel.ts`, render-only |
| Weapon trails (riposte gold, reap steel) | — | 🧩 Code | `useVersusDuel.ts`, per behavior id |
| Balls | radius-based | 🧩 Code | pixel ball baked per size + color (2-unit pixels, shade crescent); pattern/image fills ⏳ |
| In-frame HUD (name, HP bar, VS, status row) | 56 units tall | 🧩 Code | `drawHud`; part of recordings |
| Winner / draw card | — | 🧩 Code | `drawWinner` |
| Arena floor and wall | 32-unit tiles | 🧩 Code | two-tone checker floor + 4px ink wall stroke (`clear`) |
| Navigation icons | 8×8 | 🧩 Code | inline SVG paths in `NavigationMenu.vue` |
| Roulette wheel | — | 🧩 Code | `RouletteWheel.vue`, slices carry weapon sprites |
| Trait / Ability icons | 16×16 | ⏳ Planned | after the Trait & Ability design is settled |
| Ball fill patterns | 16×16 or 32×32 | ⏳ Planned | optional, see below |

UI panels and buttons are plain CSS (`.px-panel`, `.px-btn-*` in
`assets/css/tailwind.css`), so they need no image assets.

## File Layout

```
public/sprites/
  weapons/        sword.png hammer.png spear.png bow.png scythe.png   ✅
  projectiles/    arrow.png bullet.png                                ✅
  icons/status/   poison.png slow.png stun.png                        ✅
                  freeze.png frozen.png                               ⏳
  icons/traits/   (Trait / Ability icons)                             ⏳
  patterns/       stripes.png checker.png dots.png                    ⏳ optional
```

Dropping a PNG at a manifest path swaps it in over its procedural fallback with
no other code change.

---

## Hitbox Reference (for aligning weapon sprites)

Collision truth lives in the engine (`engine/weapons/<id>.ts`), not the sprite.
All weapons orbit their ball. Sizes are arena units; the sprite is scaled by
`length / spriteReach` to match.

| Weapon | Length | Hitbox | Pivot | spriteReach | Scale | Art guidance |
| ------ | ------ | ------ | ----- | ----------- | ----- | ------------ |
| sword  | 48 | segment 48 × 10 | (7, 16)  | 25 | 1.92 | blade from the guard to the tip, thin |
| hammer | 42 | circle r16 (head, at the tip) | (5, 16) | 26 | 1.62 | heavy head at the far end |
| spear  | 72 | segment 72 × 8  | (6, 6)   | 42 | 1.71 | very long thin shaft, fills the 48px canvas |
| bow    | 24 | segment 24 × 8  | (19, 16) | 10 | 2.40 | bow body; damage comes from its arrows |
| scythe | 46 | circle r14 (blade, at the tip) | (5, 12) | 25 | 1.84 | curved blade at the tip, curling back over the shaft |
| revolver | 30 | segment 30 × 8 | (8, 14) | 21 | 1.43 | barrel axis through the pivot, so the barrel points where it aims; grip hangs below |

---

## Specs

### Weapons ✅ (32×32; spear 48×12), transparent, forward = right

1. **sword.png** — steel blade with a simple crossguard and a wrapped grip, grip
   on the left (pivot (7, 16)).
2. **hammer.png** — large blocky metal head with a short wooden handle on the
   left (pivot (5, 16)), heavy and chunky.
3. **spear.png** — very long thin wooden shaft with a small steel tip, butt on
   the left (pivot (6, 6)).
4. **bow.png** — short bow, limbs bulge toward the right (+x, toward the
   target), taut string on the left, grip at the pivot (19, 16).
5. **scythe.png** — long wooden shaft with a purple grip wrap, a crescent steel
   blade at the tip curling up and back, bright edge on the inner curve
   (pivot (5, 12)).
6. **revolver.png** — steel barrel pointing right with a fluted cylinder, hammer
   on top, trigger guard below, wooden grip slanting down and back. Pivot (8, 14)
   on the barrel axis; muzzle at x 29. Its procedural fallback is an exact pixel
   copy.

A new weapon needs: its PNG here, a `weapon:<id>` manifest entry (plus
`weapon:<id>:proc` if wanted), and `spriteId`, `pivot`, `spriteReach` on its
definition. A ranged weapon also sets `projectileSprite` (sprite id + pivot on
the projectile's hit circle).

### Projectiles ✅, transparent, forward = right, drawn at 2×

Pivot on the tip (where the engine's hit circle is), set by the firing weapon's
`projectileSprite`. Procedural fallbacks hold the same pixels.

- **arrow.png** (12×5, Bow) — red fletching, wooden shaft, barbed steel head
  (steel, not ink, so the barbs read on the dark floor). Pivot (11.5, 2.5).
- **bullet.png** (6×3, Revolver) — brass casing with a steel tip. Pivot (4.5, 1.5).

### Status icons (8×8), transparent — HUD, drawn at 2×

Shape-distinct, 1px ink outline, full 8×8 (too small for a margin). Drawn on
the HP row of the in-frame HUD, mirrored toward VS, with a stack digit and a
blink over the last half second. Procedural copies (same pixel maps) live in
`assets/sprites/manifest.ts`.

- ✅ **poison.png** — green droplet (`#63c74d`/`#3e8948`), white highlight. DoT.
- ✅ **slow.png** — blue hourglass (`#0099db`/`#124e89`), sand run down. Modifier.
- ✅ **stun.png** — yellow four-point star with cut corners, so it doesn't read
  as a "+" heal (`#fee761`/`#feae34`/`#f77622`). Control.
- ⏳ **freeze.png** — cyan snowflake, shows a stack digit. Modifier (stacking).
- ⏳ **frozen.png** — ice block. Control.

A new status needs a `status:<status id>` manifest entry; without one the HUD
draws the magenta placeholder.

### Trait / Ability icons ⏳ (16×16), transparent

To be designed once Trait & Ability are settled. Keep them distinct from weapon
art in the same row: **a symbol inside a round badge** (weapon art is a bare
silhouette).

### Ball fill patterns ⏳ optional (16×16 or 32×32, tileable)

- **stripes.png / checker.png / dots.png** — seamless two-tone pattern
  (diagonal stripes / checkerboard / polka dots), used as a ball fill clipped to
  a circle. The ball config already allows `{ type: 'pattern' }`; the renderer
  still draws only solid colors.

---

## Delivery / Hand-off Checklist

- [ ] PNG transparent, native pixel grid, no scaling baked in.
- [ ] Every pixel uses an EDG32 color; backgrounds are true alpha transparency.
- [ ] Multi-frame assets are flush horizontal strips (no gutter).
- [ ] Viewed upscaled before hand-off (silhouette, readability at 1×, contrast).
- [ ] Weapon sprites cover their hitbox; verified with *Show hitboxes*.
- [ ] Variants distinguishable by shape alone.
- [ ] File at its manifest path under `public/sprites/`, entry added to
      `assets/sprites/manifest.ts`.
