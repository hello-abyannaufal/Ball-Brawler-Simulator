import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Req 1.3: role constrained to exactly `superuser` and `viewer`.
export const roleEnum = pgEnum('role', ['superuser', 'viewer'])

// Req 1.1, 1.2: users table with unique email and a not-null password hash.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(), // Req 1.1, 1.2
  passwordHash: text('password_hash').notNull(), // Req 1.1
  role: roleEnum('role').notNull(), // Req 1.1, 1.3
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(), // Req 1.1
})

// Example content table pattern — every content table carries a not-null
// `created_by` foreign key referencing users.id (Req 1.4).
//
// export const savedDuels = pgTable('saved_duels', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   createdBy: uuid('created_by')
//     .notNull()
//     .references(() => users.id), // FK, not null (Req 1.4)
//   // ...content columns
// })

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
