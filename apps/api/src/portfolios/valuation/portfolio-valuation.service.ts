import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.types';
import { assets, holdings, users, type Asset } from '../../database/schema';
import { PricesService } from '../../prices';
import type {
  HoldingAssetResponse,
  HoldingResponse,
} from '../holdings/holdings.types';
import {
  emptyPortfolioValuation,
  valueHoldings,
  type ValuationHoldingRow,
} from './value-holdings';
import {
  DEFAULT_PRICE_STALE_AFTER_MS,
  type Currency,
  type PortfolioValuation,
} from './valuation.types';

@Injectable()
export class PortfolioValuationService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
    private readonly pricesService: PricesService,
    private readonly configService: ConfigService,
  ) {}

  async valueRows(
    userId: string,
    rows: ValuationHoldingRow[],
  ): Promise<HoldingResponse[]> {
    const { holdings: valued } = await this.value(userId, rows);
    return valued;
  }

  async summarize(
    userId: string,
    portfolioIds: string[],
  ): Promise<Map<string, PortfolioValuation>> {
    const currency = await this.userCurrency(userId);
    const summaries = new Map<string, PortfolioValuation>();

    for (const portfolioId of portfolioIds) {
      summaries.set(portfolioId, emptyPortfolioValuation(currency));
    }

    if (portfolioIds.length === 0) {
      return summaries;
    }

    const rows = await this.loadRows(portfolioIds);
    const uniqueAssets = this.uniqueAssets(rows);
    const prices = await this.pricesService.getLatestForAssets(
      uniqueAssets,
      currency,
      this.staleAfterMs(),
    );
    const options = {
      currency,
      now: new Date(),
      staleAfterMs: this.staleAfterMs(),
    };

    const byPortfolio = new Map<string, ValuationHoldingRow[]>();

    for (const row of rows) {
      const group = byPortfolio.get(row.holding.portfolioId) ?? [];
      group.push(row);
      byPortfolio.set(row.holding.portfolioId, group);
    }

    for (const portfolioId of portfolioIds) {
      const valued = valueHoldings(
        byPortfolio.get(portfolioId) ?? [],
        prices,
        options,
      );
      summaries.set(portfolioId, valued.portfolio);
    }

    return summaries;
  }

  private async value(userId: string, rows: ValuationHoldingRow[]) {
    const currency = await this.userCurrency(userId);
    const prices = await this.pricesService.getLatestForAssets(
      this.uniqueAssets(rows),
      currency,
      this.staleAfterMs(),
    );

    return valueHoldings(rows, prices, {
      currency,
      now: new Date(),
      staleAfterMs: this.staleAfterMs(),
    });
  }

  private async loadRows(
    portfolioIds: string[],
  ): Promise<ValuationHoldingRow[]> {
    const rows = await this.database
      .select({
        holding: holdings,
        asset: assets,
      })
      .from(holdings)
      .innerJoin(assets, eq(holdings.assetId, assets.id))
      .where(inArray(holdings.portfolioId, portfolioIds));

    return rows.map((row) => ({
      holding: row.holding,
      asset: this.toAssetResponse(row.asset),
    }));
  }

  private uniqueAssets(rows: ValuationHoldingRow[]): Asset[] {
    const byId = new Map<string, Asset>();

    for (const row of rows) {
      if (!byId.has(row.asset.id)) {
        byId.set(row.asset.id, {
          id: row.asset.id,
          symbol: row.asset.symbol,
          name: row.asset.name,
          assetType: row.asset.assetType,
          externalProvider: row.asset.externalProvider,
          externalId: row.asset.externalId,
          status: row.asset.status,
        });
      }
    }

    return [...byId.values()];
  }

  private toAssetResponse(asset: Asset): HoldingAssetResponse {
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      externalProvider: asset.externalProvider,
      externalId: asset.externalId,
      status: asset.status,
    };
  }

  private async userCurrency(userId: string): Promise<Currency> {
    const [user] = await this.database
      .select({ defaultCurrency: users.defaultCurrency })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.defaultCurrency ?? 'USD';
  }

  private staleAfterMs(): number {
    const parsed = Number(
      this.configService.get('PRICE_STALE_AFTER_MS') ??
        DEFAULT_PRICE_STALE_AFTER_MS,
    );

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_PRICE_STALE_AFTER_MS;
  }
}
