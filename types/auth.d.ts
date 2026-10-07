// Augment nuxt-auth-utils session shape with our User type.
declare module '#auth-utils' {
  interface User {
    id: string
    role: 'superuser' | 'viewer'
  }

  interface UserSession {
    user?: User
  }
}

export {}
