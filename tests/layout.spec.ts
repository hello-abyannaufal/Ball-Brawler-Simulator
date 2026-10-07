import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DefaultLayout from '~/layouts/default.vue'

describe('default layout', () => {
  it('fills the full viewport with vertical-only scrolling', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const root = wrapper.find('div.min-h-screen')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('w-full')
    expect(root.classes()).toContain('overflow-x-hidden')
    expect(root.classes()).toContain('overflow-y-auto')
  })

  it('hides the persistence notification by default', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    // The deployment-safety banner is also role="alert" (Req 17.6), so target
    // the persistence notification by its dismiss control.
    expect(wrapper.find('[aria-label="Dismiss notification"]').exists()).toBe(false)
  })
})
