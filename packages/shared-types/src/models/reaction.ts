import type { Emoji } from "./emoji.js";

export interface Reaction {
  _id: string;
  userId: string;
  emoji: Emoji[];
  createdAt: Date;
  updatedAt: Date;
}