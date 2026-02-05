import type { Gender } from "../enums/gender.js";

export interface Profile {
  name: string;
  avatarUrl?: string;
  gender?: Gender;
  birthday?: Date;
  bio?: string;
}
