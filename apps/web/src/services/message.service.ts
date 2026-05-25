import { EmojiType } from "@/constants/emoji.constant";
import axios from "axios";
import { apiClient } from "./apiClient";

export const messageService = {
  getMessagesFromConversation: async (
    conversationId: string,
    userId: string,
    cursor?: string | null,
    limit: number = 15,
  ) => {
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}`,
      {
        params: {
          userId,
          cursor,
          limit,
        },
      },
    );
    return response.data;
  },

  getNewerMessages: async (
    conversationId: string,
    userId: string,
    cursor?: string | null,
    limit: number = 15,
  ) => {
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}/newer`,
      {
        params: {
          userId,
          cursor,
          limit,
        },
      },
    );
    return response.data;
  },

  getPinnedMessages: async (conversationId: string, userId: string) => {
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}/pinned`,
      {
        params: { userId },
      },
    );
    return response.data;
  },

  getMessagesAroundPinnedMessage: async (
    conversationId: string,
    userId: string,
    messageId: string,
    limit: number = 15,
  ) => {
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}/around`,
      {
        params: { userId, messageId, limit },
      },
    );
    return response.data;
  },

  reactionMessage: async (
    conversationId: string,
    userId: string,
    emojiType: EmojiType,
    messageId: string,
  ) => {
    const response = await apiClient.patch(`/api/messages/reaction`, {
      conversationId,
      userId,
      emojiType,
      messageId,
    });
    return response.data;
  },

  removeReaction: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    const response = await apiClient.patch(`/api/messages/remove-reaction`, {
      userId,
      messageId,
      conversationId,
    });
    return response.data;
  },

  recalledMessage: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    const response = await apiClient.patch(`/api/messages/recalled`, {
      userId,
      messageId,
      conversationId,
    });
    return response.data;
  },

  pinnedMessage: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    const response = await apiClient.patch(`/api/messages/pinned`, {
      userId,
      messageId,
      conversationId,
    });
    return response.data;
  },

  sendMessage: async (
    conversationId: string,
    senderId: string,
    repliedId?: string,
    content?: { text?: string; icon?: string },
    files?: File[] | null,
  ) => {
    try {
      // Trường hợp có đính kèm file (Sử dụng FormData)
      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append("conversationId", conversationId);
        formData.append("senderId", senderId);

        if (repliedId) {
          formData.append("repliedId", repliedId);
        }

        if (content) {
          // Gửi content dưới dạng stringified object để Backend parse
          formData.append("content", JSON.stringify(content));
        }

        files.forEach((file) => {
          formData.append("files", file); // Chấp nhận nhiều file
        });

        const response = await apiClient.post(`/api/messages`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        return response?.data ?? null;
      }

      // Trường hợp chỉ gửi text/icon đơn thuần
      const response = await apiClient.post(`/api/messages`, {
        conversationId,
        senderId,
        repliedId,
        content,
      });
      return response?.data ?? null;
    } catch (error) {
      console.error("sendMessage Error:", error);
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as
          | { message?: string | string[] }
          | undefined;
        const msg = Array.isArray(data?.message)
          ? data.message[0]
          : data?.message;
        return {
          success: false,
          message: msg || error.message || "Gửi tin nhắn thất bại",
        };
      }
      return { success: false, message: "Gửi tin nhắn thất bại" };
    }
  },

  sendVoiceMessage: async (formData: FormData) => {
    try {
      const response = await apiClient.post(`/api/messages/voice`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response?.data ?? null;
    } catch (error) {
      console.error("sendVoiceMessage Error:", error);
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as
          | { message?: string | string[] }
          | undefined;
        const msg = Array.isArray(data?.message)
          ? data.message[0]
          : data?.message;
        return {
          success: false,
          message: msg || error.message || "Gửi voice thất bại",
        };
      }
      return { success: false, message: "Gửi voice thất bại" };
    }
  },

  deleteMessageForMe: async (
    userId: string,
    messageId: string,
    conversationId: string,
  ) => {
    const response = await apiClient.patch(`/api/messages/delete-for-me`, {
      userId,
      messageId,
      conversationId,
    });
    return response.data;
  },

  readReceipt: async (userId: string, conversationId: string) => {
    const response = await apiClient.patch(`/api/messages/read-receipt`, {
      userId,
      conversationId,
    });
    return response.data;
  },

  getMediasPreview: async (userId: string, conversationId: string) => {
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}/medias/preview`,
      {
        params: { userId },
      },
    );
    return response.data;
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
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}/medias`,
      {
        params,
      },
    );
    return response.data;
  },

  forwardMessagesToConversations: async (
    userId: string,
    messageIds: string[],
    targetConversationIds: string[],
  ) => {
    const response = await apiClient.post(`/api/messages/forward`, {
      userId,
      messageIds,
      targetConversationIds,
    });
    return response.data;
  },

  createCallMessage: async (data: {
    conversationId: string;
    senderId: string;
    type: "VIDEO" | "VOICE";
  }) => {
    const response = await apiClient.post(`/api/messages/call`, data);
    return response.data;
  },

  initiateGroupCall: async (data: {
    conversationId: string;
    senderId: string;
    type: "VIDEO" | "VOICE";
  }) => {
    const response = await apiClient.post(`/api/messages/call/group/initiate`, data);
    return response.data;
  },

  joinGroupCall: async (sessionId: string) => {
    const response = await apiClient.post(`/api/messages/call/group/join`, { sessionId });
    return response.data;
  },

  updateCallStatus: async (data: {
    messageId: string;
    conversationId: string;
    status: string;
  }) => {
    const response = await apiClient.patch(`/api/messages/call`, data);
    return response.data;
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
    }
  ) => {
    const response = await apiClient.get(
      `/api/messages/conversation/${conversationId}/search`,
      { params }
    );
    return response.data;
  },
};
