import { IsString, MinLength } from 'class-validator';

export class ConfirmGoogleLinkDto {
  @IsString()
  @MinLength(1)
  linkToken!: string;
}
