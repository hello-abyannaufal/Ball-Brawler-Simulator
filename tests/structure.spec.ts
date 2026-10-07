// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const REQUIRED_DIRS = [
  'engine',
  'engine/weapons',
  'server/utils',
  'pages',
  'stores',
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

describe('architecture folder structure', () => {
  it.each(REQUIRED_DIRS)('%s exists', (dir) => {
    expect(existsSync(join(root, dir))).toBe(true)
  })

  it('engine/ holds zero Vue files and zero Vue/Nuxt imports', () => {
    const files = walk(join(root, 'engine')).filter(f => /\.(ts|js|vue)$/.test(f))
    for (const file of files) {
      expect(file.endsWith('.vue')).toBe(false)
      const src = readFileSync(file, 'utf8')
      expect(/from ['"](vue|nuxt|#app|#imports)['"]/.test(src)).toBe(false)
    }
  })
})
