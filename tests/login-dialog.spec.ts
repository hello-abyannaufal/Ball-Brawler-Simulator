import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { flushPromises } from '@vue/test-utils'
import LoginDialog from '~/components/LoginDialog.vue'

registerEndpoint('/api/auth/login', {
  method: 'POST',
  handler: () => {
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password.' })
  },
})

describe('LoginDialog', () => {
  it('labels the username and password fields', async () => {
    const wrapper = await mountSuspended(LoginDialog)
    expect(wrapper.find('label[for="login-username"]').text()).toBe('USERNAME')
    expect(wrapper.find('#login-username').attributes('autocomplete')).toBe('username')
    expect(wrapper.find('#login-password').attributes('type')).toBe('password')
  })

  it('shows the server error when the login is rejected', async () => {
    const wrapper = await mountSuspended(LoginDialog)
    await wrapper.find('#login-username').setValue('player_1')
    await wrapper.find('#login-password').setValue('wrong-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Invalid username or password.')
  })
})
