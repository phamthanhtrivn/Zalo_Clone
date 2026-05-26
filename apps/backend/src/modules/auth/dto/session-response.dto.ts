import { Expose } from 'class-transformer';

export class SessionResponseDTO {
  @Expose()
  userId!: string;

  @Expose()
  deviceId!: string;

  @Expose()
  deviceName!: string;

  @Expose()
  deviceType!: string;

  @Expose()
  ip!: string;

  @Expose()
  location!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  isOnline?: boolean;
}
