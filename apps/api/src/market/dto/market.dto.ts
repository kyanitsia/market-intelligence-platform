import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

import { CHART_RANGES, type ChartRange } from '../chart-range';

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/;

export class AddWatchlistItemDto {
  @IsUUID()
  assetId!: string;
}

export class CreatePriceAlertDto {
  @IsUUID()
  assetId!: string;

  @IsIn(['GTE', 'LTE'])
  operator!: 'GTE' | 'LTE';

  @IsString()
  @Matches(DECIMAL)
  targetPrice!: string;
}

export class UpdatePriceAlertDto {
  @IsOptional()
  @IsIn(['GTE', 'LTE'])
  operator?: 'GTE' | 'LTE';

  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  targetPrice?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export function parseChartRange(value: unknown): ChartRange {
  return CHART_RANGES.includes(value as ChartRange) ? (value as ChartRange) : '1M';
}
