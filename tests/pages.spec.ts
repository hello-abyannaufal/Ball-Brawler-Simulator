import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import index from '~/pages/index.vue'
import login from '~/pages/login.vue'
import register from '~/pages/register.vue'
import roulette from '~/pages/roulette.vue'
import versus from '~/pages/versus.vue'
import library from '~/pages/library.vue'
import recordings from '~/pages/recordings.vue'
import settings from '~/pages/settings.vue'
import notFound from '~/pages/[...slug].vue'

describe('placeholder pages', () => {
  const cases: Array<[string, unknown, string]> = [
    ['index (signed out: splash)', index, 'Ball Brawler'],
    ['login', login, 'Ball Brawler'],
    ['register', register, 'Register'],
    ['roulette', roulette, 'Roulette'],
    ['versus', versus, 'Versus'],
    ['library', library, 'Library'],
    ['recordings', recordings, 'Recordings'],
    ['settings', settings, 'Settings'],
  ]

  it.each(cases)('%s renders its unique heading', async (_name, component, heading) => {
    const wrapper = await mountSuspended(component as never)
    expect(wrapper.find('h1').text().replace(/\s+/g, ' ')).toContain(heading)
  })

  it('login opens the login dialog', async () => {
    const wrapper = await mountSuspended(login)
    expect(wrapper.find('[role="dialog"] #login-title').text()).toBe('LOGIN')
  })

  it('not-found view renders a page-not-found heading', async () => {
    const wrapper = await mountSuspended(notFound)
    expect(wrapper.find('h1').text()).toContain('Page not found')
  })
})
