import { shallowRef, type Ref, type ShallowRef } from 'vue'
import type { DuelConfig } from '~/engine/config'
import type { Ball, Entity, EntityId, Projectile, WeaponEntity } from '~/engine/entities'
import { createEngine, TIMESTEP, type Engine } from '~/engine/engine'
import { activeBehaviorId, landsHeavy, weaponLunge } from '~/engine/weapons/behavior'
import { weaponRegistry } from '~/engine/weapons/registry'
import { useSprites } from '~/composables/useSprites'
import type { SoundEvent } from '~/composables/useAudio'
import { BALL_PIXEL, useBallSprite } from '~/composables/useBallSprite'
import { hpBarFraction, stepsForElapsed } from '~/utils/duel'
import { BALL_DEFAULT_FILL } from '~/utils/pixelBall'
import '~/engine/weapons/index'

export interface HpView {
  id: EntityId
  hp: number
  maxHp: number
}

export interface VersusView {
  hp: ShallowRef<HpView[]>
  winner: ShallowRef<EntityId | null | undefined>
}

export interface VersusDuel {
  view: VersusView
  start(): void
  /** Restart with a new config (fresh seed and start positions). */
  rematch(next: DuelConfig): void
  dispose(): void
}

const EDG = {
  floor: '#262b44',
  floorAlt: '#3a4466',
  wall: '#181425',
  hpBack: '#733e39',
  hpFill: '#63c74d',
  hpFrame: '#181425',
  hitbox: '#fee761',
  text: '#ffffff',
  panel: '#3a4466',
  panelShade: '#262b44',
  hpLow: '#e43b44',
  fog: '#c0cbdc',
  sand: '#ead4aa',
  gold: '#feae34',
  goldShadow: '#733e39',
}

/** In-frame HUD (part of the recording), in arena units. Text uses the page's
 *  pixel font, which is crisp at multiples of 8. */
const FONT = '"Press Start 2P", monospace'
const HUD_H = 56
const HUD_GAP = 8 // between the HUD and the arena when it sits above it
const HUD_VS_W = 28
/** Status icons on the HUD's HP row: 8×8 art drawn at 2×. */
const STATUS_ICON_SCALE = 2
const STATUS_ICON_GAP = 4
/** A status icon blinks over its last half second (sim steps, so a recording
 *  blinks the same way as the live duel). */
const STATUS_BLINK_STEPS = 30
/** Below this HP fraction the HUD bar turns red. */
const HP_LOW = 0.35
/** Winner card background opacity: the arena (e.g. a ball dying mid-arena)
 *  shows through; the text stays opaque. */
const WINNER_CARD_ALPHA = 0.55

/** Hit-stop: real-time seconds the simulation freezes after a damage event.
 *  Render-only (the engine just isn't stepped), so determinism is unaffected. */
const HIT_STOP = 0.08
/** Heavy weapons (those with a wall slam, e.g. Hammer) freeze longer on contact. */
const HEAVY_HIT_STOP = 0.2

/** Shockwave: a ring that widens while its border thins out to nothing.
 *  Render-only, clipped to the arena. Gray from a wall slam's contact point,
 *  smaller and white from a parry (an even clash). */
const SHOCKWAVE_LIFE = 0.45 // seconds
const SHOCKWAVE_WIDTH = 5 // border px at the start
const SLAM_SHOCKWAVE = { radius: 56, color: '#8b9bb4' } // radius: arena px at the end
const PARRY_SHOCKWAVE = { radius: 40, color: '#ffffff' }

/** Blood burst on damage: chunky square pixels, render-only (Math.random is
 *  fine here, it never feeds back into the engine). */
const BLOOD_COLORS = ['#e43b44', '#a22633', '#be4a2f', '#3e2731']
const BLOOD_PER_DAMAGE = 2 // particles per point of damage
const BLOOD_MIN = 6
const BLOOD_MAX = 24
const BLOOD_LIFE = 0.45 // seconds
const BLOOD_DRAG = 6 // velocity decay per second (exponential)

/** Clash sparks: hot, fast, short-lived streaks plus a flash at the contact. */
const SPARK_COLORS = ['#ffffff', '#fee761', '#feae34', '#f77622']
const SPARK_COUNT = { parry: 10, bounce: 14, disarm: 22 } as const
const SPARK_LIFE = 0.25 // seconds
const SPARK_DRAG = 9
const CLASH_FLASH = 0.08 // seconds the contact flash stays visible
const CLASH_HIT_STOP = 0.05
/** Riposte ready: a swing trail behind the blade, swept over its last few step
 *  poses. Colors go newest → oldest. */
const RIPOSTE_TRAIL_STEPS = 6
/** Trail colors per weapon behavior whose burst is running: riposte in gold,
 *  Scythe reap in steel tones. */
const TRAIL_COLORS: Record<string, string[]> = {
  'riposte': ['#ffffff', '#fee761', '#feae34', '#f77622'],
  'reap': ['#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988'],
}
const RIPOSTE_TRAIL_INNER = 0.35 // trail covers the blade from 35% of its length to the tip

/** Blocked projectile: it glances off the blocking weapon, veering toward the
 *  blade's spin, slowing and tumbling, then fades out. Render-only. */
const DEFLECT_LIFE = 0.45 // seconds
const DEFLECT_FADE = 0.4 // last fraction of the life spent fading out
const DEFLECT_SPEED = 0.35 // × the projectile's speed at the block
const DEFLECT_TURN = Math.PI / 5 // veer toward the spin direction (36°)
const DEFLECT_SPIN = 30 // rad/s tumble, in the blade's spin direction
const DEFLECT_DRAG = 5

/** Death: the losing ball freezes and blinks white in slow motion, then
 *  shatters into its own pixels while its weapon tumbles away. Render-only.
 *  Times are real seconds. */
