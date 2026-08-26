import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsIn(['USD', 'EUR'])
  defaultCurrency?: 'USD' | 'EUR';
}
