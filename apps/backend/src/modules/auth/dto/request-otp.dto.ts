import { IsPhoneNumber } from 'class-validator';

export class RequestOtpDTO {
  @IsPhoneNumber('VN')
  phone: string;
}
