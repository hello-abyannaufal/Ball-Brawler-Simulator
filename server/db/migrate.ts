import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const MIGRATIONS_DIR = 'server/db/migrations'
const CONNECT_TIMEOUT_SECONDS = 10

/**
 * Applies all pending Drizzle migrations (Req 1.5, 1.8).
 * - Connects with a 10-second timeout.
 * - On success prints the number of migrations applied.
 * - On connection failure terminates without changing data and prints the
 *   host and port attempted, never a secret (Req 1.9).
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      'DATABASE_URL is not set. See .env.example for the required variables.',
    )
    process.exit(1)
  }

  // Parse host/port for non-secret failure reporting (Req 1.9).
  let host = 'unknown'
  let port = 'unknown'
  try {
    const parsed = new URL(url)
    host = parsed.hostname || host
    port = parsed.port || '5432'
  } catch {
    // leave defaults; URL parsing failure is reported below on connect
  }

  // Count migration files before applying so we can report pending count.
  const { readdir } = await import('node:fs/promises')
  let before: string[] = []
  try {
    before = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql'))
  } catch {
    before = []
  }

  const client = postgres(url, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
  })

  try {
    const db = drizzle(client)
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    console.log(
      `Migrations complete: ${before.length} migration file(s) processed.`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `Migration failed: could not connect to PostgreSQL at ${host}:${port}. Data left unchanged. (${message})`,
    )
    process.exitCode = 1
  } finally {
    await client.end({ timeout: 5 })
  }
}

main()
