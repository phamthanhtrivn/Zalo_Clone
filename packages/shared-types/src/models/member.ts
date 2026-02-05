import type { MemberRole } from "../enums/member-role.js";

export interface Member {
  _id: string;
  userId: string;
  conversationId: string;
  nickname?: string;
  joinedAt: Date;
  leftAt?: Date;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}