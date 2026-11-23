import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { assets } from './assets.schema';
import { alertOperatorEnum } from './enums';
import { users } from './users.schema';

export const priceAlerts = pgTable(
  'price_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),

    operator: alertOperatorEnum('operator').notNull(),

    targetPrice: decimal('target_price', {
      precision: 30,
      scale: 12,
    }).notNull(),

    active: boolean('active').notNull().default(true),

    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),

    cooldownMinutes: integer('cooldown_minutes').notNull().default(60),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('price_alerts_user_id_idx').on(table.userId),
    index('price_alerts_asset_active_idx').on(table.assetId, table.active),
  ],
);

export type PriceAlert = typeof priceAlerts.$inferSelect;
