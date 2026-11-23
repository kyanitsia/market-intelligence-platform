export const CHART_RANGES = ['1D', '1W', '1M', '1Y'] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

export const MAX_CHART_POINTS = 1000;

const RANGE_MS: Record<Exclude<ChartRange, '1D'>, number> = {
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
};

export function rangeStart(range: Exclude<ChartRange, '1D'>, now: Date): Date {
  return new Date(now.getTime() - RANGE_MS[range]);
}

export function downsample<T>(rows: T[], max = MAX_CHART_POINTS): T[] {
  if (rows.length <= max) {
    return rows;
  }

  const step = Math.ceil(rows.length / max);
  const picked = rows.filter((_, index) => index % step === 0);
  const last = rows[rows.length - 1];

  if (picked[picked.length - 1] !== last) {
    picked.push(last);
  }

  return picked.length > max ? [...picked.slice(0, max - 1), last] : picked;
}

/** Yesterday's close: the latest daily bucket that started before today (UTC). */
export function priorClose<T extends { bucket: Date; close: string }>(
  candles: T[],
  now: Date,
): string | null {
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const previous = [...candles]
    .reverse()
    .find((candle) => candle.bucket.getTime() < startOfToday);

  return previous?.close ?? candles[candles.length - 1]?.close ?? null;
}
