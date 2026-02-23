import type { Friend } from "./friend.js";
import type { Profile } from "./profile.js";
import type { Setting } from "./setting.js";

export interface User {
  _id: string;
  phone: string;
  email?: string;
  password: string;
  profile?: Profile;
  setting?: Setting;
  createdAt: Date;
  updatedAt: Date;
  refreshToken?: string;
  lastSeenAt?: Date;
  friends?: Friend[];
}