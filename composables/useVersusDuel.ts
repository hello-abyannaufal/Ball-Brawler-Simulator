import { shallowRef, type Ref, type ShallowRef } from 'vue'
import type { DuelConfig } from '~/engine/config'
import type { EngineEvent } from '~/engine/events'
import type { Ball, Entity, EntityId, Projectile, WeaponEntity } from '~/engine/entities'
import { createEngine, TIMESTEP, type Engine } from '~/engine/engine'
import { useSprites } from '~/composables/useSprites'
import { usePixelFont } from '~/composables/usePixelFont'
import { hpBarFraction } from '~/utils/duel'
import '~/engine/weapons/index'

export interface HpView {
  id: EntityId
  hp: number
  maxHp: number
}

export interface VersusView {
  hp: ShallowRef<HpView[]>
  winner: ShallowRef<EntityId | null | undefined>
  lastEvent: ShallowRef<EngineEvent | null>
}

export interface VersusDuel {
  view: VersusView
  start(): void
  rematch(): void
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
}

/** Hit-stop: real-time seconds the simulation freezes after a damage event.
 *  Render-only (the engine just isn't stepped), so determinism is unaffected. */
const HIT_STOP = 0.08

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

/**
 * Client-only duel driver + retro renderer (Req 11.5, 11.6, 11.8, 11.10, 11.11).
 * Owns the rAF loop, advances the engine by whole 1/60s steps scaled by sim
 * speed, draws the World once per frame, and surfaces hp/winner/lastEvent via
 * shallowRefs updated at most once per frame (never deep-binding entities).
 */
