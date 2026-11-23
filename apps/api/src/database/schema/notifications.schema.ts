import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users.schema';

export type PriceAlertNotification = {
  alertId: string;
  assetId: string;
  symbol: string;
  price: string;
  operator: 'GTE' | 'LTE';
  targetPrice: string;
  dedupeKey?: string;
};

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: varchar('type', { length: 40 }).notNull(),

    payload: jsonb('payload').$type<PriceAlertNotification>().notNull(),

    readAt: timestamp('read_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
