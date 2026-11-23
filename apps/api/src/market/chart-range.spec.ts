import { downsample, priorClose, rangeStart } from './chart-range';

describe('chart range', () => {
  it('keeps short series and caps long ones at the last point', () => {
    expect(downsample([1, 2, 3], 5)).toEqual([1, 2, 3]);

    const rows = Array.from({ length: 2500 }, (_, index) => index);
    const picked = downsample(rows, 1000);

    expect(picked.length).toBeLessThanOrEqual(1000);
    expect(picked[picked.length - 1]).toBe(2499);
    expect(picked[0]).toBe(0);
  });

  it('uses the previous UTC day as the prior close', () => {
    const now = new Date('2026-11-20T15:00:00.000Z');
    const candles = [
      { bucket: new Date('2026-11-19T00:00:00.000Z'), close: '10' },
      { bucket: new Date('2026-11-20T00:00:00.000Z'), close: '12' },
    ];

    expect(priorClose(candles, now)).toBe('10');
    expect(rangeStart('1Y', now).toISOString()).toBe('2025-11-20T15:00:00.000Z');
  });
});
