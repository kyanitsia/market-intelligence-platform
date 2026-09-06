import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.types';
import {
  assets,
  holdings,
  portfolios,
  type Asset,
  type Holding,
} from '../../database/schema';
import {
  assertCreateHoldingAmounts,
  type CreateHoldingDto,
} from './dto/create-holding.dto';
import {
  POSTGRES_UNIQUE_VIOLATION,
  UNIQUE_VIOLATION_CAUSE_MAX_DEPTH,
} from './holdings.constants';
import {
  DEFAULT_ASSET_PROVIDERS,
  type HoldingAssetInput,
  type HoldingResponse,
} from './holdings.types';

@Injectable()
export class HoldingsService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async listForUser(
    userId: string,
    portfolioId: string,
  ): Promise<HoldingResponse[]> {
    await this.requirePortfolio(userId, portfolioId);

    const rows = await this.database
      .select({
        holding: holdings,
        asset: assets,
      })
      .from(holdings)
      .innerJoin(assets, eq(holdings.assetId, assets.id))
      .where(eq(holdings.portfolioId, portfolioId))
      .orderBy(asc(assets.symbol));

    return rows.map((row) => this.toResponse(row.holding, row.asset));
  }

  async createForUser(
    userId: string,
    portfolioId: string,
    dto: CreateHoldingDto,
  ): Promise<HoldingResponse> {
    assertCreateHoldingAmounts(dto);
    await this.requirePortfolio(userId, portfolioId);

    const asset = await this.findOrCreateAsset(dto.asset);

    try {
      const [created] = await this.database
        .insert(holdings)
        .values({
          portfolioId,
          assetId: asset.id,
          quantity: dto.quantity,
          avgCostBasis: dto.avgCostBasis,
          acquiredOn: dto.acquiredOn,
        })
        .returning();

      await this.touchPortfolio(userId, portfolioId);

      return this.toResponse(created, asset);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This asset is already in the portfolio');
      }

      throw error;
    }
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

  private async touchPortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<void> {
    await this.database
      .update(portfolios)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(portfolios.id, portfolioId),
          eq(portfolios.userId, userId),
          isNull(portfolios.deletedAt),
        ),
      );
  }

  private async findOrCreateAsset(input: HoldingAssetInput): Promise<Asset> {
    const resolved = this.resolveAssetInput(input);
    const existing = await this.findExistingAsset(resolved);

    if (existing) {
      return this.assertAssetMatches(existing, resolved);
    }

    try {
      const [created] = await this.database
        .insert(assets)
        .values({
          symbol: resolved.symbol,
          name: resolved.name,
          assetType: resolved.assetType,
          externalProvider: resolved.externalProvider,
          externalId: resolved.externalId,
        })
        .returning();

      return created;
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const raced = await this.findExistingAsset(resolved);

      if (raced) {
        return this.assertAssetMatches(raced, resolved);
      }

      throw error;
    }
  }

  private async findExistingAsset(
    input: ResolvedAssetInput,
  ): Promise<Asset | undefined> {
    const [byExternal] = await this.database
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.externalProvider, input.externalProvider),
          eq(assets.externalId, input.externalId),
        ),
      )
      .limit(1);

    const [bySymbol] = await this.database
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.symbol, input.symbol),
          eq(assets.assetType, input.assetType),
        ),
      )
      .limit(1);

    if (byExternal && bySymbol && byExternal.id !== bySymbol.id) {
      throw new ConflictException(
        'Asset identity does not match an existing catalog entry',
      );
    }

    return byExternal ?? bySymbol;
  }

  private assertAssetMatches(
    existing: Asset,
    input: ResolvedAssetInput,
  ): Asset {
    if (
      existing.symbol !== input.symbol ||
      existing.assetType !== input.assetType ||
      existing.externalProvider !== input.externalProvider ||
      existing.externalId !== input.externalId
    ) {
      throw new ConflictException(
        'Asset identity does not match an existing catalog entry',
      );
    }

    if (existing.status !== 'ACTIVE') {
      throw new BadRequestException('This asset is inactive');
    }

    return existing;
  }

  private resolveAssetInput(input: HoldingAssetInput): ResolvedAssetInput {
    const symbol = input.symbol.trim().toUpperCase();
    const externalId = input.externalId.trim();
    const externalProvider = (
      input.externalProvider?.trim() || DEFAULT_ASSET_PROVIDERS[input.assetType]
    ).toLowerCase();
    const name = input.name?.trim() || symbol;

    return {
      symbol,
      name,
      assetType: input.assetType,
      externalProvider,
      externalId,
    };
  }

  private toResponse(holding: Holding, asset: Asset): HoldingResponse {
    return {
      id: holding.id,
      portfolioId: holding.portfolioId,
      quantity: holding.quantity,
      avgCostBasis: holding.avgCostBasis,
      acquiredOn: holding.acquiredOn,
      asset: {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        externalProvider: asset.externalProvider,
        externalId: asset.externalId,
        status: asset.status,
      },
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    let current: unknown = error;

    for (
      let depth = 0;
      depth < UNIQUE_VIOLATION_CAUSE_MAX_DEPTH && current;
      depth += 1
    ) {
      if (typeof current !== 'object' || current === null) {
        return false;
      }

      if ('code' in current && current.code === POSTGRES_UNIQUE_VIOLATION) {
        return true;
      }

      current = 'cause' in current ? current.cause : undefined;
    }

    return false;
  }
}

type ResolvedAssetInput = {
  symbol: string;
  name: string;
  assetType: HoldingAssetInput['assetType'];
  externalProvider: string;
  externalId: string;
};
