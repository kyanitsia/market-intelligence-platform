import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import { portfolios } from '../database/schema';
import type { CreatePortfolioDto } from './dto/create-portfolio.dto';
import type { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import type { PortfolioResponse } from './portfolios.types';
import { PortfolioValuationService } from './valuation/portfolio-valuation.service';
import { assignPortfolioAllocations } from './valuation/value-holdings';
import type { PortfolioValuation } from './valuation/valuation.types';

export const DEFAULT_PORTFOLIO_NAME = 'Default';

type PortfolioRow = Omit<PortfolioResponse, 'valuation'>;

const portfolioColumns = {
  id: portfolios.id,
  name: portfolios.name,
  version: portfolios.version,
  visibility: portfolios.visibility,
  shareMode: portfolios.shareMode,
  createdAt: portfolios.createdAt,
  updatedAt: portfolios.updatedAt,
};

@Injectable()
export class PortfoliosService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
    private readonly valuation: PortfolioValuationService,
  ) {}

  async listForUser(userId: string): Promise<PortfolioResponse[]> {
    const rows = await this.database
      .select(portfolioColumns)
      .from(portfolios)
      .where(and(eq(portfolios.userId, userId), isNull(portfolios.deletedAt)))
      .orderBy(asc(portfolios.createdAt));

    return this.withValuations(userId, rows);
  }

  async findOneForUser(
    userId: string,
    portfolioId: string,
  ): Promise<PortfolioResponse> {
    const [portfolio] = await this.database
      .select(portfolioColumns)
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

    return this.withValuation(userId, portfolio);
  }

  async createForUser(
    userId: string,
    dto: CreatePortfolioDto,
  ): Promise<PortfolioResponse> {
    const [created] = await this.database
      .insert(portfolios)
      .values({
        userId,
        name: this.normalizeName(dto.name),
      })
      .returning(portfolioColumns);

    return this.withValuation(userId, created);
  }

  async updateForUser(
    userId: string,
    portfolioId: string,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioResponse> {
    const [updated] = await this.database
      .update(portfolios)
      .set({
        name: this.normalizeName(dto.name),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portfolios.id, portfolioId),
          eq(portfolios.userId, userId),
          isNull(portfolios.deletedAt),
        ),
      )
      .returning(portfolioColumns);

    if (!updated) {
      throw new NotFoundException('Portfolio not found');
    }

    return this.withValuation(userId, updated);
  }

  async softDeleteForUser(userId: string, portfolioId: string): Promise<void> {
    const now = new Date();
    const result = await this.database
      .update(portfolios)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(portfolios.id, portfolioId),
          eq(portfolios.userId, userId),
          isNull(portfolios.deletedAt),
        ),
      )
      .returning({ id: portfolios.id });

    if (result.length === 0) {
      throw new NotFoundException('Portfolio not found');
    }
  }

  /**
   * Creates the optional default portfolio for a newly registered user.
   * Prefer calling inside the same DB transaction as user creation.
   */
  async createDefaultForUser(
    userId: string,
    executor: Pick<Database, 'insert'> = this.database,
  ): Promise<void> {
    await executor.insert(portfolios).values({
      userId,
      name: DEFAULT_PORTFOLIO_NAME,
    });
  }

  private async withValuation(
    userId: string,
    portfolio: PortfolioRow,
  ): Promise<PortfolioResponse> {
    const [valued] = await this.withValuations(userId, [portfolio]);
    return valued;
  }

  private async withValuations(
    userId: string,
    rows: PortfolioRow[],
  ): Promise<PortfolioResponse[]> {
    const idRows = await this.database
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(and(eq(portfolios.userId, userId), isNull(portfolios.deletedAt)))
      .orderBy(asc(portfolios.createdAt));
    const summaries = await this.valuation.summarize(
      userId,
      idRows.map((row) => row.id),
    );

    assignPortfolioAllocations(summaries);

    return rows.map((row) => ({
      ...row,
      valuation: summaries.get(row.id) as PortfolioValuation,
    }));
  }

  private normalizeName(name: string): string {
    return name.trim();
  }
}
