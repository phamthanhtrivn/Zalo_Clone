import { Length } from 'class-validator';

export class VerifyOtpDto {
  phone: string;

  @Length(6, 6)
  otp: string;
}
