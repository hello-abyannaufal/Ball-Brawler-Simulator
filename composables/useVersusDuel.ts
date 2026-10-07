import { shallowRef, type Ref, type ShallowRef } from 'vue'
import type { DuelConfig } from '~/engine/config'
import type { EngineEvent } from '~/engine/events'
import type { Ball, EntityId, Projectile, WeaponEntity } from '~/engine/entities'
import { createEngine, TIMESTEP, type Engine } from '~/engine/engine'
import { useSprites } from '~/composables/useSprites'
import { usePixelFont } from '~/composables/usePixelFont'
import { hpBarFraction } from '~/utils/duel'
import '~/engine/skills/index'
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

  function build(): void {
    engine = createEngine({
      seed,
      config: duel,
      onEvent: (e) => {
        view.lastEvent.value = e
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
    view.hp.value = balls.map((b) => ({ id: b.id, hp: b.hp, maxHp: b.maxHp }))
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

    // Whole steps for elapsed real time, scaled by sim speed (each step 1/60s).
    acc += dt * speed
    let steps = Math.floor(acc / TIMESTEP)
    acc -= steps * TIMESTEP
    const MAX = 10 // clamp to avoid spiral-of-death on tab resume
    if (steps > MAX) steps = MAX
    for (let i = 0; i < steps && !engine.ended; i++) engine.step()

    syncHp()
    view.winner.value = engine.winner
    render()

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
