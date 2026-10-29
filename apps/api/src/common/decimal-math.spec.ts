import {
  addDecimal,
  cmpDecimal,
  divDecimal,
  mulDecimal,
  percentOf,
  subDecimal,
} from './decimal-math';

describe('decimal math', () => {
  it('multiplies quantity by price at money scale', () => {
    expect(mulDecimal('1.5', '42000')).toBe('63000');
    expect(mulDecimal('2', '15.5')).toBe('31');
  });

  it('adds and subtracts signed values', () => {
    expect(addDecimal('30', '80')).toBe('110');
    expect(subDecimal('30', '20')).toBe('10');
    expect(subDecimal('80', '100')).toBe('-20');
  });

  it('divides with rounding and rejects a zero divisor', () => {
    expect(divDecimal('1', '4')).toBe('0.25');
    expect(divDecimal('10', '0')).toBeNull();
  });

  it('compares decimal strings', () => {
    expect(cmpDecimal('1.50', '1.5')).toBe(0);
    expect(cmpDecimal('2', '1.5')).toBe(1);
    expect(cmpDecimal('1', '1.5')).toBe(-1);
  });

  it('computes percentages', () => {
    expect(percentOf('10', '20')).toBe('50');
    expect(percentOf('30', '110')).toBe('27.27272727');
    expect(percentOf('10', '0')).toBeNull();
  });
});
