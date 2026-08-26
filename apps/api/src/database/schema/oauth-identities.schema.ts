import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users.schema';

export const oauthIdentities = pgTable(
  'oauth_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    provider: varchar('provider', { length: 32 }).notNull(),
    providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_identities_provider_user_unique').on(
      table.provider,
      table.providerUserId,
    ),
    index('oauth_identities_user_id_idx').on(table.userId),
  ],
);
