import type { Ball, EntityId, WeaponEntity } from './entities'
import type { DuelConfig } from './config'
import type { EngineEvent } from './events'
import type { SkillContext, SkillInstance } from './skills/types'
import type { WeaponInstance } from './weapons/types'
import { World } from './world'
import { createRng } from './rng'
import { applyDamage } from './damage'
import { resolveWallCollision, ballsOverlap, separateBalls, applyKnockback } from './physics'
import { runStatusEffects } from './status'
import { CooldownTable } from './cooldown'
import { skillRegistry } from './skills/registry'
import { weaponRegistry } from './weapons/registry'
import {
  weaponHitsBall,
  weaponsOverlap,
  resolveClash,
  unitToward,
} from './weapons/combat'

export const engineVersion = '1.0.0' // non-empty string (Req 5.8)
export const TIMESTEP = 1 / 60 // seconds (Req 5.4)

/** Default contact hit cooldown, in whole steps. */
const CONTACT_COOLDOWN_STEPS = 30
/** Knockback impulse magnitude applied on a contact hit. */
const CONTACT_KNOCKBACK = 50

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
 * Builds a World from config, validates the seed, and resolves every skill and
 * weapon id against the registries (rejecting unknown ids by name, Req 9.5).
 */
export function createEngine(opts: EngineOptions): Engine {
  const rng = createRng(opts.seed) // validates seed, throws before any step (Req 5.2, 5.9)
  const world = new World({
    rng,
    arena: opts.config.arenaConfig,
    onEvent: opts.onEvent,
  })

  // Build ball entities from config, resolving skill/weapon ids.
  for (const bc of opts.config.ballConfigs) {
    const skills: SkillInstance[] = bc.skills.map((ref) => {
      const def = skillRegistry.get(ref.skillId)
      if (!def) {
        throw new Error(`Unknown skill id: ${ref.skillId}.`) // Req 9.5
      }
      return {
        def,
        config: { ...def.config, ...(ref.config ?? {}) },
        state: {},
      }
    })

    const weapons: WeaponInstance[] = bc.weapons.map((ref) => {
      const def = weaponRegistry.get(ref.weaponId)
      if (!def) {
        throw new Error(`Unknown weapon id: ${ref.weaponId}.`)
      }
      return { def, state: {} }
    })

    const ball: Ball = {
      id: world.allocateId(),
      kind: 'ball',
      position: { ...bc.initialPosition },
      velocity: { ...bc.initialVelocity },
      alive: true,
      radius: bc.radius,
      hp: bc.maxHp,
      maxHp: bc.maxHp,
      contactDamage: bc.contactDamage,
      skills,
      weapons,
      statusEffects: [],
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
        hitbox: inst.def.hitbox,
      }
      world.add(we)
    }
  }

  const cooldowns = new CooldownTable()
  const weaponFireTimers = new Map<EntityId, number>()
  let ended = false
  let winner: EntityId | null | undefined = undefined

  function fireSkillHook(
    ball: Ball,
    hook: 'onTick' | 'onHit' | 'onHurt' | 'onWallBounce' | 'onDeath',
    extra?: Omit<Partial<SkillContext>, 'ball' | 'world' | 'config' | 'state'>,
  ): void {
    // Snapshot the skill list: hooks may mutate ball.skills (none currently do).
    for (const inst of [...ball.skills]) {
      const fn = inst.def[hook]
      if (!fn) continue
      const ctx: SkillContext = {
        ball,
        world,
        config: inst.config,
        state: inst.state,
        ...extra,
      }
      fn.call(inst.def, ctx)
      // Each triggered skill emits exactly one skillTriggered event (Req 9.4).
      world.emit({ type: 'skillTriggered', skillId: inst.def.id, ballId: ball.id })
    }
  }

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

  // op 1: move weapons according to their mode (Req 10.4, 10.5).
  function moveWeapons(): void {
    for (const w of liveWeapons()) {
      const owner = world.ballById(w.ownerId)
      if (!owner || !owner.alive) {
        w.alive = false // owner gone: drop the weapon
        continue
      }
      if (w.def.mode === 'orbit') {
        w.angle += w.def.angularSpeed * TIMESTEP
        const orbitRadius = owner.radius + w.def.length
        w.position = {
          x: owner.position.x + Math.cos(w.angle) * orbitRadius,
          y: owner.position.y + Math.sin(w.angle) * orbitRadius,
        }
      } else {
        // held: position at owner, oriented toward the target.
        const target = nearestOpponent(owner.id, owner.position)
        w.position = { ...owner.position }
        if (target) {
          const u = unitToward(owner.position, target.position)
          w.angle = Math.atan2(u.y, u.x)
          // Project the hitbox center out along the facing direction.
          w.position = {
            x: owner.position.x + u.x * (owner.radius + w.def.length / 2),
            y: owner.position.y + u.y * (owner.radius + w.def.length / 2),
          }
        }
      }

      // Weapons with projectile settings fire on interval (Req 10.10, e.g. Bow).
      if (w.def.projectile) {
        const ps = w.def.projectile
        const t = (weaponFireTimers.get(w.id) ?? 0) + 1
        if (t >= ps.fireInterval) {
          weaponFireTimers.set(w.id, 0)
          const u = unitToward(owner.position, {
            x: owner.position.x + Math.cos(w.angle),
            y: owner.position.y + Math.sin(w.angle),
          })
          world.add({
            id: world.allocateId(),
            kind: 'projectile',
            position: {
              x: w.position.x + u.x * ps.radius,
              y: w.position.y + u.y * ps.radius,
            },
            velocity: { x: u.x * ps.speed, y: u.y * ps.speed },
            alive: true,
            radius: ps.radius,
            damage: ps.damage,
            ownerId: w.ownerId,
          })
        } else {
          weaponFireTimers.set(w.id, t)
        }
      }
    }
  }

  // op 3: resolve weapon clashes — no direct damage, one event each (Req 10.8, 10.9).
  function resolveWeaponClashes(): void {
    const weapons = liveWeapons()
    for (let i = 0; i < weapons.length; i++) {
      for (let j = i + 1; j < weapons.length; j++) {
        const a = weapons[i]!
        const b = weapons[j]!
        if (a.ownerId === b.ownerId) continue // same ball's weapons don't clash
        if (!weaponsOverlap(a, b)) continue
        const outcome = resolveClash(a, b, world.rng)
        world.emit({ type: 'weaponClash', a: a.id, b: b.id, outcome })
      }
    }
  }

  // op 4 (weapon part): weapon hitbox vs opposing ball (Req 10.6, 10.7).
  function applyWeaponHits(): void {
    for (const w of liveWeapons()) {
      const owner = world.ballById(w.ownerId)
      if (!owner) continue
      if (w.def.damage <= 0) continue
      for (const ball of world.aliveBalls()) {
        if (ball.id === w.ownerId) continue
        if (!weaponHitsBall(w, ball)) continue
        if (cooldowns.isActive(w.ownerId, ball.id)) continue

        const outcome = applyDamage(world, {
          source: { tag: 'weapon' },
          attackerId: w.ownerId,
          targetId: ball.id,
          amount: w.def.damage,
        })
        if (outcome.kind === 'applied') {
          cooldowns.start(w.ownerId, ball.id, CONTACT_COOLDOWN_STEPS)
          fireSkillHook(owner, 'onHit', {
            source: { tag: 'weapon' },
            dealt: { targetId: ball.id, amount: outcome.applied },
          })
          fireSkillHook(ball, 'onHurt', {
            source: { tag: 'weapon' },
            taken: { attackerId: w.ownerId, amount: outcome.applied },
          })
          if (outcome.killed) fireSkillHook(ball, 'onDeath')
        }
      }
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
    for (const p of world.entities) {
      if (p.kind !== 'projectile' || !p.alive) continue
      for (const ball of world.aliveBalls()) {
        if (ball.id === p.ownerId) continue
        const dx = ball.position.x - p.position.x
        const dy = ball.position.y - p.position.y
        const sum = p.radius + ball.radius
        if (dx * dx + dy * dy > sum * sum) continue

        const outcome = applyDamage(world, {
          source: { tag: 'projectile' },
          attackerId: p.ownerId, // credited to the owner (Req 10.10)
          targetId: ball.id,
          amount: p.damage,
        })
        p.alive = false // projectile is consumed on hit
        if (outcome.kind === 'applied') {
          const owner = world.ballById(p.ownerId)
          if (owner) {
            fireSkillHook(owner, 'onHit', {
              source: { tag: 'projectile' },
              dealt: { targetId: ball.id, amount: outcome.applied },
            })
          }
          fireSkillHook(ball, 'onHurt', {
            source: { tag: 'projectile' },
            taken: { attackerId: p.ownerId, amount: outcome.applied },
          })
          if (outcome.killed) fireSkillHook(ball, 'onDeath')
        }
        break // consumed
      }
    }
  }

  function step(): void {
    if (ended) return

    // Per-step skill tick (e.g. Blaster firing timer, Req 9.8).
    for (const ball of world.aliveBalls()) {
      fireSkillHook(ball, 'onTick')
    }

    // (1) move balls and weapons
    for (const ball of world.aliveBalls()) {
      ball.position.x += ball.velocity.x * TIMESTEP
      ball.position.y += ball.velocity.y * TIMESTEP
      const bounced = resolveWallCollision(ball, world.arena)
      if (bounced) {
        fireSkillHook(ball, 'onWallBounce') // once per bounce (Req 8.3)
      }
    }
    moveWeapons()
    moveProjectiles()

    // (2) detect collisions — stable `for i < j` over the entity array.
    const balls = world.aliveBalls()
    const contacts: Array<[Ball, Ball]> = []
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]!
        const b = balls[j]!
        if (ballsOverlap(a, b)) {
          separateBalls(a, b)
          contacts.push([a, b])
        }
      }
    }

    // (3) resolve weapon clashes
    resolveWeaponClashes()

    // (4) apply damage — contact (both directions), weapon hits, projectiles.
    // (5) apply knockback — bundled with each applied contact hit.
    for (const [a, b] of contacts) {
      applyContact(a, b)
      applyContact(b, a)
    }
    applyWeaponHits()
    applyProjectileHits()

    // (6) run status effects
    runStatusEffects(world)
    cooldowns.decrementAll() // one timestep per step (Req 7.8)

    // (7) check win condition
    const alive = world.aliveBalls()
    if (alive.length <= 1) {
      // Only end once zero or one remains (Req 8.7, 8.8, 8.9).
      winner = alive.length === 1 ? alive[0]!.id : null
      ended = true
      world.emit({ type: 'matchEnded', winner })
    }

    world.tick += 1
  }

  /** Striker deals contact damage to struck if eligible, then knockback. */
  function applyContact(striker: Ball, struck: Ball): void {
    if (striker.contactDamage <= 0) return
    if (!struck.alive) return
    // Active cooldown for this ordered pair blocks all interaction (Req 7.7).
    if (cooldowns.isActive(striker.id, struck.id)) return

    const outcome = applyDamage(world, {
      source: { tag: 'contact' },
      attackerId: striker.id,
      targetId: struck.id,
      amount: striker.contactDamage,
    })

    if (outcome.kind === 'applied') {
      cooldowns.start(striker.id, struck.id, CONTACT_COOLDOWN_STEPS)
      applyKnockback(striker, struck, CONTACT_KNOCKBACK) // along center line (Req 8.6)
      // Damage-driven skill hooks (Req 9.3): striker dealt, struck took.
      fireSkillHook(striker, 'onHit', {
        source: { tag: 'contact' },
        dealt: { targetId: struck.id, amount: outcome.applied },
      })
      fireSkillHook(struck, 'onHurt', {
        source: { tag: 'contact' },
        taken: { attackerId: striker.id, amount: outcome.applied },
      })
      if (outcome.killed) {
        fireSkillHook(struck, 'onDeath')
      }
    }
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
