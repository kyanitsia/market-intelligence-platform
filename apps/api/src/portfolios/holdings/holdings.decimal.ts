import { BadRequestException } from '@nestjs/common';

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/;

export function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value);
}

export function isZeroDecimal(value: string): boolean {
  return /^0+(?:\.0+)?$/.test(value);
}

export function normalizeDecimalInput(value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

export function assertQuantity(value: string): void {
  if (!isDecimalString(value) || isZeroDecimal(value)) {
    throw new BadRequestException('quantity must be greater than 0');
  }
}

export function assertCostBasis(value: string): void {
  if (!isDecimalString(value)) {
    throw new BadRequestException(
      'avgCostBasis must be greater than or equal to 0',
    );
  }
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return new Date(timestamp).toISOString().slice(0, 10) === value;
}
