import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import {
  assertCostBasis,
  assertQuantity,
  isDecimalString,
  isIsoDate,
  isZeroDecimal,
  normalizeDecimalInput,
} from '../holdings.decimal';
import { ASSET_TYPES, type AssetType } from '../holdings.types';

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
    return 'avgCostBasis must be greater than or equal to 0';
  }
}

@ValidatorConstraint({ name: 'isIsoDate', async: false })
class IsIsoDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isIsoDate(value);
  }

  defaultMessage(): string {
    return 'acquiredOn must be a valid ISO date (YYYY-MM-DD)';
  }
}

export class HoldingAssetInputDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  symbol!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalId!: string;

  @IsIn(ASSET_TYPES)
  assetType!: AssetType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  externalProvider?: string;
}

export class CreateHoldingDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => HoldingAssetInputDto)
  asset!: HoldingAssetInputDto;

  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @Validate(IsPositiveDecimalConstraint)
  quantity!: string;

  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @Validate(IsNonNegativeDecimalConstraint)
  avgCostBasis!: string;

  @Validate(IsIsoDateConstraint)
  acquiredOn!: string;
}

export function assertCreateHoldingAmounts(dto: CreateHoldingDto): void {
  assertQuantity(dto.quantity);
  assertCostBasis(dto.avgCostBasis);
}
