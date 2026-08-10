import { pgEnum } from 'drizzle-orm/pg-core';

export const currencyEnum = pgEnum('currency', ['USD', 'EUR']);

export const assetTypeEnum = pgEnum('asset_type', ['CRYPTO', 'STOCK', 'ETF']);

export const assetStatusEnum = pgEnum('asset_status', ['ACTIVE', 'INACTIVE']);

export const portfolioVisibilityEnum = pgEnum('portfolio_visibility', [
  'PRIVATE',
  'PUBLIC',
  'FOLLOWERS_ONLY',
]);

export const portfolioShareModeEnum = pgEnum('portfolio_share_mode', [
  'FULL',
  'ALLOCATION_ONLY',
  'HIDDEN',
]);

export const transactionTypeEnum = pgEnum('transaction_type', ['BUY', 'SELL']);

export const alertOperatorEnum = pgEnum('alert_operator', ['GTE', 'LTE']);
