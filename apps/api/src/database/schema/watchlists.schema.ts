import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { assets } from './assets.schema';
import { users } from './users.schema';

export const watchlists = pgTable(
  'watchlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 120 }).notNull().default('Watchlist'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('watchlists_user_id_unique').on(table.userId)],
);

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    watchlistId: uuid('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),

    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('watchlist_items_watchlist_asset_unique').on(
      table.watchlistId,
      table.assetId,
    ),
    index('watchlist_items_watchlist_id_idx').on(table.watchlistId),
  ],
);

export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
