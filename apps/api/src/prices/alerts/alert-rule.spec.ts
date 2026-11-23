import { isCoolingDown, isThresholdMet } from './alert-rule';

describe('price alert rule', () => {
  const now = new Date('2026-11-20T12:00:00.000Z');

  it('fires at or beyond the threshold and ignores a bad price', () => {
    expect(isThresholdMet('GTE', 10, 10)).toBe(true);
    expect(isThresholdMet('GTE', 9.99, 10)).toBe(false);
    expect(isThresholdMet('LTE', 10, 10)).toBe(true);
    expect(isThresholdMet('LTE', 10.01, 10)).toBe(false);
    expect(isThresholdMet('GTE', Number.NaN, 10)).toBe(false);
  });

  it('stays quiet inside the cooldown and fires again on the boundary', () => {
    const last = new Date(now.getTime() - 60 * 60 * 1000);

    expect(isCoolingDown(null, now, 60)).toBe(false);
    expect(isCoolingDown(new Date(now.getTime() - 59 * 60 * 1000), now, 60)).toBe(
      true,
    );
    expect(isCoolingDown(last, now, 60)).toBe(false);
  });
});
