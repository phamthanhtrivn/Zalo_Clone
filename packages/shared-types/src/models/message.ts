import type { Call } from "./call.js";
import type { Content } from "./content.js";
import type { Reaction } from "./reaction.js";
import type { ReadReceipt } from "./read-receipt.js";

export interface Message {
  _id: string;
  senderId: string;
  conversationId: string;
  content?: Content;
  createdAt: Date;
  updatedAt: Date;
  pinned: boolean;
  recalled: boolean;
  reactions?: Reaction[];
  readReceipts?: ReadReceipt[];
  repliedId?: string;
  call?: Call;
}
