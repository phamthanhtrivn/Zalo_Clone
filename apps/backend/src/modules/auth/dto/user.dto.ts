import { Profile } from 'src/modules/users/schemas/user.schema';

export class PublicUserDto {
  id: string;
  profile: Profile;
  lastSeenAt?: Date;
}
