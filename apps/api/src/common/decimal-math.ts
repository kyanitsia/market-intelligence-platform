const MONEY_SCALE = 12;
const PERCENT_SCALE = 8;

export class DecimalValue {
  constructor(
    readonly unscaled: bigint,
    readonly scale: number,
  ) {}

  static parse(value: string): DecimalValue {
    const trimmed = value.trim();
    const negative = trimmed.startsWith('-');
    const raw = negative ? trimmed.slice(1) : trimmed;

    if (!/^\d+(?:\.\d+)?$/.test(raw)) {
      throw new Error(`Invalid decimal: ${value}`);
    }

    const [intPart, fracPart = ''] = raw.split('.');
    const digits = BigInt(`${intPart}${fracPart}`);
    const unscaled = negative && digits !== 0n ? -digits : digits;

    return new DecimalValue(unscaled, fracPart.length);
  }

  static zero(): DecimalValue {
    return new DecimalValue(0n, 0);
  }

  isZero(): boolean {
    return this.unscaled === 0n;
  }

  add(other: DecimalValue): DecimalValue {
    const [left, right, scale] = this.align(other);
    return new DecimalValue(left + right, scale);
  }

  sub(other: DecimalValue): DecimalValue {
    const [left, right, scale] = this.align(other);
    return new DecimalValue(left - right, scale);
  }

  mul(other: DecimalValue): DecimalValue {
    return new DecimalValue(
      this.unscaled * other.unscaled,
      this.scale + other.scale,
    );
  }

  div(other: DecimalValue, resultScale: number): DecimalValue | null {
    if (other.unscaled === 0n) {
      return null;
    }

    const numerator = this.unscaled * 10n ** BigInt(other.scale + resultScale);
    const denominator = other.unscaled * 10n ** BigInt(this.scale);

    return new DecimalValue(
      divRoundHalfAwayFromZero(numerator, denominator),
      resultScale,
    );
  }

  rescale(newScale: number): DecimalValue {
    if (newScale === this.scale) {
      return this;
    }

    if (newScale > this.scale) {
      return new DecimalValue(
        this.unscaled * 10n ** BigInt(newScale - this.scale),
        newScale,
      );
    }

    const factor = 10n ** BigInt(this.scale - newScale);
    return new DecimalValue(
      divRoundHalfAwayFromZero(this.unscaled, factor),
      newScale,
    );
  }

  toString(): string {
    if (this.unscaled === 0n) {
      return '0';
    }

    const negative = this.unscaled < 0n;
    const abs = negative ? -this.unscaled : this.unscaled;
    const padded = abs.toString().padStart(this.scale + 1, '0');

    if (this.scale === 0) {
      return `${negative ? '-' : ''}${padded}`;
    }

    const intPart = padded
      .slice(0, padded.length - this.scale)
      .replace(/^0+(?=\d)/, '');
    const frac = padded.slice(padded.length - this.scale).replace(/0+$/, '');
    const body = frac.length > 0 ? `${intPart}.${frac}` : intPart;

    return negative ? `-${body}` : body;
  }

  private align(other: DecimalValue): [bigint, bigint, number] {
    const scale = Math.max(this.scale, other.scale);
    return [this.rescale(scale).unscaled, other.rescale(scale).unscaled, scale];
  }

  compare(other: DecimalValue): number {
    const [left, right] = this.align(other);

    if (left === right) {
      return 0;
    }

    return left < right ? -1 : 1;
  }
}

export function addDecimal(left: string, right: string): string {
  return DecimalValue.parse(left).add(DecimalValue.parse(right)).toString();
}

export function subDecimal(left: string, right: string): string {
  return DecimalValue.parse(left).sub(DecimalValue.parse(right)).toString();
}

export function mulDecimal(left: string, right: string): string {
  return DecimalValue.parse(left)
    .mul(DecimalValue.parse(right))
    .rescale(MONEY_SCALE)
    .toString();
}

export function divDecimal(
  left: string,
  right: string,
  scale = MONEY_SCALE,
): string | null {
  const result = DecimalValue.parse(left).div(DecimalValue.parse(right), scale);
  return result?.toString() ?? null;
}

export function percentOf(part: string, whole: string): string | null {
  const ratio = DecimalValue.parse(part).div(
    DecimalValue.parse(whole),
    PERCENT_SCALE + 2,
  );

  if (!ratio) {
    return null;
  }

  return ratio.mul(DecimalValue.parse('100')).rescale(PERCENT_SCALE).toString();
}

export function isZeroDecimalString(value: string): boolean {
  return DecimalValue.parse(value).isZero();
}

export function cmpDecimal(left: string, right: string): number {
  return DecimalValue.parse(left).compare(DecimalValue.parse(right));
}

function divRoundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator < 0n) {
    return divRoundHalfAwayFromZero(-numerator, -denominator);
  }

  if (numerator >= 0n) {
    return (numerator + denominator / 2n) / denominator;
  }

  return (numerator - denominator / 2n) / denominator;
}
