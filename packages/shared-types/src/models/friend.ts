import type { FriendStatus } from "../enums/friend-status.js";

export interface Friend {
  _id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  createdAt: Date;
  updatedAt: Date;
}
