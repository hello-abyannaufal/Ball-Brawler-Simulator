import { defineConfig } from 'drizzle-kit'

// Emit migrations into server/db/migrations/ (Req 1.5).
export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
