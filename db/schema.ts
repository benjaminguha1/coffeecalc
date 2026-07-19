import { sql } from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const coffeeStates = sqliteTable('coffee_states', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const staffUsers = sqliteTable(
  'staff_users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    usernameNormalized: text('username_normalized').notNull(),
    email: text('email'),
    emailNormalized: text('email_normalized'),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    role: text('role', { enum: ['admin', 'staff'] })
      .notNull()
      .default('staff'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('staff_users_username_normalized_unique').on(
      table.usernameNormalized,
    ),
    uniqueIndex('staff_users_email_normalized_unique').on(
      table.emailNormalized,
    ),
    uniqueIndex('staff_users_single_admin_unique')
      .on(table.role)
      .where(sql`${table.role} = 'admin'`),
  ],
);

export const staffSessions = sqliteTable('staff_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => staffUsers.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const loginAttempts = sqliteTable('login_attempts', {
  keyHash: text('key_hash').primaryKey(),
  failures: integer('failures').notNull().default(0),
  blockedUntil: integer('blocked_until').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});
