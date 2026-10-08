// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isValidUsername } from '~/server/utils/validateUsername'

describe('isValidUsername', () => {
  it.each(['abc', 'player_1', 'A_very_long_name_20c'])('accepts %s', (name) => {
    expect(isValidUsername(name)).toBe(true)
  })

  it.each(['', 'ab', 'a b', 'name!', 'user@mail.com', 'this_name_is_too_long'])('rejects %j', (name) => {
    expect(isValidUsername(name)).toBe(false)
  })
})
