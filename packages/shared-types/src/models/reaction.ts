export interface Reaction {
  _id: string;
  userId: string;
  messageId: string;
  emoji: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}