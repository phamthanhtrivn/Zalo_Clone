import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState, ToastAndroid } from "react-native";
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { config } from "@/constants/config";
import {
  updateConversation,
  updateConversationSetting,
  updateRecallMessageInConversation,
  removeConversation,
  removeExpiredMessages,
  setUnreadCount,
  addConversationToTop,
  fetchConversations,
  updateUserStatus,
} from "@/store/slices/conversationSlice";
import { userService } from "@/services/user.service";
import { logout2 } from "@/store/auth/authThunk";
import { updatePrivacy } from "@/store/auth/authSlice";
import { getDeviceId } from "@/utils/device.util";
import {
  setupNotifications,
  scheduleLocalNotification,
} from "@/utils/notification.util";


interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  friendRefreshKey: number;
  profileRefreshKey: number;
  markAsRead: (data: {
    userId: string;
    conversationId: string;
  }) => Promise<any>;
  markAsUnread: (data: {
    userId: string;
    conversationId: string;
  }) => Promise<any>;
  setActiveConversationId: (conversationId: string | null) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  friendRefreshKey: 0,
  profileRefreshKey: 0,
  markAsRead: async () => ({}),
  markAsUnread: async () => ({}),
  setActiveConversationId: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const apiUrl = config.apiUrl;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [friendRefreshKey, setFriendRefreshKey] = useState(0);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const socketRef = useRef<Socket | null>(null);
  const conversations = useAppSelector((state) => state.conversation.conversations);
  const conversationsRef = useRef(conversations);
  const appStateRef = useRef(AppState.currentState);

  // Track current route để biết có đang ở màn hình bị kick không
  const currentConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setActiveConversationId = useCallback((conversationId: string | null) => {
    currentConversationIdRef.current = conversationId;
  }, []);

  const extractMessagePreview = (message: any) => {
    if (message?.recalled) return "Tin nhắn đã bị thu hồi";
    if (message?.expired) return "Tin nhắn đã hết hạn";
    if (message?.call?.type) {
      return message.call.type === "VIDEO" ? "Cuộc gọi video" : "Cuộc gọi thoại";
    }

    const content = message?.content;
    if (content?.text) return content.text;
    if (content?.icon) return "Sticker";

    const files = content?.files;
    if (Array.isArray(files) && files.length > 0) {
      const lastFile = files[files.length - 1];
      switch (lastFile?.type) {
        case "IMAGE":
          return "Hình ảnh";
        case "VIDEO":
          return "Video";
        case "VOICE":
          return "Tin nhắn thoại";
        case "FILE":
          return lastFile?.fileName || "Tệp đính kèm";
        default:
          return "Tệp đính kèm";
      }
    }

    return "Tin nhắn mới";
  };

  const markAsRead = useCallback(
    async (data: { userId: string; conversationId: string }) => {
      if (!socketRef.current)
        return Promise.reject(new Error("Socket not connected"));

      return new Promise((resolve, reject) => {
        socketRef.current?.emit("mark_as_read", data, (response: any) => {
          if (response?.success) {
            resolve(response);
          } else {
            reject(response);
          }
        });
      });
    },
    [],
  );

  const markAsUnread = useCallback(
    async (data: { userId: string; conversationId: string }) => {
      if (!socketRef.current)
        return Promise.reject(new Error("Socket not connected"));

      return new Promise((resolve, reject) => {
        socketRef.current?.emit("mark_as_unread", data, (response: any) => {
          if (response?.success) {
            resolve(response);
          } else {
            reject(response);
          }
        });
      });
    },
    [],
  );

  // Tự động fetch trạng thái online ban đầu của tất cả bạn chat (giống Web)
  useEffect(() => {
    if (!user?.userId || conversations.length === 0) return;

    const idsToFetch = conversations
      .filter((c) => c.type === "DIRECT" && c.otherMemberId && c.isOnline === undefined)
      .map((c) => c.otherMemberId) as string[];

    if (idsToFetch.length === 0) return;

    userService.getBulkStatus(idsToFetch)
      .then((statuses: any[]) => {
        if (Array.isArray(statuses)) {
          statuses.forEach((status) => {
            dispatch(updateUserStatus({
              userId: status.userId,
              isOnline: status.isOnline,
              lastSeenAt: status.lastSeenAt,
            }));
          });
        }
      })
      .catch((err: any) => console.error("[Mobile] Error fetching bulk statuses:", err));
  }, [conversations, user?.userId, dispatch]);

  // Tự động đăng xuất khi bị cưỡng ép
  const handleForceLogout = (data: { message: string }) => {
    dispatch(logout2());
    ToastAndroid.show(
      data.message ||
      "Phiên đăng nhập đã hết hạn hoặc bạn bị đăng xuất từ nơi khác.",
      ToastAndroid.LONG,
    );

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  useEffect(() => {
    if (!user?.userId || !apiUrl) {
      socketRef.current?.disconnect();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const initSocket = async () => {
      // Xin quyền và tạo notification channel một lần
      await setupNotifications();

      if (!socketRef.current) {
        const deviceId = await getDeviceId();
        // Mobile lưu token trong SecureStore (không phải Redux state)
        const accessToken =
          (await SecureStore.getItemAsync("access_token")) ?? "";

        socketRef.current = io(apiUrl, {
          auth: {
            token: accessToken,
            deviceId,
          },
        });
      }

      const socketInstance = socketRef.current;
      setSocket(socketInstance);

      // --- CONNECTION ---
      const onConnect = () => {
        setIsConnected(true);
      };

      const onDisconnect = () => {
        setIsConnected(false);
      };

      // --- HANDLERS (mỗi handler có tên rõ ràng để off() chính xác) ---

      const handleNewMessageSidebar = (data: any) => {
        dispatch(updateConversation(data));

        const conversationId = data?.conversationId;
        if (!conversationId) return;

        const currentConversation = conversationsRef.current.find(
          (conversation) => conversation.conversationId === conversationId,
        );
        const isMuted = Boolean(currentConversation?.muted);
        const isHidden = Boolean(currentConversation?.hidden);
        const isActiveConversation =
          currentConversationIdRef.current === conversationId;
        const senderName =
          data?.lastMessage?.senderName || data?.senderId?.profile?.name || "";
        const isOwnMessage = senderName === "Bạn";

        // Không thông báo nếu: bị mute, đang ẩn, đang mở conversation đó, hoặc là tin mình gửi
        if (isMuted || isHidden || isActiveConversation || isOwnMessage) {
          return;
        }

        const notifTitle =
          currentConversation?.name || senderName || "Tin nhắn mới";
        const notifBody = extractMessagePreview(data?.lastMessage || data);
        const avatar = currentConversation?.avatar || null;

        if (appStateRef.current !== "active") {
          // App đang ở background → hiện system notification
          scheduleLocalNotification(notifTitle, notifBody, {
            conversationId,
            avatar: avatar ?? undefined,
          });
        } else {
          // App đang foreground → hiện Toast như cũ
          Toast.show({
            type: "info",
            text1: notifTitle,
            text2: notifBody,
            visibilityTime: 3000,
          });
        }
      };


      const handleRecallMessageSidebar = (data: any) => {
        dispatch(updateRecallMessageInConversation(data));
      };

      const handleMessagesExpired = (data: {
        conversationId: string;
        messageIds: string[];
      }) => {
        dispatch(removeExpiredMessages(data.messageIds));
      };

      const handleMarkAsReadSuccess = (data: {
        conversationId: string;
        unreadCount: number;
      }) => {
        dispatch(
          setUnreadCount({
            conversationId: data.conversationId,
            unreadCount: data.unreadCount,
          }),
        );
      };

      const handleMarkAsUnreadSuccess = (data: {
        conversationId: string;
        unreadCount: number;
      }) => {
        dispatch(
          setUnreadCount({
            conversationId: data.conversationId,
            unreadCount: data.unreadCount,
          }),
        );
      };

      const handleMarkAsReadBroadcast = (data: {
        conversationId: string;
        unreadCount: number;
      }) => {
        dispatch(
          setUnreadCount({
            conversationId: data.conversationId,
            unreadCount: data.unreadCount,
          }),
        );
      };

      const handleMarkAsUnreadBroadcast = (data: {
        conversationId: string;
        unreadCount: number;
      }) => {
        dispatch(
          setUnreadCount({
            conversationId: data.conversationId,
            unreadCount: data.unreadCount,
          }),
        );
      };

      const handleConversationUnreadUpdate = (data: {
        conversationId: string;
        unreadCount: number;
      }) => {
        if (data.unreadCount !== undefined) {
          dispatch(
            setUnreadCount({
              conversationId: data.conversationId,
              unreadCount: data.unreadCount,
            }),
          );
        }
      };

      const handleConversationUpdate = (data: any) => {
        const patch: any = { conversationId: data.conversationId };
        if ("pinned" in data) patch.pinned = data.pinned;
        if ("hidden" in data) patch.hidden = data.hidden;
        if ("mutedUntil" in data) {
          patch.muted =
            data.mutedUntil != null &&
            new Date(data.mutedUntil).getTime() > Date.now();
          patch.mutedUntil = data.mutedUntil;
        }
        if ("category" in data) patch.category = data.category;
        if ("expireDuration" in data) patch.expireDuration = data.expireDuration;
        if ("unreadCount" in data) {
          patch.unreadCount = data.unreadCount;
        }
        dispatch(updateConversationSetting(patch));
      };

      const handleConversationDelete = (data: any) => {
        dispatch(removeConversation(data.conversationId));
      };

      const handleNewConversation = (conversation: any) => {
        if (!conversation?.conversationId) return;
        socketRef.current?.emit("join_room", conversation.conversationId);
        dispatch(addConversationToTop(conversation));
      };

      // BUG-8 fix: removed_from_conversation → navigate + Alert
      const handleRemoveFromConversation = (data: {
        conversationId?: string;
      }) => {
        const convId = data?.conversationId;
        if (!convId) return;

        dispatch(removeConversation(convId));

        // Nếu đang ở màn hình chat của nhóm bị kick → Hard reset navigation
        if (currentConversationIdRef.current === convId) {
          Alert.alert(
            "Thông báo",
            "Bạn đã bị xóa khỏi nhóm này.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/private/(tabs)"),
              },
            ],
          );
        }
      };

      // BUG-9 fix: member_removed → reload member list trong màn hình chat
      const handleMemberRemoved = (data: {
        conversationId: string;
        removedUserId: string;
      }) => {
        // Trigger refetch conversations để sidebar cập nhật
        dispatch(fetchConversations());
      };

      // BUG-9 fix: member_updated → reload toàn bộ conversation list
      const handleMemberUpdated = () => {
        dispatch(fetchConversations());
      };

      // BUG-9 fix: role_updated → cập nhật quyền realtime
      const handleRoleUpdated = () => {
        dispatch(fetchConversations());
      };

      // BUG-9 fix: new_approval_request → thông báo cho admin
      const handleNewApprovalRequest = (data: {
        conversationId: string;
        count: number;
      }) => {
        ToastAndroid.show(
          `Có ${data.count} yêu cầu tham gia nhóm mới`,
          ToastAndroid.SHORT,
        );
        dispatch(fetchConversations());
      };

      // BUG-10 fix: group_disbanded → Alert + Hard reset navigation
      const handleGroupDisbanded = (payload: any) => {
        const convId = payload?.conversationId || payload?.id;
        if (!convId) return;

        dispatch(removeConversation(convId));

        if (currentConversationIdRef.current === convId) {
          Alert.alert(
            "Thông báo",
            "Nhóm này đã bị giải tán bởi trưởng nhóm.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/private/(tabs)"),
              },
            ],
          );
        }
      };

      const handleGroupSettingsUpdate = (data: any) => {
        dispatch(
          updateConversationSetting({
            conversationId: data.conversationId,
            group: data.group,
          }),
        );
      };

      const handleGroupUpdate = (data: any) => {
        dispatch(
          updateConversationSetting({
            conversationId: data.conversationId,
            name: data.name,
            avatar: data.avatar,
            group: data.group,
          }),
        );
      };

      const handleReceiveFriendRequest = (data: {
        friendId: string;
        name: string;
        avatarUrl: string;
      }) => {
        ToastAndroid.show(
          `${data.name} đã gửi cho bạn một lời mời kết bạn`,
          ToastAndroid.SHORT,
        );
        setFriendRefreshKey((value) => value + 1);
      };

      const handleSocialNotification = (data: {
        title?: string;
        body?: string;
        actorName?: string;
      }) => {
        Toast.show({
          type: "info",
          text1: data.title || "Thông báo mới",
          text2:
            data.body ||
            (data.actorName ? `${data.actorName} vừa tương tác với bạn` : ""),
          visibilityTime: 2800,
        });
      };

      const handleFriendAccepted = (data: {
        friendId: string;
        name: string;
        avatarUrl: string;
      }) => {
        ToastAndroid.show(
          `${data.name} đã chấp nhận lời mời kết bạn`,
          ToastAndroid.SHORT,
        );
        setFriendRefreshKey((value) => value + 1);
      };

      const handleCancelFriendRequest = () => {
        ToastAndroid.show("Lời mời kết bạn đã bị hủy", ToastAndroid.SHORT);
        setFriendRefreshKey((value) => value + 1);
      };

      const handleUpdateProfile = (data: {
        userId: string;
        name?: string;
        avatarUrl?: string;
        gender?: string;
        birthday?: string;
      }) => {
        if (data.userId === user?.userId) {
          ToastAndroid.show(
            "Thông tin cá nhân đã được cập nhật",
            ToastAndroid.SHORT,
          );
          setProfileRefreshKey((value) => value + 1);
          return;
        }

        ToastAndroid.show("Bạn bè vừa cập nhật thông tin", ToastAndroid.SHORT);
        setFriendRefreshKey((value) => value + 1);
      };

      // Handler trạng thái online/offline real-time (giống Web)
      const handleUserStatusChange = (data: {
        userId: string;
        isOnline: boolean;
        lastSeenAt: string | null;
      }) => {
        dispatch(updateUserStatus(data));
      };

      // Handler thay đổi cấu hình quyền riêng tư realtime từ thiết bị khác của cùng tài khoản
      const handlePrivacyUpdated = (data: { hideActiveStatus: boolean }) => {
        dispatch(updatePrivacy({ hideActiveStatus: data.hideActiveStatus }));
      };

      // --- ĐĂNG KÝ LISTENERS (mỗi event 1 lần, truyền đầy đủ callback ref) ---
      socketInstance.on("connect", onConnect);
      socketInstance.on("disconnect", onDisconnect);

      socketInstance.on("mark_as_read:success", handleMarkAsReadSuccess);
      socketInstance.on("mark_as_unread:success", handleMarkAsUnreadSuccess);
      socketInstance.on("mark_as_read:broadcast", handleMarkAsReadBroadcast);
      socketInstance.on("mark_as_unread:broadcast", handleMarkAsUnreadBroadcast);
      socketInstance.on("conversation:update", handleConversationUnreadUpdate);

      socketInstance.on("new_message_sidebar", handleNewMessageSidebar);
      socketInstance.on("message_recalled_sidebar", handleRecallMessageSidebar);
      socketInstance.on("conversation_setting:update", handleConversationUpdate);
      socketInstance.on("conversation_setting:delete", handleConversationDelete);
      socketInstance.on("messages_expired", handleMessagesExpired);

      socketInstance.on("removed_from_conversation", handleRemoveFromConversation);
      socketInstance.on("new_conversation", handleNewConversation);
      socketInstance.on("group_disbanded", handleGroupDisbanded);
      socketInstance.on("group_settings_updated", handleGroupSettingsUpdate);
      socketInstance.on("group_updated", handleGroupUpdate);
      socketInstance.on("force_logout", handleForceLogout);
      socketInstance.on("receive_friend_request", handleReceiveFriendRequest);
      socketInstance.on("friend_accepted", handleFriendAccepted);
      socketInstance.on("cancel_friend_request", handleCancelFriendRequest);
      socketInstance.on("update_profile", handleUpdateProfile);
      socketInstance.on("social:notification", handleSocialNotification);
      socketInstance.on("user_status_change", handleUserStatusChange);
      socketInstance.on("privacy_updated", handlePrivacyUpdated);

      const handleUpdatePoll = (data: any) => {
        if (data.conversationId) {
          dispatch(updateConversation(data));
        }
      };
      socketInstance.on("update_poll", handleUpdatePoll);

      // BUG-9 fix: Đăng ký 4 events còn thiếu
      socketInstance.on("member_removed", handleMemberRemoved);
      socketInstance.on("member_updated", handleMemberUpdated);
      socketInstance.on("role_updated", handleRoleUpdated);
      socketInstance.on("new_approval_request", handleNewApprovalRequest);

      // SMELL fix: Cleanup truyền đúng callback reference cho tất cả events
      return () => {
        socketInstance.off("connect", onConnect);
        socketInstance.off("disconnect", onDisconnect);

        socketInstance.off("mark_as_read:success", handleMarkAsReadSuccess);
        socketInstance.off("mark_as_unread:success", handleMarkAsUnreadSuccess);
        socketInstance.off("mark_as_read:broadcast", handleMarkAsReadBroadcast);
        socketInstance.off("mark_as_unread:broadcast", handleMarkAsUnreadBroadcast);
        socketInstance.off("conversation:update", handleConversationUnreadUpdate);

        socketInstance.off("new_message_sidebar", handleNewMessageSidebar);
        socketInstance.off("message_recalled_sidebar", handleRecallMessageSidebar);
        socketInstance.off("conversation_setting:update", handleConversationUpdate);
        socketInstance.off("conversation_setting:delete", handleConversationDelete);
        socketInstance.off("messages_expired", handleMessagesExpired);

        socketInstance.off("removed_from_conversation", handleRemoveFromConversation);
        socketInstance.off("new_conversation", handleNewConversation);
        socketInstance.off("group_disbanded", handleGroupDisbanded);
        socketInstance.off("group_settings_updated", handleGroupSettingsUpdate);
        socketInstance.off("group_updated", handleGroupUpdate);
        socketInstance.off("force_logout", handleForceLogout);
        socketInstance.off("receive_friend_request", handleReceiveFriendRequest);
        socketInstance.off("friend_accepted", handleFriendAccepted);
        socketInstance.off("cancel_friend_request", handleCancelFriendRequest);
        socketInstance.off("update_profile", handleUpdateProfile);
        socketInstance.off("social:notification", handleSocialNotification);
        socketInstance.off("update_poll", handleUpdatePoll);

        socketInstance.off("member_removed", handleMemberRemoved);
        socketInstance.off("member_updated", handleMemberUpdated);
        socketInstance.off("role_updated", handleRoleUpdated);
        socketInstance.off("new_approval_request", handleNewApprovalRequest);
        socketInstance.off("user_status_change", handleUserStatusChange);
        socketInstance.off("privacy_updated", handlePrivacyUpdated);
      };
    };

    const cleanupPromise = initSocket();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [apiUrl, user?.userId, dispatch, router]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        friendRefreshKey,
        profileRefreshKey,
        markAsRead,
        markAsUnread,
        setActiveConversationId,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext };
