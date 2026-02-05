export interface ConversationSetting {
  _id: string;
  userId: string;
  conversationId: string;
  muted: boolean;
  pinned: boolean;
  hidden: boolean;
}