import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Reads the PostgreSQL connection string from the environment.
 * `DATABASE_URL` is the single source of connection info (Req 1.6, 1.7).
 */
export function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. See .env.example for the required variables.',
    )
  }
  return url
}

// Lazily-created singleton so importing this module never opens a connection
// at module-eval time (keeps tests and build side-effect free).
let _client: ReturnType<typeof postgres> | undefined
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDb() {
  if (!_db) {
    _client = postgres(getConnectionString())
    _db = drizzle(_client, { schema })
  }
  return _db
}

export { schema }
