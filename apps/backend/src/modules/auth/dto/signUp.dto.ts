import { Gender } from '@zalo-clone/shared-types';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
  Matches,
} from 'class-validator';
import { IsAtLeast14 } from 'src/common/decorator/check-valid-old.decorator';

export class SignUpDto {
  @IsPhoneNumber('VN')
  phone: string;

  @IsNotEmpty()
  @Matches(/^[A-ZÀ-Ỹ][a-zà-ỹ]*(\s[A-ZÀ-Ỹ][a-zà-ỹ]*)*$/, {
    message: 'Mỗi chữ cái đầu phải viết hoa',
  })
  name: string;

  @IsDateString()
  @IsAtLeast14({ message: 'Người dùng phải đủ 14 tuổi' })
  birthDay: Date;

  @IsEnum(Gender)
  gender: Gender;

  @IsNotEmpty()
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Password phải có ít nhất 8 ký tự, 1 chữ hoa, 1 số và 1 ký tự đặc biệt',
  })
  password: string;
}
