import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacyDto {
  @IsOptional()
  @IsBoolean()
  hideActiveStatus?: boolean;
}
