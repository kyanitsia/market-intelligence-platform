import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmGoogleLinkDto {
  @IsString()
  @MinLength(1)
  linkToken!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
