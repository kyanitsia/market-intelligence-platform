import {
    date,
    decimal,
    index,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
  } from 'drizzle-orm/pg-core';
  
  import {
    portfolioShareModeEnum,
    portfolioVisibilityEnum,
  } from './enums';
  import { assets } from './assets.schema';
  import { users } from './users.schema';
  
  export const portfolios = pgTable(
    'portfolios',
    {
      id: uuid('id').defaultRandom().primaryKey(),
  
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
  
      name: varchar('name', { length: 120 }).notNull(),
  
      version: integer('version').notNull().default(1),
  
      visibility: portfolioVisibilityEnum('visibility')
        .notNull()
        .default('PRIVATE'),
  
      shareMode: portfolioShareModeEnum('share_mode')
        .notNull()
        .default('HIDDEN'),
  
      createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
  
      updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
  
      deletedAt: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => [
      index('portfolios_user_id_idx').on(table.userId),
      index('portfolios_user_deleted_idx').on(
        table.userId,
        table.deletedAt,
      ),
    ],
  );
  
  export const holdings = pgTable(
    'holdings',
    {
      id: uuid('id').defaultRandom().primaryKey(),
  
      portfolioId: uuid('portfolio_id')
        .notNull()
        .references(() => portfolios.id, { onDelete: 'cascade' }),
  
      assetId: uuid('asset_id')
        .notNull()
        .references(() => assets.id),
  
      quantity: decimal('quantity', {
        precision: 30,
        scale: 12,
      }).notNull(),
  
      avgCostBasis: decimal('avg_cost_basis', {
        precision: 30,
        scale: 12,
      }).notNull(),
    },
    (table) => [
      uniqueIndex('holdings_portfolio_asset_unique').on(
        table.portfolioId,
        table.assetId,
      ),
  
      index('holdings_portfolio_id_idx').on(table.portfolioId),
    ],
  );
  
  export const portfolioSnapshots = pgTable(
    'portfolio_snapshots',
    {
      id: uuid('id').defaultRandom().primaryKey(),
  
      portfolioId: uuid('portfolio_id')
        .notNull()
        .references(() => portfolios.id, { onDelete: 'cascade' }),
  
      totalValue: decimal('total_value', {
        precision: 30,
        scale: 12,
      }).notNull(),
  
      peakValue: decimal('peak_value', {
        precision: 30,
        scale: 12,
      }).notNull(),
  
      capturedOn: date('captured_on').notNull(),
    },
    (table) => [
      uniqueIndex('portfolio_snapshots_portfolio_date_unique').on(
        table.portfolioId,
        table.capturedOn,
      ),
  
      index('portfolio_snapshots_portfolio_date_idx').on(
        table.portfolioId,
        table.capturedOn,
      ),
    ],
  );