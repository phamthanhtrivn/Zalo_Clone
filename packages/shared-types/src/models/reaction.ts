import type { Emoji } from "./emoji.js";

export interface Reaction {
  userId: string;
  emoji: Emoji[];
  createdAt: Date;
  updatedAt: Date;
}