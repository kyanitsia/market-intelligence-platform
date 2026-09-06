import {
  isDecimalString,
  isIsoDate,
  isZeroDecimal,
  normalizeDecimalInput,
} from './holdings.decimal';

describe('holdings decimal helpers', () => {
  it('accepts non-negative decimals with up to 12 fractional digits', () => {
    expect(isDecimalString('0')).toBe(true);
    expect(isDecimalString('1.5')).toBe(true);
    expect(isDecimalString('0.000000000001')).toBe(true);
    expect(isDecimalString('-1')).toBe(false);
    expect(isDecimalString('1.1234567890123')).toBe(false);
  });

  it('detects zero decimals', () => {
    expect(isZeroDecimal('0')).toBe(true);
    expect(isZeroDecimal('0.0')).toBe(true);
    expect(isZeroDecimal('0.000000000001')).toBe(false);
  });

  it('normalizes numeric inputs to strings', () => {
    expect(normalizeDecimalInput(1.5)).toBe('1.5');
    expect(normalizeDecimalInput(' 2 ')).toBe('2');
  });

  it('validates calendar dates', () => {
    expect(isIsoDate('2024-03-01')).toBe(true);
    expect(isIsoDate('2024-02-30')).toBe(false);
    expect(isIsoDate('2024-03-01T00:00:00Z')).toBe(false);
  });
});
