import {
  decimal,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
  uuid,
} from 'drizzle-orm/pg-core';

import { assets } from './assets.schema';

export const assetCandles = pgTable(
  'asset_candles',
  {
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),

    interval: varchar('interval', { length: 8 }).notNull(),

    bucket: timestamp('bucket', { withTimezone: true }).notNull(),

    open: decimal('open', { precision: 30, scale: 12 }).notNull(),
    high: decimal('high', { precision: 30, scale: 12 }).notNull(),
    low: decimal('low', { precision: 30, scale: 12 }).notNull(),
    close: decimal('close', { precision: 30, scale: 12 }).notNull(),

    volume: decimal('volume', { precision: 30, scale: 12 }),
  },
  (table) => [
    primaryKey({
      name: 'asset_candles_pk',
      columns: [table.assetId, table.interval, table.bucket],
    }),
  ],
);

export type AssetCandle = typeof assetCandles.$inferSelect;