export function useVersusDuel(
  canvas: Ref<HTMLCanvasElement | null>,
  duel: DuelConfig,
  seed: number,
  speed: number,
  opts?: { showHitboxes?: boolean },
): VersusDuel {
  const { preloadAll, drawSprite } = useSprites()
  const { preloadFont, drawText } = usePixelFont()

  const view: VersusView = {
    hp: shallowRef<HpView[]>([]),
    winner: shallowRef<EntityId | null | undefined>(undefined),
    lastEvent: shallowRef<EngineEvent | null>(null),
  }

  let engine: Engine | null = null
  let raf = 0
  let lastTime = 0
  let acc = 0
  let hitStop = 0 // seconds of freeze remaining
  let particles: Particle[] = []
  let flashes: Flash[] = []
  // Entity state before the latest step, for render interpolation.
  let prev = new Map<EntityId, { x: number; y: number; angle: number }>()

  function build(): void {
    engine = createEngine({
      seed,
      config: duel,
      onEvent: (e) => {
        view.lastEvent.value = e
        if (e.type === 'damage' && e.amount > 0) {
          hitStop = HIT_STOP
          spawnBlood(e.targetId, e.attackerId, e.amount)
        } else if (e.type === 'weaponClash') {
          hitStop = Math.max(hitStop, CLASH_HIT_STOP)
          spawnSparks(e.a, e.b, e.outcome)
        }
      },
    })
    view.winner.value = undefined
    syncHp()
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
  function spawnBlood(targetId: EntityId, attackerId: EntityId | '', amount: number): void {
    const target = engine?.world.ballById(targetId)
    if (!target) return
    const attacker = attackerId === '' ? undefined : engine!.world.ballById(attackerId)
    let dir = 0
    let spread = Math.PI * 2
    if (attacker) {
      dir = Math.atan2(target.position.y - attacker.position.y, target.position.x - attacker.position.x)
      spread = Math.PI * 0.6
    }
    // Impact point: target surface on the attacker's side.
    const ix = target.position.x - Math.cos(dir) * target.radius * (attacker ? 1 : 0)
    const iy = target.position.y - Math.sin(dir) * target.radius * (attacker ? 1 : 0)
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
  function spawnSparks(aId: EntityId, bId: EntityId, outcome: keyof typeof SPARK_COUNT): void {
    const ents = engine?.world.entities
    const a = ents?.find((e): e is WeaponEntity => e.id === aId && e.kind === 'weapon')
    const b = ents?.find((e): e is WeaponEntity => e.id === bId && e.kind === 'weapon')
    if (!a || !b) return
    // Contact ≈ midpoint of each blade's point closest to the other.
    const pa = closestOnWeapon(a, b.position.x, b.position.y)
    const pb = closestOnWeapon(b, pa.x, pa.y)
    const cx = (pa.x + pb.x) / 2
    const cy = (pa.y + pb.y) / 2
    flashes.push({ x: cx, y: cy, life: CLASH_FLASH })
    for (let i = 0; i < SPARK_COUNT[outcome]; i++) {
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
        ctx.fillRect(x, y, tile, tile)
      }
    }
    // wall border
    ctx.strokeStyle = EDG.wall
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, width, height)
  }

  function drawBall(ctx: CanvasRenderingContext2D, b: Ball): void {
    ctx.save()
    ctx.beginPath()
    ctx.arc(b.position.x, b.position.y, b.radius, 0, Math.PI * 2)
    ctx.clip()
    const app = findAppearance(b.id)
    if (app?.type === 'color') {
      ctx.fillStyle = app.value
      ctx.fillRect(b.position.x - b.radius, b.position.y - b.radius, b.radius * 2, b.radius * 2)
    } else {
      // pattern/image handled later; default solid fallback
      ctx.fillStyle = '#c0cbdc'
      ctx.fillRect(b.position.x - b.radius, b.position.y - b.radius, b.radius * 2, b.radius * 2)
    }
    ctx.restore()
    // outline for retro pop
    ctx.strokeStyle = EDG.wall
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(b.position.x, b.position.y, b.radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  function findAppearance(id: EntityId) {
    const idx = engine!.world.entities
      .filter((e) => e.kind === 'ball')
      .findIndex((e) => e.id === id)
    return duel.ballConfigs[idx]?.appearance
  }

  function drawWeapon(ctx: CanvasRenderingContext2D, w: WeaponEntity): void {
    const spriteId = w.def.spriteId
    if (!spriteId) return
    const owner = engine!.world.ballById(w.ownerId)
    const pivot = w.def.pivot
    // Anchor the grip at the ball surface along the weapon angle, so the
    // weapon hugs the ball and the blade sweeps outward as it orbits
    // (visually "held but rotating").
    const anchorX = owner
      ? owner.position.x + Math.cos(w.angle) * owner.radius
      : w.position.x
    const anchorY = owner
      ? owner.position.y + Math.sin(w.angle) * owner.radius
      : w.position.y
    // Scale so the drawn grip→tip span equals the engine's weapon length:
    // what you see is exactly the hitbox.
    const scale = w.def.spriteReach ? w.def.length / w.def.spriteReach : 2
    drawSprite(ctx, spriteId, anchorX, anchorY, scale, w.angle, pivot)
  }

  function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    drawSprite(ctx, 'projectile:arrow', p.position.x, p.position.y, 1)
  }

  function drawHpBars(ctx: CanvasRenderingContext2D): void {
    const balls = engine!.world.entities.filter(
      (e): e is Ball => e.kind === 'ball',
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

  function render(): void {
    const el = canvas.value
    if (!el || !engine) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false

    clear(ctx)
    for (const e of engine.world.entities) {
      if (e.kind === 'ball' && e.alive) drawBall(ctx, e)
    }
    for (const e of engine.world.entities) {
      if (e.kind === 'weapon' && e.alive) drawWeapon(ctx, e)
      else if (e.kind === 'projectile' && e.alive) drawProjectile(ctx, e)
    }
    drawParticles(ctx)
    drawHpBars(ctx)
    if (opts?.showHitboxes) drawHitboxes(ctx)

    if (engine.ended) {
      const label =
        engine.winner === null ? 'DRAW' : `WINNER: ${engine.winner}`
      drawText(ctx, label, 8, 8, 2)
    }
  }

  // --- loop ---
  function frame(now: number): void {
    if (!engine) return
    if (lastTime === 0) lastTime = now
    const dt = (now - lastTime) / 1000
    lastTime = now

    if (hitStop > 0) {
      // Frozen on a hit: burn real time without advancing the simulation.
      hitStop -= dt
    } else {
      // Whole steps for elapsed real time, scaled by sim speed (each step 1/60s).
      acc += dt * speed
      let steps = Math.floor(acc / TIMESTEP)
      acc -= steps * TIMESTEP
      const MAX = 10 // clamp to avoid spiral-of-death on tab resume
      if (steps > MAX) steps = MAX
      // Stop stepping as soon as a hit lands so the freeze shows the impact frame.
      for (let i = 0; i < steps && hitStop <= 0; i++) {
        snapshot()
        engine.step()
      }
      if (hitStop > 0) acc = 0
      // Particles freeze with the hit-stop, then burst out when it ends.
      updateParticles(dt)
    }

    syncHp()
    view.winner.value = engine.winner
    // Frozen (hit-stop): show the exact step pose, no blending.
    const alpha = hitStop > 0 ? 1 : Math.min(1, acc / TIMESTEP)
    renderInterpolated(alpha)

    raf = requestAnimationFrame(frame)
  }

  function start(): void {
    if (!engine) build()
    preloadFont()
    preloadAll().then(() => {
      lastTime = 0
      acc = 0
      raf = requestAnimationFrame(frame)
    })
  }

  function rematch(): void {
    cancel()
    build() // same seed + config → identical duel (Req 11.10)
    lastTime = 0
    acc = 0
    hitStop = 0
    prev = new Map()
    particles = []
    flashes = []
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
