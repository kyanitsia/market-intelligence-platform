import { decimal, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { assets } from './assets.schema';
import { transactionTypeEnum } from './enums';
import { portfolios } from './portfolios.schema';

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id),

    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),

    type: transactionTypeEnum('type').notNull(),

    quantity: decimal('quantity', {
      precision: 30,
      scale: 12,
    }).notNull(),

    price: decimal('price', {
      precision: 30,
      scale: 12,
    }).notNull(),

    realizedPnl: decimal('realized_pnl', {
      precision: 30,
      scale: 12,
    }),

    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('transactions_portfolio_occurred_idx').on(
      table.portfolioId,
      table.occurredAt,
    ),

    index('transactions_portfolio_asset_idx').on(
      table.portfolioId,
      table.assetId,
    ),
  ],
);
