import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import { portfolios } from '../database/schema';
import type { CreatePortfolioDto } from './dto/create-portfolio.dto';
import type { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import type { PortfolioResponse } from './portfolios.types';

export const DEFAULT_PORTFOLIO_NAME = 'Default';

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
  ) {}

  async listForUser(userId: string): Promise<PortfolioResponse[]> {
    return this.database
      .select(portfolioColumns)
      .from(portfolios)
      .where(and(eq(portfolios.userId, userId), isNull(portfolios.deletedAt)))
      .orderBy(asc(portfolios.createdAt));
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

    return portfolio;
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

    return created;
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

    return updated;
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

  private normalizeName(name: string): string {
    return name.trim();
  }
}
