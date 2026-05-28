import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAppDispatch, useAppSelector, type RootState } from "@/store";
import type { PollType, PollOptionType, MessagesType } from "@/types/messages.type";
import {
  addConversationToTop,
  fetchConversations,
  removeConversation,
  removeExpiredMessages,
  setUnreadCount,
  updateConversation,
  updateConversationFromSocket,
  updateConversationSetting,
  updateRecallMessageInConversation,
  updateUnreadStateInMessages,
  updateUserStatus,
  updateCallStatusInConversation,
} from "@/store/slices/conversationSlice";
import {
  updateReadReceipt,
  updatePoll,
  addPollOption,
  addMessage,
  updateMessageReaction,
  updateRecallMessage,
  updateMessagePinned,
  updateMessagesExpired,
  updateCallStatus,
  clearReadReceiptsAfter
} from "@/store/slices/messageSlice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuth } from "@/store/auth/authSlice";
import { getDeviceId } from "@/utils/device.util";
import { userService } from "@/services/user.service";
import AppAvatar from "@/components/common/AppAvatar";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  markAsRead: (data: {
    userId: string;
    conversationId: string;
  }) => Promise<any>;
  markAsUnread: (data: {
    userId: string;
    conversationId: string;
  }) => Promise<any>;
  setActiveConversationId: (id: string | null) => void;
  aiStatus: "thinking" | "typing" | null;
  aiStreamingText: string;
  streamingTargetId: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

const navigateTo = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

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

const renderIncomingMessageToast = ({
  avatar,
  title,
  body,
  closeToast,
}: {
  avatar?: string | null;
  title: string;
  body: string;
  closeToast?: () => void;
}) => (
  <div className="relative flex min-w-[300px] max-w-[360px] items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
    <button
      onClick={closeToast}
      className="absolute right-3 top-3 text-[22px] leading-none text-[#94a3b8] transition-colors hover:text-[#475569]"
    >
      ×
    </button>
    <div className="shrink-0">
      <AppAvatar src={avatar || undefined} name={title} className="h-14 w-14" />
    </div>
    <div className="min-w-0 pr-6">
      <div className="truncate text-[18px] font-semibold text-[#0f172a]">
        {title}
      </div>
      <div className="mt-1 truncate text-[16px] text-[#475569]">{body}</div>
    </div>
  </div>
);

