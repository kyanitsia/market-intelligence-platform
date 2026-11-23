import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.types';
import { notifications, priceAlerts } from '../../database/schema';
import type { PriceSnapshot } from '../market-data/market-data';
import { isCoolingDown, isThresholdMet } from './alert-rule';
import type { NotificationMessage } from './notification-message';

@Injectable()
export class AlertEvaluationService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async plan(snapshot: PriceSnapshot): Promise<NotificationMessage[]> {
    const triggeredAt = new Date(snapshot.fetchedAt);

    if (Number.isNaN(triggeredAt.getTime())) {
      throw new Error('Price update fetchedAt is invalid');
    }

    const alerts = await this.database
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.assetId, snapshot.assetId),
          eq(priceAlerts.active, true),
        ),
      );
    const messages: NotificationMessage[] = [];

    for (const alert of alerts) {
      const target = Number(alert.targetPrice);

      if (
        !isThresholdMet(alert.operator, snapshot.price, target) ||
        isCoolingDown(alert.lastTriggeredAt, triggeredAt, alert.cooldownMinutes)
      ) {
        continue;
      }

      messages.push({
        userId: alert.userId,
        alertId: alert.id,
        assetId: snapshot.assetId,
        symbol: snapshot.symbol,
        price: String(snapshot.price),
        operator: alert.operator,
        targetPrice: alert.targetPrice,
        dedupeKey: `${alert.id}:${snapshot.fetchedAt}`,
        triggeredAt: snapshot.fetchedAt,
      });
    }

    return messages;
  }

  /**
   * Inserts the notification once. A redelivered message with the same
   * dedupe key, or a trigger still inside the cooldown, is acknowledged.
   */
  async store(message: NotificationMessage): Promise<void> {
    const triggeredAt = new Date(message.triggeredAt);

    if (Number.isNaN(triggeredAt.getTime())) {
      throw new Error('Notification triggeredAt is invalid');
    }

    const [alert] = await this.database
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.id, message.alertId))
      .limit(1);

    if (!alert?.active) {
      return;
    }

    if (
      isCoolingDown(alert.lastTriggeredAt, triggeredAt, alert.cooldownMinutes)
    ) {
      return;
    }

    const [existing] = await this.database
      .select({ id: notifications.id })
      .from(notifications)
      .where(sql`${notifications.payload}->>'dedupeKey' = ${message.dedupeKey}`)
      .limit(1);

    if (existing) {
      return;
    }

    await this.database.transaction(async (tx) => {
      await tx.insert(notifications).values({
        userId: message.userId,
        type: 'PRICE_ALERT',
        payload: {
          alertId: message.alertId,
          assetId: message.assetId,
          symbol: message.symbol,
          price: message.price,
          operator: message.operator,
          targetPrice: message.targetPrice,
          dedupeKey: message.dedupeKey,
        },
      });
      await tx
        .update(priceAlerts)
        .set({ lastTriggeredAt: triggeredAt })
        .where(eq(priceAlerts.id, message.alertId));
    });
  }
}
