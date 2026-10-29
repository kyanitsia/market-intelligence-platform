import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { isZeroDecimalString } from '../../common/decimal-math';
import { DATABASE, type Database } from '../../database/database.types';
import {
  assets,
  holdings,
  portfolios,
  transactions,
  type Holding,
  type Transaction,
} from '../../database/schema';
import { PortfolioValuationService } from '../valuation/portfolio-valuation.service';
import { assertSellAmounts, type SellHoldingDto } from './dto/sell-holding.dto';
import {
  applyFifoSell,
  InsufficientQuantityError,
  remainingLotsFromLedger,
  type LedgerEntry,
} from './fifo';
import type { SellResponse, TransactionResponse } from './transactions.types';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
    private readonly valuation: PortfolioValuationService,
  ) {}

  async listForUser(
    userId: string,
    portfolioId: string,
  ): Promise<TransactionResponse[]> {
    await this.requirePortfolio(userId, portfolioId);

    const rows = await this.database
      .select()
      .from(transactions)
      .where(eq(transactions.portfolioId, portfolioId))
      .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt));

    return rows.map((row) => this.toResponse(row));
  }

  async sellForUser(
    userId: string,
    portfolioId: string,
    holdingId: string,
    dto: SellHoldingDto,
  ): Promise<SellResponse> {
    assertSellAmounts(dto);
    await this.requirePortfolio(userId, portfolioId);

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('occurredAt must be a valid ISO timestamp');
    }

    const sold = await this.database.transaction(async (tx) => {
      const [row] = await tx
        .select({
          holding: holdings,
          asset: assets,
        })
        .from(holdings)
        .innerJoin(assets, eq(holdings.assetId, assets.id))
        .where(
          and(
            eq(holdings.id, holdingId),
            eq(holdings.portfolioId, portfolioId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new NotFoundException('Holding not found');
      }

      const ledger = await this.loadLedger(
        tx,
        portfolioId,
        row.holding.assetId,
      );
      const entries = [...ledger];

      if (!entries.some((entry) => entry.type === 'BUY')) {
        await tx.insert(transactions).values({
          portfolioId,
          assetId: row.holding.assetId,
          type: 'BUY',
          quantity: row.holding.quantity,
          price: row.holding.avgCostBasis,
          occurredAt: dateToUtc(row.holding.acquiredOn),
        });

        entries.push({
          type: 'BUY',
          quantity: row.holding.quantity,
          price: row.holding.avgCostBasis,
          occurredAt: dateToUtc(row.holding.acquiredOn),
        });
      }

      let result;

      try {
        result = applyFifoSell(
          remainingLotsFromLedger(entries),
          dto.quantity,
          dto.price,
        );
      } catch (error: unknown) {
        if (error instanceof InsufficientQuantityError) {
          throw new BadRequestException(error.message);
        }

        throw error;
      }

      const [created] = await tx
        .insert(transactions)
        .values({
          portfolioId,
          assetId: row.holding.assetId,
          type: 'SELL',
          quantity: dto.quantity,
          price: dto.price,
          realizedPnl: result.realizedPnl,
          occurredAt,
        })
        .returning();

      const remainingHolding = await this.persistRemainingPosition(
        tx,
        row.holding,
        result.remainingQuantity,
        result.remainingAvgCostBasis,
        result.remainingLots[0]?.occurredAt,
      );

      await tx
        .update(portfolios)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(portfolios.id, portfolioId),
            eq(portfolios.userId, userId),
            isNull(portfolios.deletedAt),
          ),
        );

      return {
        transaction: created,
        holding: remainingHolding,
        asset: row.asset,
      };
    });

    if (!sold.holding) {
      return {
        transaction: this.toResponse(sold.transaction),
        holding: null,
      };
    }

    const [valued] = await this.valuation.valueRows(userId, [
      {
        holding: sold.holding,
        asset: {
          id: sold.asset.id,
          symbol: sold.asset.symbol,
          name: sold.asset.name,
          assetType: sold.asset.assetType,
          externalProvider: sold.asset.externalProvider,
          externalId: sold.asset.externalId,
          status: sold.asset.status,
        },
      },
    ]);

    return {
      transaction: this.toResponse(sold.transaction),
      holding: valued ?? null,
    };
  }

  private async persistRemainingPosition(
    tx: Pick<Database, 'update' | 'delete'>,
    holding: Holding,
    remainingQuantity: string,
    remainingAvgCostBasis: string,
    oldestRemainingAt?: Date,
  ): Promise<Holding | null> {
    if (isZeroDecimalString(remainingQuantity)) {
      await tx.delete(holdings).where(eq(holdings.id, holding.id));
      return null;
    }

    const acquiredOn = oldestRemainingAt
      ? oldestRemainingAt.toISOString().slice(0, 10)
      : holding.acquiredOn;

    const [updated] = await tx
      .update(holdings)
      .set({
        quantity: remainingQuantity,
        avgCostBasis: remainingAvgCostBasis,
        acquiredOn,
      })
      .where(eq(holdings.id, holding.id))
      .returning();

    return updated;
  }

  private async loadLedger(
    executor: Pick<Database, 'select'>,
    portfolioId: string,
    assetId: string,
  ): Promise<LedgerEntry[]> {
    const rows = await executor
      .select({
        type: transactions.type,
        quantity: transactions.quantity,
        price: transactions.price,
        occurredAt: transactions.occurredAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.portfolioId, portfolioId),
          eq(transactions.assetId, assetId),
        ),
      )
      .orderBy(
        asc(transactions.occurredAt),
        asc(transactions.createdAt),
        asc(transactions.id),
      );

    return rows;
  }

  private async requirePortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<void> {
    const [portfolio] = await this.database
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(
        and(
          eq(portfolios.id, portfolioId),
          eq(portfolios.userId, userId),
          isNull(portfolios.deletedAt),
        ),
      )
      .limit(1);

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
  }

  private toResponse(row: Transaction): TransactionResponse {
    return {
      id: row.id,
      portfolioId: row.portfolioId,
      assetId: row.assetId,
      type: row.type,
      quantity: row.quantity,
      price: row.price,
      realizedPnl: row.realizedPnl,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
    };
  }
}

function dateToUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}
