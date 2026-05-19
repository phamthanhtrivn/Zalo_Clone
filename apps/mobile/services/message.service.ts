import { EmojiType } from "@/constants/emoji.constant";
import { api } from "./api";

export const messageService = {
  // 1. Lấy tin nhắn cũ hơn (Pagination) - Default limit 20 cho mượt
  getMessagesFromConversation: async (
    conversationId: string,
    userId: string,
    cursor?: string | null,
    limit: number = 20,
  ) => {
    return await api.get(`/messages/conversation/${conversationId}`, {
      params: { userId, cursor, limit },
    });
  },

  // 2. Lấy tin nhắn mới hơn
  getNewerMessages: async (
    conversationId: string,
    userId: string,
    cursor?: string | null,
    limit: number = 20,
  ) => {
    return await api.get(`/messages/conversation/${conversationId}/newer`, {
      params: { userId, cursor, limit },
    });
  },

  // 3. Quản lý tin nhắn ghim
  getPinnedMessages: async (conversationId: string, userId: string) => {
    return await api.get(`/messages/conversation/${conversationId}/pinned`, {
      params: { userId },
    });
  },

  getMessagesAroundPinnedMessage: async (
    conversationId: string,
    userId: string,
    messageId: string,
    limit: number = 20,
  ) => {
    return await api.get(`/messages/conversation/${conversationId}/around`, {
      params: { userId, messageId, limit },
    });
  },

  searchMessages: async (
    conversationId: string,
    params: {
      userId: string;
      keyword?: string;
      senderId?: string;
      startDate?: string;
      endDate?: string;
      cursor?: string;
      limit?: number;
    },
  ) => {
    return await api.get(`/messages/conversation/${conversationId}/search`, {
      params: {
        userId: params.userId,
        keyword: params.keyword,
        senderId: params.senderId,
        startDate: params.startDate,
        endDate: params.endDate,
        cursor: params.cursor,
        limit: params.limit ?? 30,
      },
    });
  },

  // 4. Reaction & Interaction
  reactionMessage: async (
    conversationId: string,
    userId: string,
    emojiType: EmojiType,
    messageId: string,
  ) => {
    return await api.patch(`/messages/reaction`, {
      conversationId,
      userId,
      emojiType,
      messageId,
    });
  },

  removeReaction: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    return await api.patch(`/messages/remove-reaction`, {
      userId,
      messageId,
      conversationId,
    });
  },

  recalledMessage: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    return await api.patch(`/messages/recalled`, {
      userId,
      messageId,
      conversationId,
    });
  },

  pinnedMessage: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    return await api.patch(`/messages/pinned`, {
      userId,
      messageId,
      conversationId,
    });
  },

  deleteMessageForMe: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    return await api.patch(`/messages/delete-for-me`, {
      userId,
      messageId,
      conversationId,
    });
  },

  // 5. Gửi tin nhắn
  sendMessage: async (
    conversationId: string,
    senderId: string,
    repliedId?: string,
    content?: { text?: string; icon?: string },
    files?: any[] | null,
  ) => {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append("conversationId", conversationId);
      formData.append("senderId", senderId);

      if (repliedId) formData.append("repliedId", repliedId);
      if (content) formData.append("content", JSON.stringify(content));

      files.forEach((file) => {
        formData.append("files", file as any);
      });

      const response = await api.post(`/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    }

    // Gửi tin nhắn text thuần túy
    const response = await api.post(`/messages`, {
      conversationId,
      senderId,
      repliedId,
      content,
    });
    return response.data;
  },

  sendVoiceMessage: async (formData: FormData) => {
    const response = await api.post(`/messages/voice`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  sendFormData: async (formData: FormData) => {
    const response = await api.post(`/messages`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // 6. Trạng thái đọc & Call
  readReceipt: async (userId: string, conversationId: string) => {
    return await api.patch(`/messages/read-receipt`, {
      userId,
      conversationId,
    });
  },

  // 7. Media & Tài liệu
  getMediasPreview: async (userId: string, conversationId: string) => {
    return await api.get(
      `/messages/conversation/${conversationId}/medias/preview`,
      {
        params: { userId },
      },
    );
  },

  getMediasFileType: async (
    conversationId: string,
    params: {
      userId: string;
      type: "IMAGE" | "VIDEO" | "FILE" | "LINK";
      senderId?: string;
      fromDate?: string;
      toDate?: string;
      cursor?: string;
      limit?: number;
    },
  ) => {
    return await api.get(`/messages/conversation/${conversationId}/medias`, {
      params,
    });
  },

  // 8. Chuyển tiếp (Forward)
  forwardMessagesToConversations: async (
    userId: string,
    messageIds: string[],
    targetConversationIds: string[],
  ) => {
    const res = await api.post(`/messages/forward`, {
      userId,
      messageIds,
      targetConversationIds,
    });
    return res;
  },

  createCallMessage: async (data: {
    conversationId: string;
    senderId: string;
    type: "VIDEO" | "VOICE";
  }) => {
    const response = await api.post(`/messages/call`, data);
    return response.data;
  },

  initiateGroupCall: async (data: {
    conversationId: string;
    senderId: string;
    type: "VIDEO" | "VOICE";
  }) => {
    const response = await api.post(`/messages/call/group/initiate`, data);
    return response.data;
  },

  joinGroupCall: async (sessionId: string) => {
    const response = await api.post(`/messages/call/group/join`, { sessionId });
    return response.data;
  },

  updateCallStatus: async (data: {
    messageId: string;
    conversationId: string;
    status: string;
  }) => {
    const response = await api.patch(`/messages/call`, data);
    return response.data;
  },
};
