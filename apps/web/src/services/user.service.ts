import { apiClient } from "./apiClient";

export const userService = {

  searchFriend: async (key: string, userId: string) => {

    const response = await apiClient.post("/api/users/search-friend", {
      userId: userId,
      key,
    });
    return response.data;
  },

  cancelFriend: async (friendId: string, userId: string) => {
    const response = await apiClient.post("/api/users/cancel-friend", {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },
  blockFriend: async (friendId: string, userId: string) => {
    const response = await apiClient.post("/api/users/block-friend", {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },
  receivedFriendRequests: async () => {
    const response = await apiClient.get(
      `/api/users/received-friends-requests`,
    );
    return response.data;
  },

  sentFriendRequests: async () => {
    const response = await apiClient.get(`/api/users/sent-friends-requests`);
    return response.data;
  },

  suggestFriend: async () => {
    const response = await apiClient.post(`/api/users/suggest-friend`);
    return response.data;
  },

  acceptFriend: async (friendId: string, userId: string) => {
    const response = await apiClient.post(`/api/users/accept-friend`, {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },

  rejectFriend: async (friendId: string, userId: string) => {
    const response = await apiClient.post(`/api/users/reject-friend`, {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },

  addFriend: async (friendId: string, userId: string) => {
    const response = await apiClient.post(`/api/users/add-friend`, {
      userId: userId,
      friendId: friendId,
    });
    return response.data;
  },

  getProfile: async (userId: string) => {
    const response = await apiClient.get(`/api/users/user-information/${userId}`);
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await apiClient.patch(
      `/api/users/update-information-user`,
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  getSettings: async () => {
    const response = await apiClient.get("/api/users/settings");
    return response.data;
  },

  updateSettings: async (settings: any) => {
    const response = await apiClient.patch("/api/users/settings", settings);
    return response.data;
  },

  searchFriendByPhone: async (userId: string, phone: string) => {
    const response = await apiClient.post("/api/users/search-friend-phone", { userId, phone });
    return response.data;
  },
  checkFriendStatus: async (targetUserId: string) => {
    const response = await apiClient.get(`/api/users/friend-status/${targetUserId}`);
    return response.data;
  },
  getBulkStatus: async (userIds: string[]) => {
    const response = await apiClient.post("/api/users/status/bulk", { userIds });
    return response.data?.data || [];
  },
  getBlockedFriends: async () => {
    const response = await apiClient.get("/api/users/blocked-friends");
    console.log(response)
    return response.data;
  }
};
