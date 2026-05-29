import { api } from "./api";
import axios from "axios";

export const userService = {
  getProfile: async (userId?: string) => {
    const response = await api.get(`/users/user-information/${userId}`);
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.patch(
      `/users/update-information-user`,
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  getListFriends: async () => {
    const response = await api.get(`/users/list-friends`);
    return response.data;
  },
  searchFriendByPhone: async (userId: string, phone: string) => {
    const response = await api.post("/users/search-friend-phone", { userId, phone });
    return response.data;
  },

  searchFriend: async (key: string, userId: string) => {
    const response = await api.post("/users/search-friend", {
      userId: userId,
      key,
    });
    return response.data;
  },
  cancelFriend: async (friendId: string, userId: string) => {
    const response = await api.post("/users/cancel-friend", {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },
  blockFriend: async (friendId: string, userId: string) => {
    const response = await api.post("/users/block-friend", {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },
  unblockFriend: async (friendId: string, userId: string) => {
    const response = await api.post("/users/unblock-friend", {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },
  getBlockedFriends: async () => {
    const response = await api.get("/users/blocked-friends");
    return response.data;
  },

  receivedFriendRequests: async () => {
    const response = await api.get(
      `/users/received-friends-requests`,
    );
    return response.data;
  },

  sentFriendRequests: async () => {
    const response = await api.get(
      `/users/sent-friends-requests`,
    );
    return response.data;
  },

  suggestFriend: async () => {
    const response = await api.post(`/users/suggest-friend`);
    return response.data;
  },

  acceptFriend: async (friendId: string, userId: string) => {
    const response = await api.post(`/users/accept-friend`, {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },

  rejectFriend: async (friendId: string, userId: string) => {
    const response = await api.post(`/users/reject-friend`, {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },

  addFriend: async (friendId: string, userId: string) => {
    const response = await api.post(`/users/add-friend`, {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },

  getSettings: async () => {
    const response = await api.get("/users/settings");
    return response.data;
  },

  updateSettings: async (settings: any) => {
    const response = await api.patch("/users/settings", settings);
    return response.data;
  },

  getFriends: async () => {
    const res = await api.get("/users/list-friends");
    return res.data;
  },



  getMusicList: async (searchTerm: string = "vietnam") => {
    try {
      // Gọi trực tiếp iTunes API bằng axios (không dùng instance 'api' của hệ thống)
      const response = await axios.get(
        `https://itunes.apple.com/search?term=${searchTerm}&limit=20&media=music`
      );
      return response.data.results.map((item: any) => ({
        id: item.trackId.toString(),
        title: item.trackName,
        artist: item.artistName,
        thumbnail: item.artworkUrl100, // Ảnh bìa bài hát
        previewUrl: item.previewUrl,   // Link nghe thử
      }));
    } catch (error) {
      console.error("Lỗi khi fetch nhạc từ iTunes:", error);
      throw error;
    }
  },

  checkFriendStatus: async (targetUserId: string) => {
    const response = await api.get(`/users/friend-status/${targetUserId}`);
    return response.data;
  },

  // Lấy trạng thái online/offline của nhiều user cùng lúc
  getBulkStatus: async (userIds: string[]) => {
    const response = await api.post("/users/status/bulk", { userIds });
    return response.data || [];
  },

  updatePrivacySettings: async (settings: { hideActiveStatus: boolean }) => {
    const response = await api.patch("/users/profile/privacy", settings);
    return response.data;
  },
};