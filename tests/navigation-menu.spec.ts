import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NavigationMenu from '~/components/NavigationMenu.vue'

const ROUTES = [
  '/login',
  '/register',
  '/roulette',
  '/versus',
  '/library',
  '/recordings',
  '/settings',
]

describe('NavigationMenu', () => {
  it('renders exactly one link per non-home route', async () => {
    const wrapper = await mountSuspended(NavigationMenu)
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toHaveLength(ROUTES.length)
    for (const route of ROUTES) {
      expect(hrefs.filter(h => h === route)).toHaveLength(1)
    }
  })

  it('links are anchors in route order (tabbable)', async () => {
    const wrapper = await mountSuspended(NavigationMenu)
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toEqual(ROUTES)
  })

  it('each link carries a focus-visible style class', async () => {
    const wrapper = await mountSuspended(NavigationMenu)
    const links = wrapper.findAll('a')
    for (const link of links) {
      expect(link.classes().some(c => c.startsWith('focus-visible:'))).toBe(true)
    }
  })

  it('Space on a focused link triggers navigation', async () => {
    const wrapper = await mountSuspended(NavigationMenu)
    const router = useRouter()
    const push = vi.spyOn(router, 'push')
    await wrapper.find('a').trigger('keydown.space')
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('Enter on a link navigates via the native anchor href', async () => {
    const wrapper = await mountSuspended(NavigationMenu)
    // NuxtLink renders a real anchor; Enter activates it natively.
    expect(wrapper.find('a').attributes('href')).toBe('/login')
  })
})
