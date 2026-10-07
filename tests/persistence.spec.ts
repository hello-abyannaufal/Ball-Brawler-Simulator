// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { failSafeStorage, usePersistenceError } from '~/stores/example'

describe('fail-safe persistence adapter', () => {
  beforeEach(() => {
    localStorage.clear()
    usePersistenceError().value = { failed: false, message: '' }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes serialized state to localStorage (Req 5.3)', () => {
    failSafeStorage.setItem('example', JSON.stringify({ visitCount: 1 }))
    const raw = localStorage.getItem('example')
    expect(raw).toBeTypeOf('string')
    expect(JSON.parse(raw as string).visitCount).toBe(1)
  })

  it('restores previously written state (Req 5.4)', () => {
    localStorage.setItem('example', JSON.stringify({ visitCount: 7 }))
    const restored = failSafeStorage.getItem('example')
    expect(JSON.parse(restored as string).visitCount).toBe(7)
  })

  it('on write failure keeps data out and raises the signal (Req 5.5)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    failSafeStorage.setItem('example', JSON.stringify({ visitCount: 1 }))

    const error = usePersistenceError().value
    expect(error.failed).toBe(true)
    expect(error.message).toContain('quota exceeded')
  })

  it('clears the signal after a later successful write', () => {
    usePersistenceError().value = { failed: true, message: 'old failure' }
    failSafeStorage.setItem('example', JSON.stringify({ visitCount: 2 }))
    expect(usePersistenceError().value.failed).toBe(false)
  })
})
