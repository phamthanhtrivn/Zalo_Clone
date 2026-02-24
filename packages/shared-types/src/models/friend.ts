import type { FriendStatus } from "../enums/friend-status.js";

export interface Friend {
  friendId: string;
  status: FriendStatus;
  createdAt: Date;
  updatedAt: Date;
}
