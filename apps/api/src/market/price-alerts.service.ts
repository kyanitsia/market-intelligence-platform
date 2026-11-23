import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import {
  assets,
  notifications,
  priceAlerts,
  type PriceAlert,
  type PriceAlertNotification,
} from '../database/schema';
import { DEFAULT_COOLDOWN_MINUTES } from '../prices/alerts/alert-rule';
import { AssetsService } from './assets.service';
import { toAssetResponse, type AssetResponse } from './asset-response';

export type PriceAlertResponse = {
  id: string;
  operator: 'GTE' | 'LTE';
  targetPrice: string;
  active: boolean;
  lastTriggeredAt: string | null;
  cooldownMinutes: number;
  createdAt: string;
  asset: AssetResponse;
};

export type NotificationResponse = {
  id: string;
  type: string;
  payload: PriceAlertNotification;
  readAt: string | null;
  createdAt: string;
};

@Injectable()
export class PriceAlertsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly assetsService: AssetsService,
  ) {}

  async list(userId: string): Promise<PriceAlertResponse[]> {
    const rows = await this.database
      .select({ alert: priceAlerts, asset: assets })
      .from(priceAlerts)
      .innerJoin(assets, eq(priceAlerts.assetId, assets.id))
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));

    return rows.map((row) => this.toResponse(row.alert, row.asset));
  }

  async create(
    userId: string,
    input: { assetId: string; operator: 'GTE' | 'LTE'; targetPrice: string },
  ): Promise<PriceAlertResponse> {
    const asset = await this.assetsService.requireAsset(input.assetId);
    const [alert] = await this.database
      .insert(priceAlerts)
      .values({
        userId,
        assetId: asset.id,
        operator: input.operator,
        targetPrice: input.targetPrice,
        cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
      })
      .returning();

    return this.toResponse(alert, asset);
  }

  async update(
    userId: string,
    alertId: string,
    input: { operator?: 'GTE' | 'LTE'; targetPrice?: string; active?: boolean },
  ): Promise<PriceAlertResponse> {
    const current = await this.requireOwned(userId, alertId);
    const [alert] = await this.database
      .update(priceAlerts)
      .set({
        operator: input.operator ?? current.operator,
        targetPrice: input.targetPrice ?? current.targetPrice,
        active: input.active ?? current.active,
      })
      .where(eq(priceAlerts.id, alertId))
      .returning();
    const asset = await this.assetsService.requireAsset(alert.assetId);

    return this.toResponse(alert, asset);
  }

  async remove(userId: string, alertId: string): Promise<void> {
    await this.requireOwned(userId, alertId);
    await this.database.delete(priceAlerts).where(eq(priceAlerts.id, alertId));
  }

  async listNotifications(userId: string): Promise<NotificationResponse[]> {
    const rows = await this.database
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const [row] = await this.database
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
      )
      .returning({ id: notifications.id });

    if (!row) {
      throw new NotFoundException('Notification not found');
    }
  }

  private async requireOwned(userId: string, alertId: string): Promise<PriceAlert> {
    const [alert] = await this.database
      .select()
      .from(priceAlerts)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .limit(1);

    if (!alert) {
      throw new NotFoundException('Price alert not found');
    }

    return alert;
  }

  private toResponse(
    alert: PriceAlert,
    asset: Parameters<typeof toAssetResponse>[0],
  ): PriceAlertResponse {
    return {
      id: alert.id,
      operator: alert.operator,
      targetPrice: alert.targetPrice,
      active: alert.active,
      lastTriggeredAt: alert.lastTriggeredAt
        ? alert.lastTriggeredAt.toISOString()
        : null,
      cooldownMinutes: alert.cooldownMinutes,
      createdAt: alert.createdAt.toISOString(),
      asset: toAssetResponse(asset),
    };
  }
}
