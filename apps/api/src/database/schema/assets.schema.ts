import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { assetStatusEnum, assetTypeEnum } from './enums';

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    symbol: varchar('symbol', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),

    assetType: assetTypeEnum('asset_type').notNull(),

    externalProvider: varchar('external_provider', {
      length: 50,
    }).notNull(),

    externalId: varchar('external_id', {
      length: 255,
    }).notNull(),

    status: assetStatusEnum('status').notNull().default('ACTIVE'),
  },
  (table) => [
    uniqueIndex('assets_symbol_type_unique').on(table.symbol, table.assetType),

    uniqueIndex('assets_provider_external_id_unique').on(
      table.externalProvider,
      table.externalId,
    ),
  ],
);

export type Asset = typeof assets.$inferSelect;
