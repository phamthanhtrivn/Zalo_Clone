import { IsPhoneNumber, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber('VN')
  phone: string;

  @Length(6, 6)
  otp: string;
}
