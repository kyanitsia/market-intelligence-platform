export const DEFAULT_COOLDOWN_MINUTES = 60;

export type AlertOperator = 'GTE' | 'LTE';

export function isThresholdMet(
  operator: AlertOperator,
  price: number,
  target: number,
): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(target)) {
    return false;
  }

  return operator === 'GTE' ? price >= target : price <= target;
}

/** True while the cooldown window is still open. The boundary itself may fire again. */
export function isCoolingDown(
  lastTriggeredAt: Date | null,
  now: Date,
  cooldownMinutes: number,
): boolean {
  if (!lastTriggeredAt) {
    return false;
  }

  return now.getTime() - lastTriggeredAt.getTime() < cooldownMinutes * 60_000;
}
