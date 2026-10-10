import type { Ball, EntityId, Projectile, Vec2, WeaponEntity } from './entities'
import type { DuelConfig } from './config'
import type { EngineEvent } from './events'
import type { WeaponInstance } from './weapons/types'
import { World } from './world'
import { createRng } from './rng'
import { applyDamage } from './damage'
import { resolveWallCollision, ballsOverlap, separateBalls, bounceBalls, applyKnockback, launchAway } from './physics'
import { runStatusEffects, recomputeStats, hasControl } from './status'
import { CooldownTable } from './cooldown'
import { weaponRegistry } from './weapons/registry'
import { ballStats } from './races/registry'
import {
  weaponHitsBall,
  weaponsOverlap,
  resolveClash,
  bladeHitFraction,
  weaponTouchesCircle,
} from './weapons/combat'

export const engineVersion = '1.4.0' // non-empty string (Req 5.8)
export const TIMESTEP = 1 / 60 // seconds (Req 5.4)

/** Knockback impulse magnitude applied on a weapon hit. */
const HIT_KNOCKBACK = 50
/** Debounce between repeated clashes of the same weapon pair, in steps. */
const CLASH_COOLDOWN_STEPS = 10
/** Base knockback magnitude applied to both balls on a weapon clash. */
const CLASH_KNOCKBACK = 120
/** Steps a disarmed weapon stays harmless. */
const DISARM_STUN_STEPS = 18
/** Per-step fraction of the gap between current speed and cruise speed that
 *  is closed. Knockback is a burst that fades instead of accumulating. */
const SPEED_RECOVERY = 0.04
/** Slower recovery while a ball is flying from a heavy blow (slam pending),
 *  so the launch actually carries it across the arena. */
const SPEED_RECOVERY_LAUNCHED = 0.012

export interface EngineOptions {
  seed: number
  config: DuelConfig
  onEvent?: (e: EngineEvent) => void
}

export interface Engine {
  readonly world: World
  /** advance exactly one fixed 1/60s step through the fixed step order */
  step(): void
  /** true once matchEnded has been emitted */
  readonly ended: boolean
  /** winner ball id, or null for a draw, or undefined while running */
  readonly winner: EntityId | null | undefined
  dispose(): void
}

/**
 * Builds a World from config, validates the seed, and resolves every weapon id
 * against the registry (rejecting unknown ids by name).
 */