const DEATH_BLINK = 0.45 // blinking, before the shatter
const DEATH_BLINK_PERIOD = 0.15 // one white + one normal phase
const DEATH_SLOWMO = 0.3 // × sim and effect time while it blinks
const SHATTER_LIFE = 0.8
const SHATTER_SPEED = 170 // px/s for a pixel on the rim
const SHATTER_AWAY = 70 // px/s added away from the opponent
const DROPPED_LIFE = 1 // the dead ball's weapon tumbling away
const DROPPED_SPEED = 60
const DROPPED_SPIN = 9 // rad/s
/** The winner card waits for the death to play out. */
const WINNER_CARD_DELAY = 1.3

/** Shot sound per weapon id (default: arrow). */
const SHOT_SOUNDS: Record<string, SoundEvent> = { revolver: 'shootBullet' }
/** Status sounds, played when a status first lands (stacks 1). */
const STATUS_SOUNDS: Record<string, SoundEvent> = { poison: 'poison', slow: 'slow', stun: 'stun' }

/** Per-source hit-flash (Req 16.5, 16.6): a 32×32 pixel sprite at the impact,
 *  shaped differently per source (projectile = cross burst). Weapon hits have
 *  none: their blood burst is the feedback. */
const HIT_FLASH = 0.2 // seconds, within the required 50–500 ms
const HIT_FLASH_SPRITE = { projectile: 'fx:hit-projectile' } as const

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // seconds remaining
  maxLife: number
  size: number // px, square
  color: string
  streak: boolean // draw a short pixel trail behind it (sparks)
}

interface Flash {
  x: number
  y: number
  life: number
}

interface Shockwave {
  x: number
  y: number
  life: number // seconds remaining
  radius: number // arena px at the end
  color: string
}

interface Deflected {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number // rad/s
  life: number // seconds remaining
  spriteId: string
  scale: number
}

/** A dead ball: blinking at its death spot until it shatters. */
interface Dying {
  x: number
  y: number
  sprite: HTMLCanvasElement // the ball as drawn (with race parts), in ball pixels
  away: number // angle away from the opponent
  t: number // real seconds since death
}

interface HitFlash {
  x: number
  y: number
  life: number
  spriteId: string
  scale: number // 2 for critical hits
}

export interface VersusOptions {
  showHitboxes?: boolean
  /** prefers-reduced-motion: no hit-stop and no particle motion; the
   *  simulation rate/outcome is unchanged and hit-flashes still show (Req 16.1, 16.2). */
  reducedMotion?: boolean
  /** Display names, in `ballConfigs` order, for the on-canvas winner label. */
  names?: string[]
  /** Called for every sound to play, as it happens (not batched per frame).
   *  The death sounds follow the death animation; the jingle, the winner card. */
  onSound?: (sound: SoundEvent) => void
}

/**
 * Client-only duel driver + retro renderer (Req 11.5, 11.6, 11.8, 11.10, 11.11).
 * Owns the rAF loop, advances the engine by whole 1/60s steps scaled by sim
 * speed, draws the World once per frame, and surfaces hp/winner via
 * shallowRefs updated at most once per frame (never deep-binding entities).
 */
