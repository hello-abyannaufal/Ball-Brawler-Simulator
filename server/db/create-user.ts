import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DEFAULT_ROLE } from '../../shared/roles'
import { isValidUsername } from '../utils/validateUsername'
import { validatePasswordLength } from '../utils/validatePassword'
import { users } from './schema'

const CONNECT_TIMEOUT_SECONDS = 10

/**
 * Creates a user account from the command line (no register UI yet):
 *   npm run user:create -- <username> <password>
 *
 * Hashes with the same Scrypt driver and default options nuxt-auth-utils'
 * `hashPassword` uses, so the account can log in through /api/auth/login.
 */
async function main() {
  const [username = '', password = ''] = process.argv.slice(2)

  if (!username || !password) {
    console.error('Usage: npm run user:create -- <username> <password>')
    process.exit(1)
  }
  if (!isValidUsername(username)) {
    console.error('Username must be 3–20 letters, digits or underscores.')
    process.exit(1)
  }
  const pw = validatePasswordLength(password)
  if (!pw.valid) {
    console.error(pw.error)
    process.exit(1)
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      'DATABASE_URL is not set. See .env.example for the required variables.',
    )
    process.exit(1)
  }

  const client = postgres(url, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
  })

  try {
    const db = drizzle(client)

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
    if (existing.length > 0) {
      console.error(`Username "${username}" is already taken.`)
      process.exitCode = 1
      return
    }

    const passwordHash = await new Hash(new Scrypt({})).make(password)
    const [created] = await db
      .insert(users)
      .values({ username, passwordHash, role: DEFAULT_ROLE })
      .returning({ id: users.id, role: users.role })

    console.log(`Created user "${username}" (${created?.role}).`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to create user: ${message}`)
    process.exitCode = 1
  } finally {
    await client.end({ timeout: 5 })
  }
}

main()
