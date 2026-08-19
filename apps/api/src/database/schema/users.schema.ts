import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { currencyEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),

    displayName: varchar('display_name', { length: 120 }),
    avatarUrl: varchar('avatar_url', { length: 2048 }),

    defaultCurrency: currencyEnum('default_currency').notNull().default('USD'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_created_at_idx').on(table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
