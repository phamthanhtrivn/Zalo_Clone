import type { ConversationType } from "../enums/conversation-type.js";
import type { Group } from "./group.js";

export interface Conversation {
  _id: string;
  type: ConversationType;
  createdAt: Date;
  updatedAt: Date;
  group?: Group;
  lastMessageId: string;
  lastMessageAt: Date;
}