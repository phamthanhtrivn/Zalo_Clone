export interface Session {
  userId: string;

  deviceId: string;

  deviceName: string;

  ip: string;

  deviceType: string;

  location: string;

  createdAt: Date;
  isOnline?: boolean;
}
