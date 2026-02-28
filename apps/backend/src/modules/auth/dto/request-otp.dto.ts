import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class RequestOtpDTO {
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại !' })
  @IsPhoneNumber('VN', {
    message: 'Ứng dụng hiện chỉ hỗ trợ số điện thoại Việt Nam !',
  })
  phone: string;
}