const getNotificationMessageId = (payload: any) =>
  payload?.lastMessage?._id || payload?._id || null;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [aiStatus, setAiStatus] = useState<"thinking" | "typing" | null>(null);
  const [aiStreamingText, setAiStreamingText] = useState("");
  const [streamingTargetId, setStreamingTargetId] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const conversations = useAppSelector((state: RootState) => state.conversation.conversations);

  const queryClient = useQueryClient();

  const socketRef = useRef<Socket | null>(null);
  const conversationsRef = useRef(conversations);
  const activeConversationIdRef = useRef<string | null>(null);
  const fetchingRef = useRef<Set<string>>(new Set());
  const notificationPermissionRequestedRef = useRef(false);
  const lastNotifiedMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const requestNotificationPermission = () => {
      if (
        Notification.permission !== "default" ||
        notificationPermissionRequestedRef.current
      ) {
        return;
      }

      notificationPermissionRequestedRef.current = true;
      void Notification.requestPermission().catch(() => {
        notificationPermissionRequestedRef.current = false;
      });
    };

    const handleFirstInteraction = () => {
      requestNotificationPermission();
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };

    window.addEventListener("pointerdown", handleFirstInteraction, {
      once: true,
    });
    window.addEventListener("keydown", handleFirstInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  // Tự động truy vấn trạng thái hoạt động ban đầu của các bạn chat
  useEffect(() => {
    if (!user?.userId || conversations.length === 0) return;

    // Lọc các otherMemberId từ direct conversation mà chưa có thông tin isOnline
    const idsToFetch = conversations
      .filter((c) => c.type === "DIRECT" && c.otherMemberId && c.isOnline === undefined)
      .map((c) => c.otherMemberId) as string[];

    if (idsToFetch.length === 0) return;

    userService.getBulkStatus(idsToFetch)
      .then((res) => {
        // Hỗ trợ cả trường hợp mảng thô hoặc đối tượng được bọc bởi Interceptor { success: true, data: [...] }
        const statuses = Array.isArray(res) ? res : (res as any)?.data;
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
      .catch((err) => console.error("Error fetching bulk statuses:", err));
  }, [conversations, user?.userId, dispatch]);

  const [groupDisbandedDialogOpen, setGroupDisbandedDialogOpen] = useState(false);
  const [, setGroupDisbandedConversationId] = useState<string>("");

  const markAsRead = useCallback(async (data: { userId: string; conversationId: string }) => {
    if (!socketRef.current) return;
    return new Promise((resolve, reject) => {
      socketRef.current?.emit("mark_as_read", data, (response: any) => {
        if (response?.success) resolve(response);
        else reject(response);
      });
    });
  }, []);

  const markAsUnread = useCallback(async (data: { userId: string; conversationId: string }) => {
    if (!socketRef.current) return;
    return new Promise((resolve, reject) => {
      socketRef.current?.emit("mark_as_unread", data, (response: any) => {
        if (response?.success) resolve(response);
        else reject(response);
      });
    });
  }, []);

  const setActiveConversationId = useCallback((id: string | null) => {
    if (activeConversationIdRef.current && socketRef.current) {
      socketRef.current.emit("leave_room", activeConversationIdRef.current);
    }
    activeConversationIdRef.current = id;
    if (id && socketRef.current) {
      socketRef.current.emit("join_room", id);
    }
  }, []);

  const handleForceLogout = useCallback((data?: { message: string }) => {
    toast.info(data?.message || "Phiên đăng nhập đã hết hạn hoặc bạn bị đăng xuất từ nơi khác.");
    dispatch(clearAuth());
    if (socketRef.current) socketRef.current.disconnect();
    navigateTo("/login");
  }, [dispatch]);

  const notifyIncomingMessage = useCallback((params: {
    conversationId: string;
    title: string;
    body: string;
    messageId?: string | null;
    avatar?: string | null;
  }) => {
    if (typeof window === "undefined") return;

    if (
      params.messageId &&
      lastNotifiedMessageIdRef.current === params.messageId
    ) {
      return;
    }
    lastNotifiedMessageIdRef.current = params.messageId || null;

    // 1. Nếu tab đang hiển thị VÀ đang được focus, hiện Toast nội bộ
    if (document.visibilityState === "visible" && document.hasFocus()) {
      toast(
        (props: any) =>
          renderIncomingMessageToast({
            avatar: params.avatar,
            title: params.title,
            body: params.body,
            closeToast: props.closeToast,
          }),
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          toastId: params.messageId || `toast-${params.conversationId}`,
          style: {
            background: "transparent",
            boxShadow: "none",
            border: "none",
            padding: 0,
          },
          onClick: () => {
            window.focus();
            navigateTo(`/conversation/${params.conversationId}`);
          },
        }
      );
      return;
    }

    // 2. Nếu tab đang ẩn (hidden), hiện thông báo trình duyệt (System Notification)
    const targetUrl = `/conversation/${params.conversationId}`;

    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    // Ưu tiên dùng Service Worker (chạy được cả khi tab bị đóng băng/nền sâu)
    const showSWNotification = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.showNotification) {
            // Tối giản hóa options để chắc chắn Windows không chặn
            const options = {
              body: params.body,
              icon: params.avatar || undefined, // Nếu có avatar thì dùng, không thì để trống
              tag: `msg-${params.conversationId}`,
              requireInteraction: true,
              data: { url: targetUrl },
            };

            await registration.showNotification(params.title, options);
            console.log("🚀 [DEBUG] showNotification resolved for:", params.title);
            return true;
          }
        }
      } catch (err) {
        console.error("SW Notification failed:", err);
      }
      return false;
    };

    // Fallback sang Notification truyền thống nếu SW thất bại
    showSWNotification().then((success) => {
      // Ép điện thoại/máy tính phát tín hiệu rung/chuông nếu được phép
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      if (!success) {
        try {
          console.log("🔔 Falling back to standard Notification");
          const notification = new Notification(params.title, {
            body: params.body,
            icon: params.avatar || "https://chat.zalo.me/favicon.ico",
            tag: `msg-${params.conversationId}`,
            requireInteraction: true,
          } as any);

          notification.onclick = () => {
            window.focus();
            navigateTo(targetUrl);
            notification.close();
          };
        } catch (error) {
          console.error("❌ Both notification methods failed:", error);
        }
      }
    });
  }, []);

  // --- SINGLETON HANDLERS (useCallback to prevent re-bind) ---
  const handleNewMessage = useCallback((newMessage: MessagesType) => {
    const conversationId = newMessage.conversationId;
    if (!conversationId) return;

    // Tránh lộ tin nhắn riêng tư / AI Summary: Nếu là tin nhắn PRIVATE hoặc AI_SUMMARY, 
    // chỉ xử lý nếu targetUserId là của chính người dùng hiện tại.
    const isPrivateOrAiSummary =
      newMessage.type === "PRIVATE" || newMessage.type === "AI_SUMMARY";
    const targetUserId =
      (newMessage as any).targetUserId?._id || (newMessage as any).targetUserId;

    if (isPrivateOrAiSummary && targetUserId && targetUserId !== user?.userId) {
      return;
    }

    const normalizedMessage = {
      ...newMessage,
      expiredAt: newMessage.expiredAt || (newMessage as any).expiresAt
    };

    dispatch(addMessage({ conversationId, message: normalizedMessage }));

    const existsInStore = conversationsRef.current.some(c => c.conversationId === conversationId);
    if (!existsInStore) {
      if (!fetchingRef.current.has(conversationId)) {
        fetchingRef.current.add(conversationId);
        dispatch(fetchConversations()).finally(() => fetchingRef.current.delete(conversationId));
      }
      return;
    }

    const currentConversation = conversationsRef.current.find(
      (conversation) => conversation.conversationId === conversationId,
    );
    const isOwnMessage = newMessage.senderId?._id === user?.userId;
    const isActiveConversation =
      activeConversationIdRef.current === conversationId;
    const nextUnreadCount =
      isOwnMessage || isActiveConversation
        ? 0
        : (currentConversation?.unreadCount ?? 0) + 1;

    dispatch(updateConversationFromSocket({
      conversationId,
      lastMessage: {
        _id: newMessage._id,
        senderName: isOwnMessage
          ? "Bạn"
          : newMessage.senderId?.profile?.name || "",
        content: newMessage.content,
        recalled: false,
        type: newMessage.type,
        call: newMessage.call,
        expired: newMessage.expired,
        expiredAt: normalizedMessage.expiredAt,
      },
      unreadCount: nextUnreadCount,
      lastMessageAt: newMessage.createdAt,
    }));

    const isMuted = Boolean(currentConversation?.muted);
    if (isOwnMessage || isActiveConversation || isMuted) {
      return;
    }

    const title = newMessage.senderId?.profile?.name
      ? `${newMessage.senderId.profile.name}`
      : currentConversation?.name || "Tin nhắn mới";
    const body = extractMessagePreview({
      content: newMessage.content,
      recalled: newMessage.recalled,
      expired: newMessage.expired,
      call: newMessage.call,
    });

    notifyIncomingMessage({
      conversationId,
      title,
      body,
      messageId: newMessage._id,
      avatar: newMessage.senderId?.profile?.avatarUrl,
    });
  }, [dispatch, notifyIncomingMessage, user?.userId]);

  const handleMessageReacted = useCallback((data: { messageId: string; reactions: any[]; conversationId?: string }) => {
    if (data.conversationId) {
      dispatch(updateMessageReaction({
        conversationId: data.conversationId,
        messageId: data.messageId,
        reactions: data.reactions
      }));
    }
  }, [dispatch]);

  const handleMessageRecalled = useCallback((data: { messageId: string; conversationId?: string }) => {
    const conversationId = data.conversationId || activeConversationIdRef.current;
    if (conversationId) {
      dispatch(updateRecallMessage({ conversationId, messageId: data.messageId }));
      dispatch(updateRecallMessageInConversation({ conversationId, messageId: data.messageId }));
    }
  }, [dispatch]);

  const handleMessagePinned = useCallback((data: { messageId: string; pinned: boolean; conversationId?: string }) => {
    const conversationId = data.conversationId || activeConversationIdRef.current;
    if (conversationId) {
      dispatch(updateMessagePinned({ conversationId, messageId: data.messageId, pinned: data.pinned }));
    }
  }, [dispatch]);

  const handleReadReceipt = useCallback((data: { conversationId: string; messages: any[] }) => {
    data.messages.forEach(msg => {
      msg.readReceipts?.forEach((receipt: any) => {
        dispatch(updateReadReceipt({
          conversationId: data.conversationId,
          messageId: msg._id,
          userId: receipt.userId?._id || receipt.userId,
          profile:
            typeof receipt.userId === "object"
              ? {
                name: receipt.userId?.profile?.name,
                avatarUrl: receipt.userId?.profile?.avatarUrl,
              }
              : undefined,
          type: "read"
        }));
      });
    });
  }, [dispatch]);

  const handleMessagesExpired = useCallback((data: { conversationId: string; messageIds: string[] }) => {
    dispatch(updateMessagesExpired(data));
    dispatch(removeExpiredMessages(data.messageIds));
  }, [dispatch]);

  const handleUpdatePoll = useCallback((data: Partial<PollType> & { _id: string; conversationId?: string }) => {
    console.log("🚀 Nhận dữ liệu poll mới từ Socket:", data);
    if (data.conversationId) {
      dispatch(updatePoll({ conversationId: data.conversationId, pollId: data._id, updatedPoll: data }));
    } else {
      console.error("[Socket] update_poll: Missing conversationId", data);
    }
  }, [dispatch]);

  const handlePollOptionAdded = useCallback((data: { pollId: string; newOption: PollOptionType; conversationId?: string }) => {
    if (data.conversationId) {
      dispatch(addPollOption({ conversationId: data.conversationId, pollId: data.pollId, newOption: data.newOption }));
    } else {
      console.error("[Socket] poll_option_added: Missing conversationId", data);
    }
  }, [dispatch]);

  const handleCallUpdated = useCallback((data: { messageId: string; status: string; duration?: number; conversationId?: string }) => {
    if (data.conversationId) {
      dispatch(updateCallStatus({
        conversationId: data.conversationId,
        messageId: data.messageId,
        status: data.status,
        duration: data.duration
      }));
      dispatch(updateCallStatusInConversation({
        conversationId: data.conversationId,
        messageId: data.messageId,
        status: data.status,
        duration: data.duration
      }));
    }
  }, [dispatch]);

  const handleGroupDisbanded = useCallback((payload: any) => {
    const conversationId = payload?.conversationId || payload?.id;
    if (!conversationId) return;
    dispatch(removeConversation({ conversationId }));
    setGroupDisbandedConversationId(conversationId);
    setGroupDisbandedDialogOpen(true);
  }, [dispatch]);

  // AI Stream message
  const handleAiStatus = useCallback((data: { targetId: string; status: "thinking" | "typing" | null }) => {
    setStreamingTargetId(data.targetId);
    setAiStatus(data.status);
    if (data.status === "thinking") setAiStreamingText("");
    if (data.status === null) setStreamingTargetId(null);
  }, []);

  const handleAiTypingChunk = useCallback((data: { targetId: string; text: string; isFinished: boolean }) => {
    setStreamingTargetId(data.targetId);
    if (data.isFinished) {
      setAiStatus(null);
      setAiStreamingText("");
      setStreamingTargetId(null);
    } else {
      setAiStatus("typing");
      setAiStreamingText((prev) => prev + data.text);
    }
  }, []);

  // --- FRIEND / CONTACT SOCKET HANDLERS ---
  const handleReceiveFriendRequest = useCallback((payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;
      const queryKey = ["friendRequests", "received", currentUserId];
      queryClient.setQueryData(queryKey, (old: any) => {
        const arr = Array.isArray(old) ? old.slice() : [];
        // avoid dup
        if (!arr.some((i: any) => i.friendId === payload.friendId)) {
          arr.unshift(payload);
        }
        return arr;
      });
      // Also refresh friend suggestions and friends list
      queryClient.invalidateQueries({ queryKey: ["friendSuggestions", currentUserId], refetchActive: true, refetchInactive: true });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'friends', refetchActive: true, refetchInactive: true });
      toast.info("Bạn có lời mời kết bạn mới");
    } catch (err) {
      console.error("handleReceiveFriendRequest error", err);
    }
  }, [queryClient, user?.userId]);

  const handleFriendAccepted = useCallback((payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;
      const friendName = payload?.name || "Người bạn";

      // Invalidate received & sent request list and all friends queries (so ContactPage refetches)
      queryClient.invalidateQueries({ queryKey: ["friendRequests", "received", currentUserId], refetchActive: true, refetchInactive: true });
      queryClient.invalidateQueries({ queryKey: ["friendRequests", "sent", currentUserId], refetchActive: true, refetchInactive: true });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "friends", refetchActive: true, refetchInactive: true });
      // Also refresh suggestions so accepted user removed
      queryClient.invalidateQueries({ queryKey: ["friendSuggestions", currentUserId], refetchActive: true, refetchInactive: true });

      toast.success(`${friendName} đã chấp nhận lời mời kết bạn`);
    } catch (err) {
      console.error("handleFriendAccepted error", err);
    }
  }, [queryClient, user?.userId]);

  const handleCancelFriendRequest = useCallback((payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;
      // payload can be either an object { friendId } or a string userId (backend emits body.userId)
      const targetId = typeof payload === 'string' ? payload : payload?.friendId || payload?.userId;
      if (!targetId) return;

      // Remove from received list
      queryClient.setQueryData(["friendRequests", "received", currentUserId], (old: any) => {
        return (old || []).filter((i: any) => i.friendId !== targetId);
      });
      // Remove from sent list
      queryClient.setQueryData(["friendRequests", "sent", currentUserId], (old: any) => {
        return (old || []).filter((i: any) => i.friendId !== targetId);
      });

      // Invalidate friends and suggestions so ContactPage / ContactRequest update immediately
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'friends' });
      queryClient.invalidateQueries({ queryKey: ["friendSuggestions", currentUserId] });
    } catch (err) {
      console.error("handleCancelFriendRequest error", err);
    }
  }, [queryClient, user?.userId]);

  const handleBlocked = useCallback((_payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;

      // Invalidate friends / requests / blockedFriends queries so UI refreshes
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && (query.queryKey[0] === 'friends' || query.queryKey[0] === 'friendRequests' || query.queryKey[0] === 'blockedFriends') });
      dispatch(fetchConversations());
    } catch (err) {
      console.error('handleBlocked error', err);
    }
  }, [dispatch, queryClient, user?.userId]);

  const handleBlockedBy = useCallback((_payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;

      // Invalidate relevant queries so UI updates
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && (query.queryKey[0] === 'friends' || query.queryKey[0] === 'friendRequests' || query.queryKey[0] === 'blockedFriends') });
      dispatch(fetchConversations());
    } catch (err) {
      console.error('handleBlockedBy error', err);
    }
  }, [dispatch, queryClient, user?.userId]);

  const handleUnblocked = useCallback((_payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;

      // Invalidate relevant queries so UI updates when unblocked
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && (query.queryKey[0] === 'friends' || query.queryKey[0] === 'friendRequests' || query.queryKey[0] === 'blockedFriends') });
      dispatch(fetchConversations());
    } catch (err) {
      console.error('handleUnblocked error', err);
    }
  }, [dispatch, queryClient, user?.userId]);

  const handleFriendStatusUpdated = useCallback((_payload: any) => {
    try {
      const currentUserId = user?.userId;
      if (!currentUserId) return;
      // Invalidate relevant queries so everything refreshes cleanly (friends, requests, suggestions)
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && (query.queryKey[0] === 'friends' || query.queryKey[0] === 'friendRequests' || query.queryKey[0] === 'friendSuggestions') });
      dispatch(fetchConversations());
    } catch (err) {
      console.error("handleFriendStatusUpdated error", err);
    }
  }, [dispatch, queryClient, user?.userId]);



  // --- INITIALIZE SOCKET & ATTACH LISTENERS ---
  useEffect(() => {
    if (!user?.userId || !accessToken) return;

    if (!socketRef.current) {
      socketRef.current = io(apiUrl, {
        auth: { token: accessToken, deviceId: getDeviceId() },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current.on("connect_error", (err) => {
        console.error("❌ Socket Connect Error:", err.message);
      });
    }

    const socketInstance = socketRef.current;
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    setSocket(socketInstance);

    const onConnect = () => {
      setIsConnected(true);
      socketInstance.emit("join", user.userId);
      if (activeConversationIdRef.current) {
        socketInstance.emit("join_room", activeConversationIdRef.current);
      }
    };
    const onDisconnect = () => setIsConnected(false);
    // 1. Nhận hội thoại mới
    const handleNewConversation = (conversation: any) => {
      if (!conversation?.conversationId) return;
      socketInstance.emit("join_room", conversation.conversationId);
      dispatch(addConversationToTop(conversation));
    };
    // 2. Cập nhật Sidebar khi có tin nhắn mới
    const handleNewMessageSidebar = (data: any) => {
      if (!data?.conversationId) return;
      const conversationId = data.conversationId;

      // Tránh lộ tin nhắn riêng tư / AI Summary: Nếu là tin nhắn PRIVATE hoặc AI_SUMMARY,
      // chỉ cập nhật sidebar nếu targetUserId là của chính người dùng hiện tại.
      const lastMsg = data.lastMessage || data;
      const isPrivateOrAiSummary =
        lastMsg?.type === "PRIVATE" || lastMsg?.type === "AI_SUMMARY";
      const targetUserId =
        lastMsg?.targetUserId?._id || lastMsg?.targetUserId || data?.targetUserId;

      if (isPrivateOrAiSummary && targetUserId && targetUserId !== user?.userId) {
        return;
      }

      // SMELL fix: dùng conversationsRef thay vì conversations để tránh stale closure
      const existsInStore = conversationsRef.current.some(
        (c) => c.conversationId === conversationId,
      );

      if (!existsInStore) {
        if (!fetchingRef.current.has(conversationId)) {
          fetchingRef.current.add(conversationId);
          dispatch(fetchConversations())
            .then(() => fetchingRef.current.delete(conversationId))
            .catch(() => fetchingRef.current.delete(conversationId));
        }
        return;
        // if (activeConversationIdRef.current) {
        //   socketInstance.emit("join_room", activeConversationIdRef.current);
      }

      const senderName =
        data?.lastMessage?.senderName ??
        (data?.senderId?._id === user?.userId
          ? "Bạn"
          : data?.senderId?.profile?.name || "");

      const lastMessage = data?.lastMessage
        ? data.lastMessage
        : {
          _id: data?._id,
          senderName,
          content: data?.content ?? {},
          recalled: Boolean(data?.recalled),
          type: data?.type,
        };

      dispatch(
        updateConversationFromSocket({
          conversationId: data.conversationId,
          lastMessage,
          unreadCount: data.unreadCount,
          lastMessageAt:
            data.lastMessageAt || data.createdAt || new Date().toISOString(),
        }),
      );

      const currentConversation = conversationsRef.current.find(
        (conversation) => conversation.conversationId === conversationId,
      );
      const isMuted = Boolean(currentConversation?.muted);
      const isActiveConversation =
        activeConversationIdRef.current === conversationId;
      const sidebarSenderId =
        data?.senderId?._id ||
        data?.lastMessage?.senderId?._id ||
        data?.lastMessage?.senderId;
      const isOwnMessage =
        String(sidebarSenderId || "") === String(user?.userId || "");

      if (isMuted || isActiveConversation || isOwnMessage) {
        return;
      }

      notifyIncomingMessage({
        conversationId,
        title: currentConversation?.name || senderName || "Tin nhắn mới",
        body: extractMessagePreview(lastMessage),
        messageId: getNotificationMessageId(data),
        avatar: data?.senderId?.profile?.avatarUrl || lastMessage?.senderId?.profile?.avatarUrl,
      });
    };
    // 3. Thu hồi tin nhắn
    const handleRecallMessageSidebar = (data: {
      conversationId: string;
      messageId: string;
    }) => {
      dispatch(updateRecallMessageInConversation(data));
    };

    // 5. Cập nhật Cài đặt hội thoại
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
      if ("unreadCount" in data) patch.unreadCount = data.unreadCount;
      dispatch(updateConversationSetting(patch));
    };

    // 6. Xóa hội thoại
    const handleConversationDelete = (data: any) => {
      dispatch(removeConversation({ conversationId: data.conversationId }));
    };

    // 7. Read / Unread / Receipts
    const handleUnreadUpdate = (data: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string | null;
    }) => {
      console.log("📭 messages_unread_updated:", data);
      dispatch(updateUnreadStateInMessages(data));
      dispatch(clearReadReceiptsAfter({
        conversationId: data.conversationId,
        userId: data.userId,
        lastReadMessageId: data.lastReadMessageId,
      }));
    };

    const handleMessageRead = (data: {
      conversationId: string;
      messageId: string;
      userId: string;
      type: "read" | "unread";
    }) => {
      dispatch(updateReadReceipt(data));
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

    const handleMarkAsReadError = (data: {
      conversationId: string;
      message: string;
    }) => {
      console.error("❌ mark_as_read:error", data);
    };

    const handleMarkAsUnreadError = (data: {
      conversationId: string;
      message: string;
    }) => {
      console.error("❌ mark_as_unread:error", data);
    };
    // 8. Group Events
    const handleGroupSettingsUpdate = (data: any) => {
      dispatch(
        updateConversationSetting({
          conversationId: data.conversationId,
          group: data.group,
        }),
      );
    };



    const handleMemberUpdated = () => {
      dispatch(fetchConversations());
    };

    // BUG-5 fix: Thay alert() + window.location.href bằng toast + navigateTo()
    const handleRemovedFromConversation = (payload: any) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;

      dispatch(removeConversation({ conversationId }));

      const currentPath = window.location?.pathname || "";
      if (currentPath.includes(conversationId)) {
        toast.info("Bạn không còn là thành viên của nhóm này.");
        navigateTo("/");
      }
    };

    const handleGroupDisbanded = (payload: any) => {
      const conversationId = payload?.conversationId || payload?.id;
      if (!conversationId) return;

      dispatch(removeConversation({ conversationId }));
      setGroupDisbandedConversationId(conversationId);
      setGroupDisbandedDialogOpen(true);
    };
    const handleGroupUpdated = (data: any) => {
      console.log("📢 [Web Socket] Nhận group_updated:", data);
      dispatch(updateConversationSetting({
        conversationId: data.conversationId,
        name: data.name,
        avatar: data.avatar,
        group: data.group,
      }));
    };

    const handleUserStatusChange = (data: {
      userId: string;
      isOnline: boolean;
      lastSeenAt: string | null;
    }) => {
      dispatch(updateUserStatus(data));
    };

    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("mark_as_read:success", handleMarkAsReadSuccess);
    socketInstance.on("mark_as_unread:success", handleMarkAsUnreadSuccess);
    socketInstance.on("mark_as_read:error", handleMarkAsReadError);
    socketInstance.on("mark_as_unread:error", handleMarkAsUnreadError);
    socketInstance.on("mark_as_read:broadcast", handleMarkAsReadBroadcast);
    socketInstance.on("mark_as_unread:broadcast", handleMarkAsUnreadBroadcast);

    socketInstance.on("new_conversation", handleNewConversation);
    socketInstance.on("new_message_sidebar", handleNewMessageSidebar);
    socketInstance.on("message_recalled_sidebar", handleRecallMessageSidebar);
    socketInstance.on("new_message", handleNewMessage);
    socketInstance.on("message_reacted", handleMessageReacted);
    socketInstance.on("message_recalled", handleMessageRecalled);
    socketInstance.on("message_pinned", handleMessagePinned);
    socketInstance.on("read_receipt", handleReadReceipt);
    socketInstance.on("messages_expired", handleMessagesExpired);
    socketInstance.on("call_updated", handleCallUpdated);

    socketInstance.on("message_read", handleMessageRead);
    socketInstance.on("messages_unread_updated", handleUnreadUpdate);

    socketInstance.on("conversation_setting:update", handleConversationUpdate);
    socketInstance.on("conversation_setting:delete", handleConversationDelete);

    socketInstance.on("update_poll", handleUpdatePoll);
    socketInstance.on("poll_option_added", handlePollOptionAdded);
    socketInstance.on("group_disbanded", handleGroupDisbanded);
    socketInstance.on("removed_from_conversation", handleRemovedFromConversation);
    socketInstance.on("group_settings_updated", handleGroupSettingsUpdate);
    socketInstance.on("group_updated", handleGroupUpdated);
    socketInstance.on("member_updated", handleMemberUpdated);
    socketInstance.on("role_updated", handleMemberUpdated);
    socketInstance.on("force_logout", handleForceLogout);
    socketInstance.on("ai_status", handleAiStatus);
    socketInstance.on("ai_typing_chunk", handleAiTypingChunk);
    socketInstance.on("user_status_change", handleUserStatusChange);
    socketInstance.on("receive_friend_request", handleReceiveFriendRequest);
    socketInstance.on("friend_accepted", handleFriendAccepted);
    socketInstance.on("cancel_friend_request", handleCancelFriendRequest);
    socketInstance.on('blocked', handleBlocked);
    socketInstance.on('blocked_by', handleBlockedBy);
    socketInstance.on('unblocked', handleUnblocked);
    socketInstance.on("friend_status_updated", handleFriendStatusUpdated);

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("disconnect", onDisconnect);
      socketInstance.off("mark_as_read:success", handleMarkAsReadSuccess);
      socketInstance.off("mark_as_unread:success", handleMarkAsUnreadSuccess);
      socketInstance.off("mark_as_read:error", handleMarkAsReadError);
      socketInstance.off("mark_as_unread:error", handleMarkAsUnreadError);
      socketInstance.off("mark_as_read:broadcast", handleMarkAsReadBroadcast);
      socketInstance.off("mark_as_unread:broadcast", handleMarkAsUnreadBroadcast);

      socketInstance.off("new_conversation", handleNewConversation);
      socketInstance.off("new_message_sidebar", handleNewMessageSidebar);
      socketInstance.off("message_recalled_sidebar", handleRecallMessageSidebar);
      socketInstance.off("new_message", handleNewMessage);
      socketInstance.off("message_reacted", handleMessageReacted);
      socketInstance.off("message_recalled", handleMessageRecalled);
      socketInstance.off("message_pinned", handleMessagePinned);
      socketInstance.off("read_receipt", handleReadReceipt);
      socketInstance.off("messages_expired", handleMessagesExpired);
      socketInstance.off("call_updated", handleCallUpdated);

      socketInstance.off("message_read", handleMessageRead);
      socketInstance.off("messages_unread_updated", handleUnreadUpdate);

      socketInstance.off("conversation_setting:update", handleConversationUpdate);
      socketInstance.off("conversation_setting:delete", handleConversationDelete);

      socketInstance.off("update_poll", handleUpdatePoll);
      socketInstance.off("poll_option_added", handlePollOptionAdded);
      socketInstance.off("group_disbanded", handleGroupDisbanded);
      socketInstance.off("removed_from_conversation", handleRemovedFromConversation);
      socketInstance.off("group_settings_updated", handleGroupSettingsUpdate);
      socketInstance.off("group_updated", handleGroupUpdated);
      socketInstance.off("member_updated", handleMemberUpdated);
      socketInstance.off("role_updated", handleMemberUpdated);
      socketInstance.off("force_logout", handleForceLogout);
      socketInstance.off("ai_status", handleAiStatus);
      socketInstance.off("ai_typing_chunk", handleAiTypingChunk);
      socketInstance.off("user_status_change", handleUserStatusChange);
      socketInstance.off("receive_friend_request", handleReceiveFriendRequest);
      socketInstance.off("friend_accepted", handleFriendAccepted);
      socketInstance.off("cancel_friend_request", handleCancelFriendRequest);
      socketInstance.off('blocked', handleBlocked);
      socketInstance.off('blocked_by', handleBlockedBy);
      socketInstance.off('unblocked', handleUnblocked);
      socketInstance.off("friend_status_updated", handleFriendStatusUpdated);

      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [apiUrl, user?.userId, accessToken, handleNewMessage, handleMessageReacted, handleMessageRecalled, handleMessagePinned, handleReadReceipt, handleMessagesExpired, handleUpdatePoll, handlePollOptionAdded, handleCallUpdated, handleGroupDisbanded, handleForceLogout, handleAiStatus, handleAiTypingChunk, handleReceiveFriendRequest, handleFriendAccepted, handleCancelFriendRequest, handleBlocked, handleBlockedBy, handleUnblocked, handleFriendStatusUpdated]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        markAsRead,
        markAsUnread,
        setActiveConversationId,
        aiStatus,
        aiStreamingText,
        streamingTargetId,
      }}
    >
      {children}
      <AlertDialog open={groupDisbandedDialogOpen} onOpenChange={setGroupDisbandedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thông báo</AlertDialogTitle>
            <AlertDialogDescription>Nhóm này đã bị giải tán bởi trưởng nhóm.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-[#0068ff] hover:bg-[#0057d6] text-white" onClick={() => { setGroupDisbandedDialogOpen(false); navigateTo("/"); }}>Xác nhận</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SocketContext.Provider>
  );
};