export function createEngine(opts: EngineOptions): Engine {
  const rng = createRng(opts.seed) // validates seed, throws before any step (Req 5.2, 5.9)
  const world = new World({
    rng,
    arena: opts.config.arenaConfig,
    onEvent: opts.onEvent,
  })

  // Build ball entities from config, resolving weapon ids.
  for (const [slot, bc] of opts.config.ballConfigs.entries()) {
    const weapons: WeaponInstance[] = bc.weapons.map((ref) => {
      const def = weaponRegistry.get(ref.weaponId)
      if (!def) {
        throw new Error(`Unknown weapon id: ${ref.weaponId}.`)
      }
      return { def, state: {} }
    })
    const stats = ballStats(bc) // race (or the config's own HP/radius)
    const base = {
      cruiseSpeed: Math.hypot(bc.initialVelocity.x, bc.initialVelocity.y) * stats.speed,
      damageTaken: stats.damageTaken,
      weaponSpin: stats.weaponSpin,
    }

    const ball: Ball = {
      id: world.allocateId(),
      kind: 'ball',
      position: { ...bc.initialPosition },
      velocity: { x: bc.initialVelocity.x * stats.speed, y: bc.initialVelocity.y * stats.speed },
      alive: true,
      radius: stats.radius,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      base,
      ...base,
      weapons,
      statusEffects: [],
      slam: null,
    }
    world.add(ball)

    // Spawn one weapon entity per carried weapon (Req 10.4, 10.5).
    for (const inst of weapons) {
      const we: WeaponEntity = {
        id: world.allocateId(),
        kind: 'weapon',
        position: { ...ball.position },
        velocity: { x: 0, y: 0 },
        alive: true,
        ownerId: ball.id,
        def: inst.def,
        angle: 0,
        // Runtime; flips on clash. Odd slots spin the other way: with equal
        // speeds (a mirror match) same-direction blades stay parallel forever
        // and never clash.
        angularSpeed: slot % 2 === 0 ? inst.def.angularSpeed : -inst.def.angularSpeed,
        stunSteps: 0,
        riposteSteps: 0,
        reapSteps: 0,
        hitbox: inst.def.hitbox,
      }
      world.add(we)
    }
  }

  const cooldowns = new CooldownTable()
  const weaponFireTimers = new Map<EntityId, number>()
  // Weapon pairs overlapping last step: a clash fires only when a pair first
  // touches, not on every frame of a sustained overlap.
  let touchingPairs = new Set<string>()
  // Weapons that clashed this step: blocked, so they deal no damage this step.
  const clashedThisStep = new Set<EntityId>()
  let ended = false
  let winner: EntityId | null | undefined = undefined

  function liveWeapons(): WeaponEntity[] {
    return world.entities.filter(
      (e): e is WeaponEntity => e.kind === 'weapon' && e.alive,
    )
  }

  /** Nearest living ball that is not `self`, or undefined. */
  function nearestOpponent(selfId: EntityId, pos: Ball['position']): Ball | undefined {
    let best: Ball | undefined
    let bestD = Infinity
    for (const b of world.aliveBalls()) {
      if (b.id === selfId) continue
      const dx = b.position.x - pos.x
      const dy = b.position.y - pos.y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    return best
  }

  // Projectile fires only when the weapon faces an opponent within this cone
  // (per weapon via `projectile.facingDegrees`).
  const DEFAULT_FACING_DEGREES = 15

  /** Smallest absolute difference between two angles, in [0, π]. */
  function angleDiff(a: number, b: number): number {
    let d = (a - b) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    return Math.abs(d)
  }

  /**
   * Unit direction from `from` that intercepts `target` (moving at constant
   * velocity) with a projectile of `speed`; straight at it if no intercept.
   */
  function leadDirection(from: Vec2, target: Ball, speed: number): [number, number] {
    const rx = target.position.x - from.x
    const ry = target.position.y - from.y
    const vx = target.velocity.x
    const vy = target.velocity.y
    // |r + v t| = speed · t  →  a t² + b t + c = 0
    const a = vx * vx + vy * vy - speed * speed
    const b = 2 * (rx * vx + ry * vy)
    const c = rx * rx + ry * ry
    let t = -1
    if (Math.abs(a) < 1e-9) {
      if (b < 0) t = -c / b
    } else {
      const disc = b * b - 4 * a * c
      if (disc >= 0) {
        const sq = Math.sqrt(disc)
        const t1 = (-b - sq) / (2 * a)
        const t2 = (-b + sq) / (2 * a)
        t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2)
      }
    }
    const ax = t > 0 ? rx + vx * t : rx
    const ay = t > 0 ? ry + vy * t : ry
    const len = Math.hypot(ax, ay) || 1
    return [ax / len, ay / len]
  }

  // op 1: move weapons. All starter weapons orbit with a static angularSpeed.
  function moveWeapons(): void {
    for (const w of liveWeapons()) {
      const owner = world.ballById(w.ownerId)
      if (!owner || !owner.alive) {
        w.alive = false // owner gone: drop the weapon
        continue
      }

      // Orbit motion (Req 10.4). Uses the runtime angularSpeed (base magnitude
      // from the def; its SIGN flips when the weapon clashes — a struck blade
      // is knocked into reverse spin). The weapon spans [surface, surface +
      // length]: a segment hitbox is centered on that span, a circle hitbox
      // (hammer head) sits at its far end.
      // Spin bursts: faster spin while a riposte is ready or a reap runs.
      const boost =
        w.riposteSteps > 0 ? (w.def.riposte?.spinBoost ?? 1)
        : w.reapSteps > 0 ? (w.def.reap?.spinBoost ?? 1)
        : 1
      // Stunned (status): weapons hold still and don't fire.
      const stunned = hasControl(owner, 'stun')
      if (!stunned) w.angle += w.angularSpeed * boost * owner.weaponSpin * TIMESTEP
      if (w.stunSteps > 0) w.stunSteps -= 1
      if (w.riposteSteps > 0) w.riposteSteps -= 1
      if (w.reapSteps > 0) {
        w.reapSteps -= 1
        // Reap over: every opponent is safe for the normal hitCooldown, so a
        // new reap can't chain straight on.
        if (w.reapSteps === 0) {
          const full = Math.round(w.def.hitCooldown / 1000 / TIMESTEP)
          for (const b of world.aliveBalls()) if (b.id !== w.ownerId) cooldowns.start(w.id, b.id, full)
        }
      }
      const orbitRadius =
        w.hitbox.shape === 'circle'
          ? owner.radius + w.def.length - w.hitbox.radius
          : owner.radius + w.def.length / 2
      w.position = {
        x: owner.position.x + Math.cos(w.angle) * orbitRadius,
        y: owner.position.y + Math.sin(w.angle) * orbitRadius,
      }

      // Projectile weapons (e.g. Bow) fire only while facing an opponent AND
      // the cooldown is ready (Req 10.10). Range does not matter.
      if (w.def.projectile) {
        const ps = w.def.projectile
        const timer = weaponFireTimers.get(w.id) ?? ps.fireInterval
        const ready = timer >= ps.fireInterval
        const target = nearestOpponent(owner.id, owner.position)
        let facing = false
        if (target) {
          const toTarget = Math.atan2(
            target.position.y - owner.position.y,
            target.position.x - owner.position.x,
          )
          facing = angleDiff(w.angle, toTarget) <= ((ps.facingDegrees ?? DEFAULT_FACING_DEGREES) * Math.PI) / 180
        }

        if (ready && facing && target && !stunned) {
          weaponFireTimers.set(w.id, 0)
          // Aim at where the target WILL be (constant-velocity lead), so the
          // arrow actually flies at the opponent. Deterministic: positions only.
          const [dx, dy] = leadDirection(w.position, target, ps.speed)
          world.add({
            id: world.allocateId(),
            kind: 'projectile',
            position: {
              x: w.position.x + dx * ps.radius,
              y: w.position.y + dy * ps.radius,
            },
            velocity: { x: dx * ps.speed, y: dy * ps.speed },
            alive: true,
            radius: ps.radius,
            damage: ps.damage,
            ownerId: w.ownerId,
            blockable: !!w.def.projectileBlockable,
            weaponId: w.def.id,
          })
        } else {
          weaponFireTimers.set(w.id, Math.min(timer + 1, ps.fireInterval))
        }
      }
    }
  }

  /**
   * Ready a riposte on `w` (if it has one): open the window and turn the
   * blade's spin toward the opponent, the shortest way round, for the burst.
   */
  function readyRiposte(w: WeaponEntity): void {
    if (!w.def.riposte) return
    w.riposteSteps = w.def.riposte.windowSteps
    const me = world.ballById(w.ownerId)
    const foe = me && nearestOpponent(me.id, me.position)
    if (me && foe) {
      let d = Math.atan2(foe.position.y - me.position.y, foe.position.x - me.position.x) - w.angle
      d = Math.atan2(Math.sin(d), Math.cos(d)) // wrap to (-π, π]
      w.angularSpeed = Math.sign(d || 1) * Math.abs(w.def.angularSpeed)
    }
  }

  // op 3: resolve weapon clashes — no direct damage, one event each (Req 10.8, 10.9).
  function resolveWeaponClashes(): void {
    const weapons = liveWeapons()
    const nowTouching = new Set<string>()
    clashedThisStep.clear()
    for (let i = 0; i < weapons.length; i++) {
      for (let j = i + 1; j < weapons.length; j++) {
        const a = weapons[i]!
        const b = weapons[j]!
        if (a.ownerId === b.ownerId) continue // same ball's weapons don't clash
        if (!weaponsOverlap(a, b)) continue
        const pairKey = `${a.id}:${b.id}`
        nowTouching.add(pairKey)
        clashedThisStep.add(a.id)
        clashedThisStep.add(b.id)
        // Only the first frame of contact clashes; plus a short debounce so
        // blades grazing in and out don't chatter.
        if (touchingPairs.has(pairKey)) continue
        if (cooldowns.isActive(a.id, b.id)) continue
        cooldowns.start(a.id, b.id, CLASH_COOLDOWN_STEPS)

        const outcome = resolveClash(a, b, world.rng)
        world.emit({ type: 'weaponClash', a: a.id, b: b.id, outcome })

        // Spin reaction. bounce/parry: both blades rebound (spin flips).
        // disarm: the heavier blade powers through (keeps its spin), the
        // lighter one is knocked back AND stunned (deals no damage briefly).
        const wa = a.def.weight
        const wb = b.def.weight
        if (outcome === 'disarm' && wa !== wb) {
          const loser = wa < wb ? a : b
          loser.angularSpeed = -loser.angularSpeed
          loser.stunSteps = DISARM_STUN_STEPS
        } else {
          a.angularSpeed = -a.angularSpeed
          b.angularSpeed = -b.angularSpeed
        }

        // Riposte: any clash the weapon isn't disarmed in (bounce, parry, or
        // disarming the other) readies a boosted next hit.
        for (const [self, other] of [[a, b], [b, a]] as const) {
          const won = outcome !== 'disarm' || self.def.weight > other.def.weight
          if (won) readyRiposte(self)
        }

        // ...and knock BOTH owner balls apart along their center line
        // (Req 10.8 forbids damage, not knockback).
        const oa = world.ballById(a.ownerId)
        const ob = world.ballById(b.ownerId)
        if (oa && ob) {
          const mag =
            outcome === 'disarm'
              ? CLASH_KNOCKBACK * 1.5
              : outcome === 'parry'
                ? CLASH_KNOCKBACK * 0.6
                : CLASH_KNOCKBACK
          applyKnockback(ob, oa, mag) // push oa away from ob
          applyKnockback(oa, ob, mag) // push ob away from oa
        }
      }
    }
    touchingPairs = nowTouching
  }

  // op 4 (weapon part): weapon hitbox vs opposing ball (Req 10.6, 10.7).
  function applyWeaponHits(): void {
    for (const w of liveWeapons()) {
      const owner = world.ballById(w.ownerId)
      if (!owner) continue
      if (w.def.damage <= 0) continue
      if (w.stunSteps > 0) continue // disarmed
      if (hasControl(owner, 'stun')) continue // owner stunned (status)
      if (clashedThisStep.has(w.id)) continue // blocked by a clash this step
      for (const ball of world.aliveBalls()) {
        if (ball.id === w.ownerId) continue
        if (!weaponHitsBall(w, ball)) continue
        // Keyed by the weapon so each weapon has its own hitCooldown.
        if (cooldowns.isActive(w.id, ball.id)) continue

        // Boosted hits: Spear tip strike, Sword riposte (multipliers stack).
        let mult = 1
        const tip = w.def.tipStrike
        if (tip && bladeHitFraction(w, ball) >= 1 - tip.fraction) mult *= tip.multiplier
        if (w.def.riposte && w.riposteSteps > 0) {
          mult *= w.def.riposte.multiplier
          w.riposteSteps = 0 // spent
        }

        const outcome = applyDamage(world, {
          source: { tag: 'weapon' },
          attackerId: w.ownerId,
          targetId: ball.id,
          amount: w.def.damage * mult,
          ...(mult > 1 ? { flags: { style: 'critical' as const } } : {}),
        })
        if (outcome.kind === 'applied') {
          const reap = w.def.reap
          const reaping = !!reap && w.reapSteps > 0
          if (reap) {
            // Rapid re-hits while the reap lasts (it ends with a full cooldown).
            if (!reaping) w.reapSteps = reap.windowSteps
            cooldowns.start(w.id, ball.id, reap.hitCooldownSteps)
          } else {
            cooldowns.start(w.id, ball.id, Math.round(w.def.hitCooldown / 1000 / TIMESTEP))
          }
          // Reaping blades don't push the ball away, so they keep cutting.
          if (w.def.launchSpeed) launchAway(owner, ball, w.def.launchSpeed)
          else if (!reap) applyKnockback(owner, ball, HIT_KNOCKBACK)
          if (w.def.reboundOnHit) w.angularSpeed = -w.angularSpeed
          if (w.def.wallSlam && ball.alive) {
            ball.slam = { attackerId: owner.id, damage: w.def.wallSlam.damage, steps: w.def.wallSlam.windowSteps }
          }
        }
      }
    }
  }

  /** op 4 (wall-slam part): a pending slam turns a wall bounce into damage, once. */
  function applyWallSlams(slammed: Ball[]): void {
    for (const ball of slammed) {
      const slam = ball.slam
      ball.slam = null
      if (!slam || !ball.alive) continue
      // Contact point: the ball's edge on the wall side it just bounced off.
      const { width, height } = world.arena
      const r = ball.radius
      const x = ball.position.x <= r ? 0 : ball.position.x >= width - r ? width : ball.position.x
      const y = ball.position.y <= r ? 0 : ball.position.y >= height - r ? height : ball.position.y
      world.emit({ type: 'wallSlam', ballId: ball.id, attackerId: slam.attackerId, x, y })
      applyDamage(world, {
        source: { tag: 'weapon' },
        attackerId: slam.attackerId,
        targetId: ball.id,
        amount: slam.damage,
      })
    }
  }

  // op 1 + op 4 (projectile part): move projectiles, damage opposing balls (Req 10.10).
  function moveProjectiles(): void {
    for (const p of world.entities) {
      if (p.kind !== 'projectile' || !p.alive) continue
      p.position.x += p.velocity.x * TIMESTEP
      p.position.y += p.velocity.y * TIMESTEP
      // Despawn when leaving the arena bounds.
      if (
        p.position.x < 0 ||
        p.position.y < 0 ||
        p.position.x > world.arena.width ||
        p.position.y > world.arena.height
      ) {
        p.alive = false
      }
    }
  }

  function applyProjectileHits(): void {
    const weapons = liveWeapons()
    const projectiles = world.entities.filter((e): e is Projectile => e.kind === 'projectile')
    const blocked = (p: Projectile, by: EntityId) => {
      p.alive = false
      world.emit({ type: 'projectileBlocked', projectileId: p.id, weaponId: by, x: p.position.x, y: p.position.y })
    }
    /** Send `p` back at its shooter, now owned (and credited) by the reflector. */
    const reflect = (p: Projectile, by: WeaponEntity) => {
      const shooter = world.ballById(p.ownerId)
      const speed = Math.hypot(p.velocity.x, p.velocity.y)
      const [dx, dy] = shooter?.alive
        ? leadDirection(p.position, shooter, speed)
        : [-p.velocity.x / (speed || 1), -p.velocity.y / (speed || 1)]
      p.ownerId = by.ownerId
      p.velocity = { x: dx * speed, y: dy * speed }
      world.emit({ type: 'projectileReflected', projectileId: p.id, weaponId: by.id, x: p.position.x, y: p.position.y })
    }
    for (const p of projectiles) {
      if (!p.alive) continue
      // Swatted: an opposing bladed weapon touching it destroys it (a Bow
      // can't swat an arrow).
      if (p.blockable) {
        const blocker = weapons.find(
          (w) =>
            w.ownerId !== p.ownerId
            && !w.def.projectile
            && weaponTouchesCircle(w, p.position.x, p.position.y, p.radius),
        )
        if (blocker) {
          const r = blocker.def.riposte
          if (r?.reflectProjectiles && blocker.riposteSteps > 0) reflect(p, blocker)
          else blocked(p, blocker.id)
          continue
        }
      }
      for (const ball of world.aliveBalls()) {
        if (ball.id === p.ownerId) continue
        const dx = ball.position.x - p.position.x
        const dy = ball.position.y - p.position.y
        const sum = p.radius + ball.radius
        if (dx * dx + dy * dy > sum * sum) continue

        p.alive = false // consumed on hit
        applyDamage(world, {
          source: { tag: 'projectile' },
          attackerId: p.ownerId, // credited to the owner (Req 10.10)
          targetId: ball.id,
          amount: p.damage,
        })
        break
      }
    }
  }

  /**
   * Keeps simulating after `matchEnded` (the winner keeps moving); the event
   * itself is still emitted exactly once.
   */
  function step(): void {
    // (0) rebuild effective stats from base + active status modifiers
    recomputeStats(world)

    // (1) move balls and weapons
    const slammed: Ball[] = [] // hit a wall while a slam was pending; damaged in (4)
    for (const ball of world.aliveBalls()) {
      regulateSpeed(ball)
      ball.position.x += ball.velocity.x * TIMESTEP
      ball.position.y += ball.velocity.y * TIMESTEP
      const bounced = resolveWallCollision(ball, world.arena)
      if (ball.slam) {
        if (bounced) slammed.push(ball)
        else if (--ball.slam.steps <= 0) ball.slam = null // window expired
      }
    }
    moveWeapons()
    moveProjectiles()

    // (2) detect collisions — stable `for i < j` over the entity array.
    // Ball vs ball is purely physical: they bounce apart, no damage.
    const balls = world.aliveBalls()
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]!
        const b = balls[j]!
        if (ballsOverlap(a, b)) {
          separateBalls(a, b)
          bounceBalls(a, b) // reflect velocities so they don't stick
        }
      }
    }

    // (3) resolve weapon clashes
    resolveWeaponClashes()

    // (4) apply damage — weapon hits, projectiles.
    // (5) apply knockback — bundled with each applied weapon hit.
    applyWeaponHits()
    applyProjectileHits()
    applyWallSlams(slammed)

    // (6) run status effects
    runStatusEffects(world)
    cooldowns.decrementAll() // one timestep per step (Req 7.8)

    // A ball killed this step drops its weapons right away, so they don't
    // linger (or keep clashing) for a step after the owner is gone.
    for (const w of liveWeapons()) {
      if (!world.ballById(w.ownerId)?.alive) w.alive = false
    }

    // (7) check win condition
    const alive = world.aliveBalls()
    if (!ended && alive.length <= 1) {
      // Only end once zero or one remains (Req 8.7, 8.8, 8.9).
      winner = alive.length === 1 ? alive[0]!.id : null
      ended = true
      world.emit({ type: 'matchEnded', winner })
    }

    world.tick += 1
  }

  /**
   * Ease the ball's speed toward its cruise speed. Walls and ball-ball bounces
   * are elastic and knockback only ADDS velocity, so without this balls speed
   * up every exchange until the duel is unreadable.
   */
  function regulateSpeed(ball: Ball): void {
    const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
    if (speed === 0) return
    const k = ball.slam ? SPEED_RECOVERY_LAUNCHED : SPEED_RECOVERY
    const target = speed + (ball.cruiseSpeed - speed) * k
    ball.velocity.x *= target / speed
    ball.velocity.y *= target / speed
  }

  return {
    world,
    step,
    get ended() {
      return ended
    },
    get winner() {
      return winner
    },
    dispose() {
      // No external resources held by the pure engine.
    },
  }
}
