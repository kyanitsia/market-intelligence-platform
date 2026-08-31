import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePortfolioDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