export function useVersusDuel(
  canvas: Ref<HTMLCanvasElement | null>,
  duel: DuelConfig,
  seed: number,
  speed: number,
  opts?: VersusOptions,
): VersusDuel {
  const reduced = !!opts?.reducedMotion
  const { preloadAll, drawSprite } = useSprites()
  const { ballSprite } = useBallSprite()

  const view: VersusView = {
    hp: shallowRef<HpView[]>([]),
    winner: shallowRef<EntityId | null | undefined>(undefined),
  }

  let engine: Engine | null = null
  let raf = 0
  let lastTime = 0
  let acc = 0
  let hitStop = 0 // seconds of freeze remaining
  let particles: Particle[] = []
  let flashes: Flash[] = []
  let hitFlashes: HitFlash[] = []
  let shockwaves: Shockwave[] = []
  let deflected: Deflected[] = []
  let dying: Dying[] = []
  let endedFor = 0 // real seconds since the duel ended
  let cardShown = false
  let seenShots = new Set<EntityId>() // projectiles already heard firing
  const sound = (s: SoundEvent) => opts?.onSound?.(s)
  const whiteSprites = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
  // Set by a `wallSlam` event; the damage event that follows uses its point.
  let pendingSlam: { ballId: EntityId; x: number; y: number } | null = null
  // Entity state before the latest step, for render interpolation.
  let prev = new Map<EntityId, { x: number; y: number; angle: number }>()
  // Riposte trail: per weapon, its grip anchor + angle before each recent step (oldest first).
  let trails = new Map<EntityId, Array<{ x: number; y: number; angle: number }>>()

  function build(): void {
    engine = createEngine({
      seed,
      config: duel,
      onEvent: (e) => {
        if (e.type === 'wallSlam') {
          pendingSlam = { ballId: e.ballId, x: e.x, y: e.y }
          sound('slam')
          if (!reduced) shockwaves.push({ x: e.x, y: e.y, life: SHOCKWAVE_LIFE, ...SLAM_SHOCKWAVE })
          return
        }
        if (e.type === 'damage' && e.amount > 0) {
          const slam = pendingSlam?.ballId === e.targetId ? pendingSlam : null
          pendingSlam = null
          const sprite = HIT_FLASH_SPRITE[e.source.tag as keyof typeof HIT_FLASH_SPRITE]
          const at = slam ?? impactPoint(e.targetId, e.attackerId)
          const crit = e.style === 'critical'
          if (sprite && at) hitFlashes.push({ ...at, life: HIT_FLASH, spriteId: sprite, scale: crit ? 2 : 1 })
          // Heavy contact (Hammer, Spear thrust) freezes longest; slams and
          // criticals (riposte) land harder than a plain hit.
          const heavy = !slam && e.source.tag === 'weapon' && isHeavyHit(e.attackerId, e.targetId)
          if (!slam) sound(hitSound(e.source.tag, heavy, crit)) // a slam was heard at the wall
          if (reduced) return // decorative motion off; flash above still shows
          hitStop = heavy ? HEAVY_HIT_STOP : slam || crit ? HIT_STOP * 1.5 : HIT_STOP
          spawnBlood(e.targetId, e.attackerId, crit ? e.amount * 2 : e.amount, slam ?? undefined)
        } else if (e.type === 'ballDied') {
          sound('death')
          if (!reduced) startDeath(e.ballId)
        } else if (e.type === 'statusApplied') {
          const s = STATUS_SOUNDS[e.statusId]
          if (s && e.stacks === 1) sound(s)
        } else if (e.type === 'projectileBlocked' || e.type === 'projectilesCollided') {
          sound('deflect')
          if (reduced) return
          spawnSparksAt(e.x, e.y, SPARK_COUNT.parry)
          if (e.type === 'projectileBlocked') spawnDeflected(e.projectileId, e.weaponId, e.x, e.y)
        } else if (e.type === 'projectileReflected') {
          sound('reflect')
          if (reduced) return
          hitStop = Math.max(hitStop, CLASH_HIT_STOP)
          spawnSparksAt(e.x, e.y, SPARK_COUNT.disarm)
        } else if (e.type === 'weaponClash') {
          sound(e.outcome)
          if (reduced) return
          hitStop = Math.max(hitStop, CLASH_HIT_STOP)
          const at = clashPoint(e.a, e.b)
          if (!at) return
          spawnSparksAt(at.x, at.y, SPARK_COUNT[e.outcome])
          if (e.outcome === 'parry') shockwaves.push({ ...at, life: SHOCKWAVE_LIFE, ...PARRY_SHOCKWAVE })
        }
      },
    })
    view.winner.value = undefined
    syncHp()
  }

  function hitSound(tag: string, heavy: boolean, crit: boolean): SoundEvent {
    if (tag === 'dot') return 'hitDot'
    if (tag === 'projectile' || tag === 'reflect') return 'hitProjectile'
    return crit ? 'hitCrit' : heavy ? 'hitHeavy' : 'hit'
  }

  /** A shot sound for each projectile that appeared since the last check. */
  function detectShots(): void {
    const now = new Set<EntityId>()
    for (const e of engine!.world.entities) {
      if (e.kind !== 'projectile' || !e.alive) continue
      now.add(e.id)
      if (!seenShots.has(e.id)) sound(SHOT_SOUNDS[e.weaponId] ?? 'shootArrow')
    }
    seenShots = now
  }

  /** Does the attacker's weapon land this hit heavy (Hammer, Spear thrust)?
   *  Asked while the hit is applied, so the pose is the one that hit. */
  function isHeavyHit(attackerId: EntityId | '', targetId: EntityId): boolean {
    const target = engine?.world.ballById(targetId)
    return !!target && !!engine?.world.entities.some(
      (w) => w.kind === 'weapon' && w.alive && w.ownerId === attackerId && landsHeavy(w, target),
    )
  }

  function syncHp(): void {
    if (!engine) return
    const balls = engine.world.entities.filter(
      (e): e is Ball => e.kind === 'ball',
    )
    // Only publish when something changed, so Vue doesn't re-render every frame.
    const cur = view.hp.value
    if (
      cur.length === balls.length &&
      balls.every((b, i) => cur[i]!.id === b.id && cur[i]!.hp === b.hp && cur[i]!.maxHp === b.maxHp)
    ) return
    view.hp.value = balls.map((b) => ({ id: b.id, hp: b.hp, maxHp: b.maxHp }))
  }

  /**
   * Spray blood from the struck ball's edge facing the attacker, flying away
   * from the attacker in a ~110° cone. Falls back to a full ring when there is
   * no attacker (e.g. reflected/environment damage).
   */
  /** Target's surface point facing the attacker (its center if no attacker). */
  function impactPoint(targetId: EntityId, attackerId: EntityId | ''): { x: number; y: number } | null {
    const target = engine?.world.ballById(targetId)
    if (!target) return null
    const attacker = attackerId === '' ? undefined : engine!.world.ballById(attackerId)
    if (!attacker) return { x: target.position.x, y: target.position.y }
    const dir = Math.atan2(target.position.y - attacker.position.y, target.position.x - attacker.position.x)
    return {
      x: target.position.x - Math.cos(dir) * target.radius,
      y: target.position.y - Math.sin(dir) * target.radius,
    }
  }

  /** `from`: a wall-slam contact point — blood then sprays off the wall. */
  function spawnBlood(
    targetId: EntityId,
    attackerId: EntityId | '',
    amount: number,
    from?: { x: number; y: number },
  ): void {
    const target = engine?.world.ballById(targetId)
    if (!target) return
    const attacker = attackerId === '' ? undefined : engine!.world.ballById(attackerId)
    let dir = 0
    let spread = Math.PI * 2
    let ix = target.position.x
    let iy = target.position.y
    if (from) {
      // Spray back from the wall, through the ball.
      dir = Math.atan2(target.position.y - from.y, target.position.x - from.x)
      spread = Math.PI * 0.8
      ix = from.x
      iy = from.y
    } else if (attacker) {
      dir = Math.atan2(target.position.y - attacker.position.y, target.position.x - attacker.position.x)
      spread = Math.PI * 0.6
      // Impact point: target surface on the attacker's side.
      ix = target.position.x - Math.cos(dir) * target.radius
      iy = target.position.y - Math.sin(dir) * target.radius
    }
    const count = Math.min(BLOOD_MAX, Math.max(BLOOD_MIN, Math.round(amount * BLOOD_PER_DAMAGE)))
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread
      const speed = 60 + Math.random() * 140
      const life = BLOOD_LIFE * (0.6 + Math.random() * 0.4)
      particles.push({
        x: ix,
        y: iy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: Math.random() < 0.3 ? 4 : 2,
        color: BLOOD_COLORS[Math.floor(Math.random() * BLOOD_COLORS.length)]!,
        streak: false,
      })
    }
  }

  /** Point on weapon `w`'s hitbox closest to (px, py): its blade axis, or its circle center. */
  function closestOnWeapon(w: WeaponEntity, px: number, py: number): { x: number; y: number } {
    if (w.hitbox.shape === 'circle') return { x: w.position.x, y: w.position.y }
    const ux = Math.cos(w.angle)
    const uy = Math.sin(w.angle)
    const half = w.hitbox.length / 2
    const t = Math.max(-half, Math.min(half, (px - w.position.x) * ux + (py - w.position.y) * uy))
    return { x: w.position.x + ux * t, y: w.position.y + uy * t }
  }

  /** Radial burst of sparks + a white flash where the two weapons meet. */
  /** Where two clashing weapons touch: the midpoint of each blade's point
   *  closest to the other. Undefined if either is gone. */
  function clashPoint(aId: EntityId, bId: EntityId): { x: number; y: number } | undefined {
    const ents = engine?.world.entities
    const a = ents?.find((e): e is WeaponEntity => e.id === aId && e.kind === 'weapon')
    const b = ents?.find((e): e is WeaponEntity => e.id === bId && e.kind === 'weapon')
    if (!a || !b) return undefined
    const pa = closestOnWeapon(a, b.position.x, b.position.y)
    const pb = closestOnWeapon(b, pa.x, pa.y)
    return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
  }

  /** Radial spark burst + white flash at a point (clashes, swatted arrows). */
  function spawnSparksAt(cx: number, cy: number, count: number): void {
    flashes.push({ x: cx, y: cy, life: CLASH_FLASH })
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const speed = 150 + Math.random() * 250
      const life = SPARK_LIFE * (0.5 + Math.random() * 0.5)
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life,
        maxLife: life,
        size: 2,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]!,
        streak: true,
      })
    }
  }

  /** The blocked projectile glances off: slower, turned toward the blocker's
   *  spin, tumbling the same way. */
  function spawnDeflected(projectileId: EntityId, weaponId: EntityId, x: number, y: number): void {
    const p = engine?.world.entities.find((e): e is Projectile => e.id === projectileId && e.kind === 'projectile')
    const w = engine?.world.entities.find((e): e is WeaponEntity => e.id === weaponId && e.kind === 'weapon')
    const spriteId = p && weaponRegistry.get(p.weaponId)?.projectileSprite?.id
    if (!p || !w || !spriteId) return
    const dir = Math.sign(w.angularSpeed) || 1
    const heading = Math.atan2(p.velocity.y, p.velocity.x)
    const turned = heading + dir * DEFLECT_TURN
    const speed = Math.hypot(p.velocity.x, p.velocity.y) * DEFLECT_SPEED
    deflected.push({
      x,
      y,
      vx: Math.cos(turned) * speed,
      vy: Math.sin(turned) * speed,
      angle: heading,
      spin: dir * DEFLECT_SPIN,
      life: DEFLECT_LIFE,
      spriteId,
      scale: 2,
    })
  }

  /** The dead ball freezes where it died; its weapons fall off and tumble away. */
  function startDeath(ballId: EntityId): void {
    const b = engine?.world.ballById(ballId)
    if (!b) return
    const foe = engine!.world.entities.find((e): e is Ball => e.kind === 'ball' && e.alive && e.id !== ballId)
    const away = foe
      ? Math.atan2(b.position.y - foe.position.y, b.position.x - foe.position.x)
      : Math.random() * Math.PI * 2
    dying.push({ x: b.position.x, y: b.position.y, sprite: ballCanvas(b), away, t: 0 })
    for (const w of engine!.world.entities) {
      if (w.kind !== 'weapon' || w.ownerId !== ballId || !w.def.spriteId) continue
      const a = away + (Math.random() - 0.5) * Math.PI * 0.8
      const dir = Math.sign(w.angularSpeed) || 1
      deflected.push({
        x: w.position.x,
        y: w.position.y,
        vx: Math.cos(a) * DROPPED_SPEED,
        vy: Math.sin(a) * DROPPED_SPEED,
        angle: w.angle,
        spin: dir * DROPPED_SPIN,
        life: DROPPED_LIFE,
        spriteId: w.def.spriteId,
        scale: w.def.spriteReach ? w.def.length / w.def.spriteReach : 2,
      })
    }
  }

  /** Advance dead balls; one that has blinked long enough shatters. */
  function updateDying(dt: number): void {
    for (const d of dying) {
      d.t += dt
      if (d.t >= DEATH_BLINK) shatter(d)
    }
    dying = dying.filter((d) => d.t < DEATH_BLINK)
  }

  /** Every pixel of the ball becomes a chunk flying out from its center,
   *  faster at the rim, pushed away from the opponent. */
  function shatter(d: Dying): void {
    sound('shatter')
    const { width: w, height: h } = d.sprite
    const data = d.sprite.getContext('2d')!.getImageData(0, 0, w, h).data
    const half = (w * BALL_PIXEL) / 2
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4
        if (data[i + 3] === 0) continue
        const ox = (px + 0.5) * BALL_PIXEL - half
        const oy = (py + 0.5) * BALL_PIXEL - half
        const out = Math.atan2(oy, ox)
        const speed = SHATTER_SPEED * (0.3 + Math.min(1, Math.hypot(ox, oy) / half)) * (0.6 + Math.random() * 0.6)
        const life = SHATTER_LIFE * (0.6 + Math.random() * 0.4)
        particles.push({
          x: d.x + ox,
          y: d.y + oy,
          vx: Math.cos(out) * speed + Math.cos(d.away) * SHATTER_AWAY,
          vy: Math.sin(out) * speed + Math.sin(d.away) * SHATTER_AWAY,
          life,
          maxLife: life,
          size: BALL_PIXEL,
          color: `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`,
          streak: false,
        })
      }
    }
  }

  /** The dead ball at its death spot, white on every other blink phase. */
  function drawDying(ctx: CanvasRenderingContext2D): void {
    for (const d of dying) {
      const white = Math.floor(d.t / (DEATH_BLINK_PERIOD / 2)) % 2 === 0
      drawBallCanvas(ctx, white ? whiteSprite(d.sprite) : d.sprite, d.x, d.y)
    }
  }

  /** A solid white silhouette of a ball sprite, cached per sprite. */
  function whiteSprite(src: HTMLCanvasElement): HTMLCanvasElement {
    const cached = whiteSprites.get(src)
    if (cached) return cached
    const c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const g = c.getContext('2d')!
    g.drawImage(src, 0, 0)
    g.globalCompositeOperation = 'source-in' // keep alpha, replace color
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, c.width, c.height)
    whiteSprites.set(src, c)
    return c
  }

  function updateParticles(dt: number): void {
    const kBlood = Math.exp(-BLOOD_DRAG * dt)
    const kSpark = Math.exp(-SPARK_DRAG * dt)
    for (const p of particles) {
      const k = p.streak ? kSpark : kBlood
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= k
      p.vy *= k
      p.life -= dt
    }
    particles = particles.filter((p) => p.life > 0)
    for (const f of flashes) f.life -= dt
    flashes = flashes.filter((f) => f.life > 0)
    const kDeflect = Math.exp(-DEFLECT_DRAG * dt)
    for (const d of deflected) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vx *= kDeflect
      d.vy *= kDeflect
      d.angle += d.spin * dt
      d.life -= dt
    }
    deflected = deflected.filter((d) => d.life > 0)
  }

  /** Tumbling around the sprite's center; fades out at the end of its life. */
  function drawDeflected(ctx: CanvasRenderingContext2D): void {
    for (const d of deflected) {
      ctx.globalAlpha = Math.min(1, d.life / (DEFLECT_LIFE * DEFLECT_FADE))
      drawSprite(ctx, d.spriteId, d.x, d.y, d.scale, d.angle)
    }
    ctx.globalAlpha = 1
  }

  function updateHitFlashes(dt: number): void {
    for (const f of hitFlashes) f.life -= dt
    hitFlashes = hitFlashes.filter((f) => f.life > 0)
    for (const w of shockwaves) w.life -= dt
    shockwaves = shockwaves.filter((w) => w.life > 0)
  }

  /** Pixel ring per shockwave: radius grows, border thins to 0, clipped to the arena. */
  function drawShockwaves(ctx: CanvasRenderingContext2D): void {
    if (shockwaves.length === 0) return
    const { width, height } = duel.arenaConfig
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()
    for (const w of shockwaves) {
      ctx.fillStyle = w.color
      const t = 1 - w.life / SHOCKWAVE_LIFE // 0 → 1
      const outer = 4 + (w.radius - 4) * Math.sqrt(t) // fast start, eases out
      const thick = SHOCKWAVE_WIDTH * (1 - t)
      if (thick < 0.5) continue
      const inner = outer - thick
      const cx = Math.round(w.x)
      const cy = Math.round(w.y)
      const r = Math.ceil(outer)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.hypot(dx + 0.5, dy + 0.5)
          if (d <= outer && d >= inner) ctx.fillRect(cx + dx, cy + dy, 1, 1)
        }
      }
    }
    ctx.restore()
  }

  function drawHitFlashes(ctx: CanvasRenderingContext2D): void {
    for (const f of hitFlashes) drawSprite(ctx, f.spriteId, Math.round(f.x), Math.round(f.y), f.scale)
  }

  function drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of particles) {
      // Shrink to 2px in the last third of life; snap to whole pixels.
      const size = p.life < p.maxLife / 3 ? Math.min(p.size, 2) : p.size
      ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size)
      if (p.streak) {
        // Pixel trail: two dimmer dots stepping back along the velocity.
        ctx.globalAlpha = 0.6
        for (const back of [0.012, 0.024]) {
          ctx.fillRect(Math.round(p.x - p.vx * back - 1), Math.round(p.y - p.vy * back - 1), 2, 2)
          ctx.globalAlpha = 0.3
        }
        ctx.globalAlpha = 1
      }
    }
    // Contact flash: a pixel "+" star that shrinks as it fades.
    ctx.fillStyle = '#ffffff'
    for (const f of flashes) {
      const arm = Math.round(2 + 6 * (f.life / CLASH_FLASH))
      const x = Math.round(f.x)
      const y = Math.round(f.y)
      ctx.fillRect(x - arm, y - 1, arm * 2, 2)
      ctx.fillRect(x - 1, y - arm, 2, arm * 2)
      ctx.fillRect(x - 2, y - 2, 4, 4)
    }
  }

  function snapshot(): void {
    prev = new Map()
    for (const e of engine!.world.entities) {
      prev.set(e.id, {
        x: e.position.x,
        y: e.position.y,
        angle: e.kind === 'weapon' ? e.angle : 0,
      })
      if (e.kind !== 'weapon') continue
      if (!activeBehaviorId(e) || !e.alive) {
        trails.delete(e.id)
        continue
      }
      const trail = trails.get(e.id) ?? []
      trail.push({ ...gripAnchor(e), angle: e.angle })
      if (trail.length > RIPOSTE_TRAIL_STEPS) trail.shift()
      trails.set(e.id, trail)
    }
  }

  /**
   * Render between the previous and current step (alpha in [0, 1]) so motion
   * is smooth on displays faster than the 60Hz sim. Entities are temporarily
   * moved to the blended pose and restored right after drawing; the engine
   * never steps in between, so its state and determinism are untouched.
   */
  function renderInterpolated(alpha: number): void {
    const saved: Array<{ e: Entity; x: number; y: number; angle: number }> = []
    for (const e of engine!.world.entities) {
      const p = prev.get(e.id)
      if (!p) continue // spawned this step: draw at its current pose
      saved.push({ e, x: e.position.x, y: e.position.y, angle: e.kind === 'weapon' ? e.angle : 0 })
      e.position.x = p.x + (e.position.x - p.x) * alpha
      e.position.y = p.y + (e.position.y - p.y) * alpha
      if (e.kind === 'weapon') e.angle = p.angle + (e.angle - p.angle) * alpha
    }
    render()
    for (const s of saved) {
      s.e.position.x = s.x
      s.e.position.y = s.y
      if (s.e.kind === 'weapon') s.e.angle = s.angle
    }
  }

  // --- rendering ---
  function clear(ctx: CanvasRenderingContext2D): void {
    const { width, height } = duel.arenaConfig
    // tiled floor
    const tile = 32
    for (let y = 0; y < height; y += tile) {
      for (let x = 0; x < width; x += tile) {
        const alt = ((x / tile + y / tile) & 1) === 0
        ctx.fillStyle = alt ? EDG.floor : EDG.floorAlt
        // Edge tiles are trimmed: the arena needn't be a multiple of the tile size.
        ctx.fillRect(x, y, Math.min(tile, width - x), Math.min(tile, height - y))
      }
    }
    // wall border
    ctx.strokeStyle = EDG.wall
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, width, height)
  }

  /** The fighter picker's pixel-art ball with its race's parts, drawn at the
   *  weapon sprites' pixel size so ball and weapon match. */
  function drawBall(ctx: CanvasRenderingContext2D, b: Ball): void {
    drawBallCanvas(ctx, ballCanvas(b), b.position.x, b.position.y)
  }

  function ballCanvas(b: Ball): HTMLCanvasElement {
    const config = findConfig(b.id)
    const app = config?.appearance
    const fill = app?.type === 'color' ? app.value : BALL_DEFAULT_FILL // pattern/image handled later
    const cells = Math.max(4, Math.round((b.radius * 2) / BALL_PIXEL))
    return ballSprite(cells, fill, config?.raceId).canvas
  }

  /** A baked ball sprite centered on (x, y), at the ball pixel size. */
  function drawBallCanvas(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number): void {
    const size = sprite.width * BALL_PIXEL
    ctx.drawImage(sprite, Math.round(x - size / 2), Math.round(y - size / 2), size, size)
  }

  function findConfig(id: EntityId) {
    const idx = engine!.world.entities
      .filter((e) => e.kind === 'ball')
      .findIndex((e) => e.id === id)
    return duel.ballConfigs[idx]
  }

  function drawWeapon(ctx: CanvasRenderingContext2D, w: WeaponEntity): void {
    const spriteId = w.def.spriteId
    if (!spriteId) return
    const anchor = gripAnchor(w)
    // Scale so the drawn grip→tip span equals the engine's weapon length:
    // what you see is exactly the hitbox.
    const scale = w.def.spriteReach ? w.def.length / w.def.spriteReach : 2
    const burst = activeBehaviorId(w)
    const trail = burst && TRAIL_COLORS[burst]
    if (trail) drawRiposteTrail(ctx, w, anchor, trail)
    // Spear thrust: drawn pushed out along its axis, away from the owner.
    const lunge = weaponLunge(w)
    const x = anchor.x + Math.cos(w.angle) * lunge
    const y = anchor.y + Math.sin(w.angle) * lunge
    drawSprite(ctx, spriteId, x, y, scale, w.angle, w.def.pivot)
  }

  /** Anchor the grip at the ball surface along the weapon angle, so the
   *  weapon hugs the ball and the blade sweeps outward as it orbits
   *  (visually "held but rotating"). */
  function gripAnchor(w: WeaponEntity): { x: number; y: number } {
    const owner = engine!.world.ballById(w.ownerId)
    if (!owner) return { x: w.position.x, y: w.position.y }
    return {
      x: owner.position.x + Math.cos(w.angle) * owner.radius,
      y: owner.position.y + Math.sin(w.angle) * owner.radius,
    }
  }

  /**
   * Riposte ready: a fast-swing trail. Sweeps 2px pixels over the outer part
   * of the blade between its current pose and its poses before the last few
   * steps, fading and cooling (white → orange) with age. Render-only.
   */
  function drawRiposteTrail(
    ctx: CanvasRenderingContext2D,
    w: WeaponEntity,
    head: { x: number; y: number },
    colors: readonly string[],
  ): void {
    const history = trails.get(w.id)
    if (!history?.length) return
    const poses = [{ ...head, angle: w.angle }, ...[...history].reverse()] // newest first
    const len = w.def.length
    const dTheta = 2 / len // ≈ 2px apart at the tip
    ctx.save()
    for (let i = 0; i < poses.length - 1; i++) {
      const a = poses[i]!
      const b = poses[i + 1]!
      // Shortest way round, so a wrap at ±π doesn't sweep the whole circle.
      const span = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle))
      const n = Math.max(1, Math.ceil(Math.abs(span) / dTheta))
      ctx.fillStyle = colors[Math.min(i, colors.length - 1)]!
      for (let s = 0; s < n; s++) {
        const t = s / n
        const age = (i + t) / (poses.length - 1) // 0 = newest, 1 = oldest
        ctx.globalAlpha = 0.7 * (1 - age)
        const ang = a.angle + span * t
        const ox = a.x + (b.x - a.x) * t
        const oy = a.y + (b.y - a.y) * t
        const ux = Math.cos(ang)
        const uy = Math.sin(ang)
        // Thinner toward the old end: the inner edge creeps out to the tip.
        const inner = len * (RIPOSTE_TRAIL_INNER + (1 - RIPOSTE_TRAIL_INNER) * age * 0.6)
        for (let r = inner; r <= len; r += 2) {
          ctx.fillRect(Math.round(ox + ux * r - 1), Math.round(oy + uy * r - 1), 2, 2)
        }
      }
    }
    ctx.restore()
  }

  function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    // The firing weapon's projectile sprite, pointing along the flight; its
    // pivot sits on the engine's hit circle, so what you see is what hits.
    const sprite = weaponRegistry.get(p.weaponId)?.projectileSprite
    if (!sprite) return
    const angle = Math.atan2(p.velocity.y, p.velocity.x)
    drawSprite(ctx, sprite.id, p.position.x, p.position.y, 2, angle, sprite.pivot)
  }

  function drawHpBars(ctx: CanvasRenderingContext2D): void {
    // Only living balls: a dead ball's bar vanishes with its body and weapon.
    const balls = engine!.world.entities.filter(
      (e): e is Ball => e.kind === 'ball' && e.alive,
    )
    const barW = 48
    const barH = 6
    balls.forEach((b) => {
      const x = b.position.x - barW / 2
      const y = b.position.y - b.radius - 12
      ctx.fillStyle = EDG.hpFrame
      ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2)
      ctx.fillStyle = EDG.hpBack
      ctx.fillRect(x, y, barW, barH)
      ctx.fillStyle = EDG.hpFill
      ctx.fillRect(x, y, barW * hpBarFraction(b.hp, b.maxHp), barH)
    })
  }

  function drawHitboxes(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.strokeStyle = EDG.hitbox
    ctx.lineWidth = 1
    for (const e of engine!.world.entities) {
      if (e.kind !== 'weapon' || !e.alive) continue
      ctx.save()
      ctx.translate(e.position.x, e.position.y)
      ctx.rotate(e.angle)
      if (e.hitbox.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, e.hitbox.radius, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.strokeRect(-e.hitbox.length / 2, -e.hitbox.thickness / 2, e.hitbox.length, e.hitbox.thickness)
      }
      ctx.restore()
    }
    ctx.restore()
  }

  /** Name of the winning ball: initial balls are created in `ballConfigs` order. */
  function winnerLabel(id: EntityId): string {
    const idx = engine!.world.entities.filter((e) => e.kind === 'ball').findIndex((b) => b.id === id)
    return (opts?.names?.[idx] ?? `BALL ${id}`).toUpperCase()
  }

  function render(): void {
    const el = canvas.value
    if (!el || !engine) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false

    // The canvas is the output resolution (Settings / recording, Req 15.8):
    // letterbox it, then fit the arena centered at the largest whole-number
    // scale (fractional only if the canvas is smaller than the arena).
    const { width: aw, height: ah } = duel.arenaConfig
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = EDG.wall
    ctx.fillRect(0, 0, el.width, el.height)
    const fit = Math.min(el.width / aw, el.height / ah)
    const scale = fit >= 1 ? Math.floor(fit) : fit
    ctx.setTransform(scale, 0, 0, scale, Math.round((el.width - aw * scale) / 2), Math.round((el.height - ah * scale) / 2))

    clear(ctx)
    for (const e of engine.world.entities) {
      if (e.kind === 'ball' && e.alive) drawBall(ctx, e)
    }
    drawDying(ctx)
    for (const e of engine.world.entities) {
      if (e.kind === 'weapon' && e.alive) drawWeapon(ctx, e)
      else if (e.kind === 'projectile' && e.alive) drawProjectile(ctx, e)
    }
    drawShockwaves(ctx)
    drawDeflected(ctx)
    drawParticles(ctx)
    drawHitFlashes(ctx)
    drawHpBars(ctx)
    if (opts?.showHitboxes) drawHitboxes(ctx)

    if (engine.ended && endedFor >= winnerCardDelay()) drawWinner(ctx)
    // Above the arena when the letterbox has room (9:16, 4:5), else over its top.
    const above = (el.height - ah * scale) / 2 / scale >= HUD_H + HUD_GAP
    drawHud(ctx, above ? -HUD_H - HUD_GAP : HUD_GAP)
  }

  function drawLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = 'left',
    shadow?: string,
  ): void {
    ctx.font = `${size}px ${FONT}`
    ctx.textAlign = align
    ctx.textBaseline = 'top'
    if (shadow) {
      ctx.fillStyle = shadow
      ctx.fillText(text, x + size / 8, y + size / 8)
    }
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
  }

  /** Cut a label to `max` characters (the pixel font is monospace). */
  function fit(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}.`
  }

  /** Name, HP bar and HP count of both fighters, VS in between. */
  function drawHud(ctx: CanvasRenderingContext2D, y: number): void {
    const { width } = duel.arenaConfig
    const balls = engine!.world.entities.filter((e): e is Ball => e.kind === 'ball')
    const panelW = (width - HUD_VS_W) / 2
    ctx.save()
    balls.slice(0, 2).forEach((b, i) => {
      const x = i === 0 ? 0 : width - panelW
      // Panel: slate body, ink frame, darker bottom edge (like .px-panel).
      ctx.fillStyle = EDG.wall
      ctx.fillRect(x, y, panelW, HUD_H)
      ctx.fillStyle = EDG.panel
      ctx.fillRect(x + 2, y + 2, panelW - 4, HUD_H - 4)
      ctx.fillStyle = EDG.panelShade
      ctx.fillRect(x + 2, y + HUD_H - 4, panelW - 4, 2)

      const pad = 6
      const right = i === 1
      const tx = right ? x + panelW - pad : x + pad
      const align = right ? 'right' : 'left'
      const name = (opts?.names?.[i] ?? `Ball ${b.id}`).toUpperCase()
      drawLabel(ctx, fit(name, Math.floor((panelW - pad * 2) / 8)), tx, y + pad, 8, EDG.text, align)

      const barW = panelW - pad * 2
      const barY = y + 18
      ctx.fillStyle = EDG.wall
      ctx.fillRect(x + pad, barY, barW, 8)
      const f = b.alive ? hpBarFraction(b.hp, b.maxHp) : 0
      const fillW = Math.round((barW - 4) * f)
      ctx.fillStyle = f < HP_LOW ? EDG.hpLow : EDG.hpFill
      // The right fighter's bar drains toward the middle, mirroring the left.
      ctx.fillRect(right ? x + pad + 2 + (barW - 4 - fillW) : x + pad + 2, barY + 2, fillW, 4)

      const hpText = `${Math.max(0, Math.ceil(b.alive ? b.hp : 0))}/${b.maxHp}`
      drawLabel(ctx, hpText, tx, y + 34, 8, EDG.fog, align)
      // Status icons on the HP row, packed toward the VS side (mirrored).
      if (b.alive) drawStatusIcons(ctx, b, right ? x + pad : x + panelW - pad, y + 30, right)
    })
    drawLabel(ctx, 'VS', width / 2, y + HUD_H / 2 - 4, 8, EDG.hpLow, 'center', EDG.wall)
    ctx.restore()
  }

  /** A ball's status icons, running from `edgeX` away from it: leftward for
   *  the left panel, rightward for the right one. Stacks show as a digit. */
  function drawStatusIcons(ctx: CanvasRenderingContext2D, b: Ball, edgeX: number, top: number, rightward: boolean): void {
    const size = 8 * STATUS_ICON_SCALE
    b.statusEffects.forEach((s, i) => {
      if (!reduced && s.remaining <= STATUS_BLINK_STEPS && Math.floor(s.remaining / 4) % 2 === 1) return
      const offset = i * (size + STATUS_ICON_GAP)
      const left = rightward ? edgeX + offset : edgeX - offset - size
      drawSprite(ctx, `status:${s.defId}`, left + size / 2, top + size / 2, STATUS_ICON_SCALE)
      if (s.stacks > 1) drawLabel(ctx, String(s.stacks), left + size + 3, top + size - 6, 8, EDG.text, 'right', EDG.wall)
    })
  }

  /** Result card in the middle of the arena. */
  function drawWinner(ctx: CanvasRenderingContext2D): void {
    const { width, height } = duel.arenaConfig
    const draw = engine!.winner === null
    const name = draw ? 'DRAW' : winnerLabel(engine!.winner!)
    // Big type when the name fits the card, else the small size.
    const cardW = width - 48
    const size = name.length * 16 <= cardW - 24 ? 16 : 8
    const cardH = draw ? 52 : 72
    const cx = width / 2
    const top = Math.round((height - cardH) / 2)
    ctx.save()
    ctx.globalAlpha = WINNER_CARD_ALPHA
    ctx.fillStyle = EDG.gold
    ctx.fillRect(24, top - 4, cardW, 4)
    ctx.fillRect(24, top + cardH, cardW, 4)
    ctx.fillStyle = EDG.wall
    ctx.fillRect(24, top, cardW, cardH)
    ctx.globalAlpha = 1
    if (draw) {
      drawLabel(ctx, 'DRAW', cx, top + (cardH - size) / 2, size, EDG.gold, 'center', EDG.goldShadow)
    } else {
      drawLabel(ctx, 'WINNER:', cx, top + 16, 8, EDG.sand, 'center')
      drawLabel(ctx, fit(name, Math.floor((cardW - 24) / 8)), cx, top + 36, size, EDG.gold, 'center', EDG.goldShadow)
    }
    ctx.restore()
  }

  /** The card waits for the death animation, which reduced motion skips. */
  function winnerCardDelay(): number {
    return reduced ? 0 : WINNER_CARD_DELAY
  }

  // --- loop ---
  function frame(now: number): void {
    if (!engine) return
    if (lastTime === 0) lastTime = now
    const dt = (now - lastTime) / 1000
    lastTime = now

    updateHitFlashes(dt) // real time, so the flash lasts HIT_FLASH even in a hit-stop
    // A dying ball slows the whole scene (sim and effects) while it blinks.
    const timeScale = dying.length > 0 ? DEATH_SLOWMO : 1
    updateDying(dt)
    if (engine.ended) endedFor += dt
    if (engine.ended && !cardShown && endedFor >= winnerCardDelay()) {
      cardShown = true
      sound(engine.winner === null ? 'draw' : 'win')
    }
    if (hitStop > 0) {
      // Frozen on a hit: burn real time without advancing the simulation.
      hitStop -= dt
    } else {
      // Whole 1/60 s steps owed for elapsed real time × sim speed (Req 15.7).
      acc += dt * timeScale
      let steps = stepsForElapsed(acc, speed)
      acc -= (steps * TIMESTEP) / speed
      // Clamp to avoid a spiral of death on tab resume (scaled for fast speeds).
      const MAX = Math.max(10, Math.ceil(speed * 4))
      if (steps > MAX) {
        steps = MAX
        acc = 0
      }
      // Stop stepping as soon as a hit lands so the freeze shows the impact frame.
      for (let i = 0; i < steps && hitStop <= 0; i++) {
        snapshot()
        engine.step()
        detectShots()
      }
      if (hitStop > 0) acc = 0
      // Particles freeze with the hit-stop, then burst out when it ends.
      updateParticles(dt * timeScale)
    }

    syncHp()
    view.winner.value = engine.winner
    // Frozen (hit-stop): show the exact step pose, no blending.
    const alpha = hitStop > 0 ? 1 : Math.min(1, (acc * speed) / TIMESTEP)
    renderInterpolated(alpha)

    raf = requestAnimationFrame(frame)
  }

  function start(): void {
    if (!engine) build()
    // The HUD uses the page's web font; wait for it so the first frames don't
    // fall back to the system monospace.
    const font = document.fonts?.load(`8px ${FONT}`).catch(() => undefined)
    Promise.all([preloadAll(), font]).then(() => {
      lastTime = 0
      acc = 0
      raf = requestAnimationFrame(frame)
    })
  }

  function rematch(next: DuelConfig): void {
    cancel()
    duel = next
    seed = next.seed
    build()
    lastTime = 0
    acc = 0
    hitStop = 0
    prev = new Map()
    trails = new Map()
    particles = []
    flashes = []
    hitFlashes = []
    shockwaves = []
    deflected = []
    dying = []
    endedFor = 0
    cardShown = false
    seenShots = new Set()
    pendingSlam = null
    raf = requestAnimationFrame(frame)
  }

  function cancel(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function dispose(): void {
    cancel()
    engine?.dispose()
    engine = null
  }

  return { view, start, rematch, dispose }
}
