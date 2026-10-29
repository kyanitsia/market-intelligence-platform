import {
  decimal,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { assets } from './assets.schema';
import { currencyEnum } from './enums';

export const assetPrices = pgTable(
  'asset_prices',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),

    currency: currencyEnum('currency').notNull(),

    price: decimal('price', {
      precision: 30,
      scale: 12,
    }).notNull(),

    asOf: timestamp('as_of', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('asset_prices_asset_currency_unique').on(
      table.assetId,
      table.currency,
    ),
    index('asset_prices_asset_id_idx').on(table.assetId),
  ],
);

export type AssetPrice = typeof assetPrices.$inferSelect;
