import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import {
  assertPrice,
  assertQuantity,
  isDecimalString,
  isZeroDecimal,
  normalizeDecimalInput,
} from '../../holdings/holdings.decimal';

@ValidatorConstraint({ name: 'isPositiveDecimal', async: false })
class IsPositiveDecimalConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isDecimalString(value) && !isZeroDecimal(value);
  }

  defaultMessage(): string {
    return 'quantity must be greater than 0';
  }
}

@ValidatorConstraint({ name: 'isNonNegativeDecimal', async: false })
class IsNonNegativeDecimalConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isDecimalString(value);
  }

  defaultMessage(): string {
    return 'price must be greater than or equal to 0';
  }
}

export class SellHoldingDto {
  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @Validate(IsPositiveDecimalConstraint)
  quantity!: string;

  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @Validate(IsNonNegativeDecimalConstraint)
  price!: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export function assertSellAmounts(dto: SellHoldingDto): void {
  assertQuantity(dto.quantity);
  assertPrice(dto.price);
}
