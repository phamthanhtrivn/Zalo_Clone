import React, { useEffect, useState, useRef } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  InteractionManager,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSocket } from "@/contexts/SocketContext";
import { messageService } from "@/services/message.service";
import { useAppDispatch, useAppSelector } from "@/store/store";
import type { MessagesType, ReactionType } from "@/types/messages.type";
import {
  type EmojiType,
} from "@/constants/emoji.constant";
import Container from "@/components/common/Container";
import MessageBubble from "@/components/chat/MessageBubble";
import SystemMessage from "@/components/chat/SystemMessage";
import ChatInput from "@/components/chat/ChatInput";
import PinnedMessagesBar from "@/components/chat/PinnedMessagesBar";
import {
  getDateLabel,
  isSameHourAndMinute,
} from "@/utils/format-message-time.util";
import { Image } from "expo-image";
import { clearReplyingMessage, setConversations, setReplyingMessage, setCachedMessages } from "@/store/slices/conversationSlice";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { userService } from "@/services/user.service";
import { conversationService } from "@/services/conversation.service";
import GroupAvatar from "@/components/ui/GroupAvatar";
import AiTypingIndicator from "@/components/chat/AiTypingIndicator";
import ChatModals from "@/components/chat/ChatModals";
import ChatHeader from "@/components/chat/ChatHeader";
import FriendBanner from "@/components/chat/FriendBanner";
import { getStories } from "@/services/social.service";
import { formatLastSeen } from "@/utils/formater";

export default function ChatWindow() {
  const conversationState = useAppSelector((state) => state.conversation);
  const conversations = conversationState.conversations;
  const { id, messageId, otherUserId: paramOtherUserId, fromSearch } = useLocalSearchParams<{
    id: string;
    messageId?: string;
    otherUserId?: string;
    fromSearch?: string;
  }>();
  const fromSearchValue = Array.isArray(fromSearch) ? fromSearch[0] : fromSearch;
  const openedFromSearch =
    fromSearchValue === "1" || fromSearchValue === "true";
  const { socket } = useSocket();
  const user = useAppSelector((state) => state.auth.user);
  const authUserId = user?.userId || (user as any)?._id || "";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const conversation = conversations.find((c) => c.conversationId === id);
  // ✅ Use conversation.group as source of truth — conversation.type can be contaminated
  // by the last message type (e.g. "GROUP_CALL") and cause false negatives
  const isGroup = conversation?.type === "GROUP" || !!conversation?.group;

  const [contextMenuMsg, setContextMenuMsg] = useState<MessagesType | null>(
    null,
  );
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [friendStatus, setFriendStatus] = useState<string | null>(null);
  const effectiveOtherMemberId = (conversation as any)?.otherMemberId || paramOtherUserId;

  const { startGroupCall, startDirectCall, joinGroupCall } = useVideoCall();

  // ===== STATE =====
  const [messages, setMessages] = useState<MessagesType[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<MessagesType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  // Reaction picker
  const [reactionPickerMsg, setReactionPickerMsg] =
    useState<MessagesType | null>(null);

  // Reaction modal
  const [reactionModalData, setReactionModalData] = useState<
    ReactionType[] | null
  >(null);

  // Select mode (forward)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [loadingForward, setLoadingForward] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  // Detail modal
  const [detailMessage, setDetailMessage] = useState<MessagesType | null>(null);

  // Info panel
  const [showInfoSheet, setShowInfoSheet] = useState(false);

  // Reply mode
  const replyingMessage = useAppSelector(
    (state) => state.conversation.replyingMessage,
  );

  // AI Status
  const [aiStatus, setAiStatus] = useState<"thinking" | "typing" | null>(null);
  const [aiStreamingText, setAiStreamingText] = useState("");

  const flatListRef = useRef<FlatList>(null);
  const isFirstLoad = useRef(true);
  const isFetchingRef = useRef(false);
  const isFetchingNewerRef = useRef(false);
  const isJumpingRef = useRef(false);
  const prevCursorRef = useRef<string | null>(null);
  const pendingJumpMessageIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => interaction.cancel();
  }, []);

  const isPinned =
    contextMenuMsg && pinnedMessages.some((m) => m._id === contextMenuMsg._id);

  const userMember = isGroup
    ? conversation?.group?.members?.find((m: any) => m.userId === user?.userId)
    : null;
  const userRole = userMember?.role || (isGroup ? "MEMBER" : "OWNER");
  const isOwner = userRole === "OWNER";
  const isAdmin = userRole === "ADMIN";

  const canChat =
    !isGroup ||
    conversation?.group?.allowMembersSendMessages ||
    isOwner ||
    isAdmin;

  const scrollToBottom = (animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
    setShowScrollToBottom(false);
  };

  const handleGoToNewest = () => {
    // Luôn ưu tiên lệnh cuộn trước để người dùng thấy phản ứng ngay lập tức
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }

    if (prevCursor) {
      // Nếu ở chế độ lịch sử, ta set lùi lại một chút để animation cuộn kịp chạy
      setTimeout(() => {
        isFirstLoad.current = true;
        setPrevCursor(null);
        fetchInitialMessages();
      }, 100);
    } else {
      setShowScrollToBottom(false);
    }
  };

  // ================= FETCH =================
  const fetchInitialMessages = async (showLoading = true) => {
    if (!id || !user?.userId) return;
    try {
      if (showLoading) setIsLoading(true);
      const res: any = await messageService.getMessagesFromConversation(
        id,
        user.userId,
        null,
        20,
      );

      if (res.success) {
        const msgs = res.data.messages || [];
        // Đảm bảo batch tin nhắn này luôn là MỚI NHẤT ở ĐẦU batch
        const isNewestFirst = msgs.length >= 2 && new Date(msgs[0].createdAt) > new Date(msgs[msgs.length - 1].createdAt);
        const sortedBatch = isNewestFirst ? msgs : [...msgs].reverse();

        setMessages(sortedBatch);
        dispatch(setCachedMessages({ conversationId: id, messages: sortedBatch }));
        setNextCursor(res.data.nextCursor);
        setPrevCursor(null);
      }
      const pinRes: any = await messageService.getPinnedMessages(
        id,
        user.userId,
      );
      if (pinRes.success) setPinnedMessages(pinRes.data.messages);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!id || !user?.userId || !nextCursor || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res: any = await messageService.getMessagesFromConversation(
        id,
        user.userId,
        nextCursor,
        20,
      );
      if (res.success && res.data.messages.length > 0) {
        const newMsgs = res.data.messages;
        const isNewestFirst = newMsgs.length >= 2 && new Date(newMsgs[0].createdAt) > new Date(newMsgs[newMsgs.length - 1].createdAt);
        const sortedNew = isNewestFirst ? newMsgs : [...newMsgs].reverse();

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const uniqueNew = sortedNew.filter(
            (m: MessagesType) => !existingIds.has(m._id),
          );
          // Cơ chế INVERTED: tin nhắn CŨ hơn nối vào CUỐI mảng
          return [...prev, ...uniqueNew];
        });
        setNextCursor(res.data.nextCursor);
      } else {
        setNextCursor(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const loadNewerMessages = async () => {
    if (
      !id ||
      !user?.userId ||
      !prevCursor ||
      isFetchingNewerRef.current ||
      isJumpingRef.current
    )
      return;
    isFetchingNewerRef.current = true;
    try {
      const res: any = await messageService.getNewerMessages(
        id,
        user.userId,
        prevCursor,
        20,
      );
      if (res.success && res.data.messages.length > 0) {
        const newMsgs = res.data.messages;
        const isNewestFirst = newMsgs.length >= 2 && new Date(newMsgs[0].createdAt) > new Date(newMsgs[newMsgs.length - 1].createdAt);
        const sortedNew = isNewestFirst ? newMsgs : [...newMsgs].reverse();

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const uniqueNew = sortedNew.filter(
            (m: MessagesType) => !existingIds.has(m._id),
          );
          // Cơ chế INVERTED: tin nhắn MỚI hơn nối vào ĐẦU mảng
          return [...uniqueNew, ...prev];
        });

        const lastMsg = sortedNew[0]; // In inverted, the "newest" in batch is index 0
        setPrevCursor(lastMsg._id);
      } else {
        setPrevCursor(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      isFetchingNewerRef.current = false;
    }
  };

  // ================= SEND =================
  const handleSendMessage = async (text: string) => {
    if (!id || !user?.userId) return;

    // 1. Tạo tin nhắn tạm (Optimistic Update)
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      _id: tempId,
      conversationId: id,
      senderId: {
        _id: user.userId,
        profile: user.profile,
      },
      content: { text },
      type: "TEXT",
      createdAt: new Date().toISOString(),
      status: "sending",
      reactions: [],
    };

    let repliedId = null;
    if (replyingMessage) {
      repliedId = replyingMessage._id;
      optimisticMessage.repliedId = replyingMessage;
      dispatch(clearReplyingMessage());
    }

    // 2. Hiển thị ngay lên UI
    setMessages((prev) => [optimisticMessage, ...prev]);
    scrollToBottom();

    try {
      const res: any = await messageService.sendMessage(
        id,
        user.userId,
        repliedId,
        { text },
        null,
      );

      if (res.success) {
        // 3. Thay thế bằng tin nhắn thật từ server
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? res.data : m))
        );
      }
    } catch (err) {
      console.error("Gửi tin nhắn thất bại:", err);
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: "error" } : m))
      );
    }
  };

  const handleSendFile = async (
    files: Array<{ uri: string; name: string; type: string }>,
  ) => {
    if (!id || !user?.userId || files.length === 0) return;
    try {
      const mediaFiles = files.filter(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("video/"),
      );
      const documentFiles = files.filter(
        (file) =>
          !file.type.startsWith("image/") && !file.type.startsWith("video/"),
      );

      const promises: Promise<any>[] = [];

      if (mediaFiles.length > 0) {
        const formData = new FormData();
        formData.append("conversationId", id);
        formData.append("senderId", user.userId);
        if (replyingMessage?._id)
          formData.append("repliedId", replyingMessage._id);

        mediaFiles.forEach((file) => {
          formData.append("files", {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        promises.push(messageService.sendFormData(formData));
      }

      // Documents: one message per file
      documentFiles.forEach((file) => {
        const formData = new FormData();
        formData.append("conversationId", id);
        formData.append("senderId", user.userId);
        if (replyingMessage?._id)
          formData.append("repliedId", replyingMessage._id);
        formData.append("files", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);

        promises.push(messageService.sendFormData(formData));
      });

      await Promise.all(promises);
      if (replyingMessage) dispatch(clearReplyingMessage());
      scrollToBottom();
    } catch (err) {
      console.error("Send file error:", err);
      Alert.alert("Lỗi", "Không thể gửi file. Vui lòng thử lại.");
    }
  };

  const handleSendVoiceAudio = async (voice: {
    uri: string;
    name: string;
    type: string;
    durationMs: number;
  }) => {
    if (!id || !user?.userId) return;

    try {
      const formData = new FormData();
      formData.append("conversationId", id);
      formData.append("senderId", user.userId);
      if (replyingMessage?._id) {
        formData.append("repliedId", replyingMessage._id);
      }
      formData.append(
        "content",
        JSON.stringify({
          voiceDuration: Math.max(1, Math.floor(voice.durationMs / 1000)),
        }),
      );
      formData.append("files", {
        uri: voice.uri,
        name: voice.name,
        type: voice.type,
      } as any);

      await messageService.sendVoiceMessage(formData);
      if (replyingMessage) dispatch(clearReplyingMessage());
      scrollToBottom();
    } catch (err) {
      console.error("Send voice error:", err);
      Alert.alert("Lỗi", "Không thể gửi bản ghi âm.");
    }
  };

  // ================= PIN =================
  const handleTogglePin = async (messageId: string) => {
    if (!id || !user?.userId) return;
    try {
      await messageService.pinnedMessage(user.userId, messageId, id);
    } catch {
      Alert.alert(
        "Bạn chỉ có thể ghim tối đa 3 tin nhắn trong 1 cuộc trò chuyện",
      );
    }
  };

  // ================= REACT =================
  const handleReaction = async (emojiType: EmojiType, messageId: string) => {
    if (!id || !user?.userId) return;
    try {
      await messageService.reactionMessage(
        id,
        user.userId,
        emojiType,
        messageId,
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveReaction = async (messageId: string) => {
    if (!id || !user?.userId) return;
    try {
      await messageService.removeReaction(user.userId, messageId, id);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= RECALL / DELETE =================
  const handleRecall = async (messageId: string) => {
    if (!id || !user?.userId) return;
    try {
      await messageService.recalledMessage(user.userId, messageId, id);
    } catch {
      Alert.alert("Bạn không thể thu hồi tin nhắn trong vòng 24 giờ");
    }
  };

  const handleAddFriend = async () => {
    if (!effectiveOtherMemberId || !user?.userId) return;
    try {
      await userService.addFriend(effectiveOtherMemberId, user.userId);
      setFriendStatus("PENDING");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptFriend = async () => {
    if (!effectiveOtherMemberId || !user?.userId) return;
    try {
      await userService.acceptFriend(effectiveOtherMemberId, user.userId);
      setIsFriend(true);
      setFriendStatus("ACCEPTED");
    } catch (err) {
      console.error(err);
    }
  };

  const handleConversationCleared = () => {
    setMessages([]);
    setPinnedMessages([]);
    if (id) {
      dispatch(setCachedMessages({ conversationId: id, messages: [] }));
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    if (!id || !user?.userId) return;
    try {
      await messageService.deleteMessageForMe(user.userId, messageId, id);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));

      const res: any = await (messageService as any).getConversationsFromUserId(
        user?.userId || "",
      );

      if (res.success) {
        dispatch(setConversations(res.data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ================= FORWARD =================
  const toggleSelectMessage = (messageId: string) => {
    setSelectedMessages((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId],
    );
  };

  const handleForward = async (conversationIds: string[]) => {
    if (!user?.userId || selectedMessages.length === 0) return;
    setLoadingForward(true);
    try {
      await messageService.forwardMessagesToConversations(
        user.userId,
        selectedMessages,
        conversationIds,
      );
      setShowForwardModal(false);
      setIsSelectMode(false);
      setSelectedMessages([]);
      Alert.alert("Thành công", "Đã chuyển tiếp tin nhắn");
    } catch (err) {
      console.error(err);
      Alert.alert("Lỗi", "Không thể chuyển tiếp tin nhắn");
    } finally {
      setLoadingForward(false);
    }
  };

  // ================= JUMP =================
  const handleJumpToMessage = async (messageId: string) => {
    if (!id || !user?.userId) return;
    const res: any = await messageService.getMessagesAroundPinnedMessage(
      id,
      user.userId,
      messageId,
      15,
    );
    if (res.success) {
      isJumpingRef.current = true;
      const msgs = res.data.messages;

      // Đảm bảo mảng nhảy tới cũng phải là mới nhất ở index 0
      const isNewestFirst = msgs.length >= 2 && new Date(msgs[0].createdAt) > new Date(msgs[msgs.length - 1].createdAt);
      const sortedBatch = isNewestFirst ? msgs : [...msgs].reverse();

      setMessages(sortedBatch);
      setNextCursor(res.data.nextCursor);
      setPrevCursor(res.data.prevCursor);

      const index = sortedBatch.findIndex((m: any) => m._id === messageId);
      if (index !== -1) {
        // Clear previous highlight
        setHighlightedMessageId(null);

        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5, // Center it
          });

          setHighlightedMessageId(messageId);
          setTimeout(() => {
            setHighlightedMessageId(null);
            isJumpingRef.current = false;
          }, 2500);
        }, 300);
      } else {
        isJumpingRef.current = false;
      }
    }
  };

  const handleOpenStoryLink = async (storyId: string) => {
    if (!storyId) return;
    try {
      const res: any = await getStories();
      const groups = Array.isArray(res?.data) ? res.data : [];
      const groupIndex = groups.findIndex((group: any) =>
        (group.stories || []).some((story: any) => String(story.id) === String(storyId)),
      );

      if (groupIndex < 0) {
        Alert.alert("Thong bao", "Story nay da het han hoac khong con kha dung.");
        return;
      }

      const targetGroup = groups[groupIndex];
      const storyIndex = (targetGroup.stories || []).findIndex(
        (story: any) => String(story.id) === String(storyId),
      );

      if (storyIndex < 0) {
        Alert.alert("Thong bao", "Khong tim thay story.");
        return;
      }

      router.push({
        pathname: "/private/story-viewer",
        params: {
          authorId: targetGroup.authorId,
          userName: targetGroup.userName,
          userAvatar: targetGroup.userAvatar,
          hoursAgo: "",
          storiesJson: JSON.stringify(targetGroup.stories || []),
          startIndex: String(storyIndex),
          groupsJson: JSON.stringify(groups),
          groupIndex: String(groupIndex),
        },
      });
    } catch {
      Alert.alert("Loi", "Khong mo duoc story nay.");
    }
  };

  const handleVideoCall = () => {
    console.log("🎥 [handleVideoCall] conversation:", conversation?.name, "type:", conversation?.type, "isGroup:", isGroup);
    // 1. Kiểm tra sự tồn tại của đối tượng conversation
    if (!conversation) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin hội thoại.");
      return;
    }

    // 2. Kiểm tra các điều kiện bắt buộc trước khi gọi
    if (!id || !user?.userId) {
      Alert.alert(
        "Lỗi",
        "Không thể xác định thông tin người gọi.",
      );
      return;
    }

    // 3. Kích hoạt cuộc gọi
    if (isGroup) {
      startGroupCall(
        id, // conversationId
        "VIDEO", // Loại cuộc gọi
      );
    } else {
      startDirectCall(
        effectiveOtherMemberId,
        id,
        "VIDEO",
        conversation.name,
        conversation.avatar
      );
    }
  };

  // ================= EFFECTS =================
  useEffect(() => {
    if (id && user?.userId) {
      // 1. Kiểm tra Cache trước
      const cached = conversationState.cachedMessages?.[id];
      if (cached && cached.length > 0) {
        setMessages(cached);
        // Tải ngầm, không hiện spinner
        fetchInitialMessages(false);
      } else {
        // Không có cache -> hiện spinner như bình thường
        fetchInitialMessages(true);
      }

      pendingJumpMessageIdRef.current = messageId ?? null;
      messageService.readReceipt(user.userId, id);
      dispatch(clearReplyingMessage());

      // Fetch group members if it is group chat
      if (isGroup) {
        conversationService.getListMembers(id)
          .then((res: any) => {
            if (res?.success && res.data) {
              setGroupMembers(res.data);
            }
          })
          .catch((err) => console.error("Error fetching group members:", err));
      } else {
        setGroupMembers([]);
      }
    }
  }, [id, user?.userId, messageId, isGroup]);

  useEffect(() => {
    prevCursorRef.current = prevCursor;
  }, [prevCursor]);

  useEffect(() => {
    if (!pendingJumpMessageIdRef.current || !messages.length) return;

    const targetMessageId = pendingJumpMessageIdRef.current;
    pendingJumpMessageIdRef.current = null;

    const timeoutId = setTimeout(() => {
      handleJumpToMessage(targetMessageId);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [messages]);

  useEffect(() => {
    const expiringMessages = messages.filter(
      (message) => !(message as any).expired && message.expiresAt,
    );

    if (!expiringMessages.length) return;

    const nextExpiryAt = Math.min(
      ...expiringMessages
        .map((message) => new Date(message.expiresAt!).getTime())
        .filter((time) => !Number.isNaN(time)),
    );

    if (!Number.isFinite(nextExpiryAt)) return;

    const syncExpiredMessages = () => {
      setMessages((prev) =>
        prev.map((message) => {
          if ((message as any).expired || !message.expiresAt) return message;

          const expiresAtMs = new Date(message.expiresAt).getTime();
          if (Number.isNaN(expiresAtMs) || expiresAtMs > Date.now()) {
            return message;
          }

          return { ...message, expired: true };
        }),
      );
    };

    const delay = nextExpiryAt - Date.now();
    if (delay <= 0) {
      syncExpiredMessages();
      return;
    }

    const timeoutId = setTimeout(syncExpiredMessages, delay + 50);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // --- FRIEND STATUS CHECK ---
  useEffect(() => {
    if (isGroup || !effectiveOtherMemberId || !user?.userId) {
      setIsFriend(null);
      setFriendStatus(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await userService.checkFriendStatus(effectiveOtherMemberId);
        // Handle double nested response if necessary, similar to web
        const friendData = res?.data?.data ?? res?.data;
        if (!cancelled && friendData) {
          setIsFriend(!!friendData.isFriend);
          setFriendStatus(friendData.status ?? null);
        }
      } catch (err) {
        console.error("Check friend status failed:", err);
        if (!cancelled) setIsFriend(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [id, effectiveOtherMemberId, isGroup, user?.userId]);

  // ===== SOCKET =====
  useEffect(() => {
    if (!socket || !id || !user?.userId) return;
    socket.emit("join_room", id);

    const handleNewMessage = (newMessage: MessagesType) => {
      // ONLY append if we are at the end (no newer history)
      if (prevCursorRef.current) {
        setShowScrollToBottom(true); // Hint there is new content
        return;
      }
      setMessages((prev) => {
        // 1. Nếu đã có ID thật này trong danh sách, bỏ qua
        if (prev.some((m) => m._id === newMessage._id)) return prev;

        // 2. Nếu là tin nhắn của chính mình, tìm và thay thế tin nhắn tạm
        const senderId = typeof newMessage.senderId === "string" ? newMessage.senderId : newMessage.senderId?._id;
        if (senderId === user?.userId) {
          const tempIndex = prev.findIndex(
            (m) => m.status === "sending" && m.content?.text === newMessage.content?.text
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = newMessage;
            return updated;
          }
        }

        // 3. Tin nhắn bình thường
        return [newMessage, ...prev];
      });
      messageService.readReceipt(user.userId, id);

      // Tự động cuộn xuống đáy (offset 0) nếu đang ở gần đáy
      if (!showScrollToBottom) {
        setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
      }
    };

    const handleMessageReacted = (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, reactions: data.reactions } : m,
        ),
      );
    };

    const handleMessageRecalled = (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, recalled: true } : m,
        ),
      );
    };

    const handleMessagePinned = (data: any) => {
      setPinnedMessages(data.pinnedMessages);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, pinned: data.pinned } : m,
        ),
      );
    };

    const handleMessagesExpired = (data: {
      conversationId: string;
      messageIds: string[];
    }) => {
      if (data.conversationId !== id) return;
      setMessages((prev) =>
        prev.map((m) =>
          data.messageIds.includes(m._id) ? { ...m, expired: true } : m,
        ),
      );
    };
    const handleReadReceipt = (data: {
      conversationId: string;
      messages: MessagesType[];
    }) => {
      if (data.conversationId === id) {
        setMessages((prev) => {
          const updatedMap = new Map(
            data.messages.map((m) => [m._id, m.readReceipts]),
          );
          return prev.map((m) => {
            const newReadReceipts = updatedMap.get(m._id);
            if (!newReadReceipts) return m;
            const previousByUserId = new Map(
              (m.readReceipts || []).map((receipt: any) => {
                const rawUser = receipt?.userId;
                const uid =
                  typeof rawUser === "string" ? rawUser : rawUser?._id;
                return [uid, receipt];
              }),
            );

            const mergedReceipts = newReadReceipts.map((receipt: any) => {
              const rawUser = receipt?.userId;
              const uid =
                typeof rawUser === "string" ? rawUser : rawUser?._id;
              const prevReceipt = previousByUserId.get(uid);
              const prevUser =
                typeof prevReceipt?.userId === "string"
                  ? null
                  : prevReceipt?.userId;
              const nextUser = typeof rawUser === "string" ? null : rawUser;

              const mergedUser =
                typeof rawUser === "string"
                  ? prevUser
                    ? {
                      ...prevUser,
                      _id: uid || prevUser?._id,
                    }
                    : {
                      _id: uid,
                      profile: { name: "", avatarUrl: "" },
                    }
                  : {
                    ...rawUser,
                    profile: {
                      name:
                        rawUser?.profile?.name ||
                        prevUser?.profile?.name ||
                        "",
                      avatarUrl:
                        rawUser?.profile?.avatarUrl ||
                        prevUser?.profile?.avatarUrl ||
                        (rawUser as any)?.avatarUrl ||
                        (prevUser as any)?.avatarUrl ||
                        "",
                    },
                  };

              return {
                ...prevReceipt,
                ...receipt,
                userId: mergedUser,
              };
            });

            return { ...m, readReceipts: mergedReceipts };
          });
        });
      }
    };
    const handleUpdatePoll = (data: any) => {
      if (data.conversationId !== id) return;
      setMessages((prev) =>
        prev.map((m) => {
          const mPollId = typeof m.pollId === "string" ? m.pollId : m.pollId?._id;
          if (String(mPollId) === String(data._id)) {
            return { ...m, poll: data };
          }
          return m;
        }),
      );
    };

    const handleCallUpdated = (data: { messageId: string, status: string, duration?: number }) => {

      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? {
              ...m,
              call: {
                type: m.call?.type ?? "VIDEO",
                status: data.status,
                duration: data.duration ?? m.call?.duration ?? null
              }
            }
            : m,
        ),
      );
    };

    const handleGroupCallUpdated = (data: { messageId: string, status: string, conversationId: string }) => {
      console.log("👥 [Mobile Socket] Group Call Updated:", data);
      if (data.conversationId === id) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? {
                ...m,
                call: {
                  type: m.call?.type ?? "VIDEO",
                  status: data.status,
                  duration: data.duration ?? m.call?.duration ?? 0
                }
              }
              : m,
          ),
        );
      }
    };

    const handleAiStatus = (data: { targetId: string; status: "thinking" | "typing" | null }) => {
      if (data.targetId === id || data.targetId === user?.userId) {
        setAiStatus(data.status);
        if (data.status === null) {
          setAiStreamingText("");
        }
      }
    };

    const handleAiTypingChunk = (data: {
      targetId: string;
      text: string;
      isFinished: boolean;
    }) => {
      if (data.targetId === id || data.targetId === user?.userId) {
        setAiStatus("typing");
        const chunk = typeof data.text === "string" ? data.text : "";
        setAiStreamingText((prev) => prev + chunk);
        if (data.isFinished) {
          setAiStatus(null);
          setAiStreamingText("");
        }
      }
    };

    socket.on("call_updated", handleCallUpdated);
    socket.on("group_call_updated", handleGroupCallUpdated);
    socket.on("read_receipt", handleReadReceipt);
    socket.on("messages_expired", handleMessagesExpired);
    socket.on("new_message", handleNewMessage);
    socket.on("message_reacted", handleMessageReacted);
    socket.on("message_recalled", handleMessageRecalled);
    socket.on("message_pinned", handleMessagePinned);
    socket.on("update_poll", handleUpdatePoll);
    socket.on("ai_status", handleAiStatus);
    socket.on("ai_typing_chunk", handleAiTypingChunk);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_reacted", handleMessageReacted);
      socket.off("message_recalled", handleMessageRecalled);
      socket.off("message_pinned", handleMessagePinned);
      socket.off("read_receipt", handleReadReceipt);
      socket.off("messages_expired", handleMessagesExpired);
      socket.off("update_poll", handleUpdatePoll);
      socket.off("call_updated", handleCallUpdated);
      socket.off("group_call_updated", handleGroupCallUpdated);
      socket.off("ai_status", handleAiStatus);
      socket.off("ai_typing_chunk", handleAiTypingChunk);

      socket.emit("leave_room", id);
    };
  }, [socket, id, user?.userId]);

  const latestSentMessageId = React.useMemo(() => {
    const mine = messages.find((m) => {
      const senderId =
        typeof m.senderId === "string" ? m.senderId : m.senderId?._id;
      return senderId === authUserId && m.type !== "SYSTEM";
    });
    return mine?._id || null;
  }, [messages, authUserId]);

  // ================= RENDER =================
  const renderItem = React.useCallback(({ item, index }: any) => {
    // Cơ chế INVERTED: 
    // index lớn hơn là tin nhắn CŨ hơn (older)
    // index nhỏ hơn là tin nhắn MỚI hơn (newer)
    const older = messages[index + 1];
    const newer = messages[index - 1];

    const isSystem = item.type === "SYSTEM";
    const isMe =
      !isSystem &&
      (typeof item.senderId === "string" ? item.senderId : item.senderId?._id) ===
      user?.userId;

    const sameSenderOlder = older && older.senderId?._id === item.senderId?._id;
    const sameMinuteOlder =
      older && isSameHourAndMinute(older.createdAt, item.createdAt);
    const isFirstInCluster = !(sameSenderOlder && sameMinuteOlder);

    const sameSenderNewer = newer && newer.senderId?._id === item.senderId?._id;
    const sameMinuteNewer =
      newer && isSameHourAndMinute(newer.createdAt, item.createdAt);
    const isLastInCluster = !(sameSenderNewer && sameMinuteNewer);

    const showAvatar = !isMe && !isSystem && isFirstInCluster;
    const showName = !isMe && !isSystem && isFirstInCluster;
    const showTime = !isSystem && isLastInCluster;
    const showDivider =
      !older ||
      new Date(older.createdAt).toDateString() !==
      new Date(item.createdAt).toDateString();

    const isSelected = selectedMessages.includes(item._id);
    const isLastReadMessage =
      !!latestSentMessageId && item._id === latestSentMessageId;
    const addSpacing = isFirstInCluster && !showDivider && !isSystem;

    return (
      <View
        className={`${addSpacing ? "mt-3" : "mt-0.5"} ${item.reactions?.length > 0 ? "mb-3.5" : "mb-0"}`}
      >
        {showDivider && (
          <View className="flex-row justify-center my-3">
            <View className="bg-[#babbbe] px-3 py-1 rounded-[6px]">
              <Text className="text-white text-[11px]">
                {getDateLabel(item.createdAt)}
              </Text>
            </View>
          </View>
        )}
        {isSystem ? (
          <SystemMessage message={item} />
        ) : (
          <MessageBubble
            message={item}
            isMe={isMe}
            showAvatar={showAvatar}
            showName={showName}
            showTime={showTime}
            isSelected={isSelected}
            isSelectMode={isSelectMode}
            isHighlighted={highlightedMessageId === item._id}
            onLongPress={() => setContextMenuMsg(item)}
            onPress={() => {
              if (isSelectMode) toggleSelectMessage(item._id);
            }}
            onOpenReactionModal={(reactions) => setReactionModalData(reactions)}
            renderReadReceipts={isLastReadMessage}
            onReplyPress={handleJumpToMessage}
            isGroup={isGroup}
            onJoinGroupCall={joinGroupCall}
            onOpenStoryLink={handleOpenStoryLink}
            members={isGroup ? groupMembers : []}
          />
        )}
      </View>
    );
  }, [messages, authUserId, selectedMessages, isSelectMode, highlightedMessageId, isGroup, latestSentMessageId, handleJumpToMessage, handleOpenStoryLink, joinGroupCall, user?.userId, groupMembers]);

  return (
    <Container
      edges={["top", "left", "right", "bottom"]}
    >
      <ChatHeader
        conversation={conversation}
        isFriend={isFriend}
        handleVideoCall={handleVideoCall}
        router={router}
        id={id}
        setShowInfoSheet={setShowInfoSheet}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <PinnedMessagesBar
          pinnedMessages={pinnedMessages}
          onUnpin={handleTogglePin}
          onJumpToMessage={handleJumpToMessage}
        />

        <FriendBanner
          isFriend={isFriend}
          friendStatus={friendStatus}
          handleAcceptFriend={handleAcceptFriend}
          handleAddFriend={handleAddFriend}
        />

        <View className="flex-1 bg-[#F1F2F4]">
          {isLoading && messages.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0068FF" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={isReady ? messages : []}
              inverted
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              scrollEventThrottle={16}
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={Platform.OS === "android"}
              onScroll={(e) => {
                const { y } = e.nativeEvent.contentOffset;
                const isBottom = y <= 100;
                setShowScrollToBottom(!isBottom || !!prevCursor);
                if (isJumpingRef.current) return;
                if (isBottom && prevCursor) loadNewerMessages();
              }}
              onContentSizeChange={(w, h) => {
                if (
                  isFirstLoad.current &&
                  h > 0 &&
                  messages.length > 0 &&
                  !prevCursor
                ) {
                  isFirstLoad.current = false;
                }
              }}
              onScrollToIndexFailed={(info) => {
                const wait = new Promise((resolve) => setTimeout(resolve, 500));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                });
              }}
              onEndReached={() => {
                if (!prevCursor) loadMoreMessages();
              }}
              onEndReachedThreshold={0.5}
              contentContainerClassName="pt-2 pb-2"
              ListHeaderComponent={
                <View className="pb-1">
                  {aiStatus && (
                    <AiTypingIndicator
                      key="ai-indicator"
                      status={aiStatus}
                      streamingText={aiStreamingText || ""}
                      botAvatar={conversation?.avatar}
                    />
                  )}
                </View>
              }
              ListFooterComponent={
                <View className="py-2.5">
                  {isLoading && messages.length > 0 && (
                    <ActivityIndicator size="small" color="#0068ff" />
                  )}
                </View>
              }
              ListEmptyComponent={() => (
                <View className="items-center py-2.5" style={{ transform: [{ scaleY: -1 }] }}>
                  {isFriend === false && (
                    <View className="bg-white rounded-xl mx-4 mt-2.5 overflow-hidden w-[90%] shadow-sm">
                      <View className="h-[120px] bg-[#e5e7eb]">
                        <Image
                          source={{ uri: "https://picsum.photos/seed/zalo/800/400" }}
                          className="w-full h-[120px]"
                        />
                      </View>

                      <View className="p-4 items-center relative">
                        <View
                          className="absolute -top-10 border-[3px] border-white rounded-[43px] overflow-hidden"
                        >
                          <GroupAvatar
                            uri={conversation?.avatar}
                            name={conversation?.name || "Group"}
                            size={80}
                          />
                        </View>

                        <View className="mt-[45px] items-center">
                          <Text className="text-lg font-bold text-[#111827]">
                            {conversation?.name}
                          </Text>
                          <Text className="mt-2 text-[13px] color-[#6b7280] text-center px-5">
                            Người này chưa được thêm vào danh sách bạn bè. Hãy lưu ý khi gửi tin nhắn.
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {isReady && messages.length === 0 && !isFriend && (
                    <Text className="text-[#9ca3af] text-[13px] mt-5">
                      Chưa có tin nhắn nào
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>

        {/* Reply Bar */}
        {replyingMessage && (
          <View className="bg-white p-2.5 border-t border-[#e5e7eb] flex-row items-center gap-2.5">
            <View className="w-1 h-[30px] bg-[#0068ff] rounded" />
            <View className="flex-1">
              <Text className="text-[12px] font-bold text-[#0068ff]">
                Đang trả lời{" "}
                {replyingMessage.senderId?._id === user?.userId
                  ? "chính mình"
                  : replyingMessage.senderId?.profile?.name || "Bạn"}
              </Text>
              <Text
                numberOfLines={1}
                className="text-[12px] text-[#6b7280]"
              >
                {replyingMessage.content?.text ||
                  (replyingMessage.content?.files
                    ? replyingMessage.content.files[0].fileName
                    : "[Tệp đính kèm]")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => dispatch(clearReplyingMessage())}
            >
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}

        {!canChat && !isSelectMode ? (
          <View className="p-4 bg-[#f9fafb] border-t border-[#e5e7eb] items-center">
            <Text className="text-[#6b7280] text-[13px] italic">
              Chỉ Trưởng/Phó nhóm mới được gửi tin nhắn
            </Text>
          </View>
        ) : (
          <ChatInput
            chatName={conversation?.name}
            onSendMessage={handleSendMessage}
            onSendFiles={handleSendFile}
            onSendVoiceAudio={handleSendVoiceAudio}
            isSelectMode={isSelectMode}
            selectedMessages={selectedMessages}
            onOpenForwardModal={() => setShowForwardModal(true)}
            onCancelSelect={() => {
              setIsSelectMode(false);
              setSelectedMessages([]);
            }}
            isGroup={isGroup}
            conversationId={id}
            members={isGroup ? groupMembers : [{ userId: { _id: effectiveOtherMemberId, profile: { name: conversation?.name, avatarUrl: conversation?.avatar } } }]}
          />
        )}

        {/* Floating Jump to Newest Button */}
        {showScrollToBottom && (
          <TouchableOpacity
            onPress={handleGoToNewest}
            className="absolute bottom-24 right-4 w-9 h-9 rounded-full bg-white items-center justify-center z-10 shadow-sm"
          >
            <Ionicons name="chevron-down" size={24} color="#0068ff" />
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      <ChatModals
        reactionPickerMsg={reactionPickerMsg}
        setReactionPickerMsg={setReactionPickerMsg}
        user={user}
        handleReaction={handleReaction}
        handleRemoveReaction={handleRemoveReaction}
        reactionModalData={reactionModalData}
        setReactionModalData={setReactionModalData}
        showForwardModal={showForwardModal}
        setShowForwardModal={setShowForwardModal}
        conversations={conversations}
        selectedMessages={selectedMessages}
        handleForward={handleForward}
        loadingForward={loadingForward}
        detailMessage={detailMessage}
        setDetailMessage={setDetailMessage}
        conversation={conversation}
        showInfoSheet={showInfoSheet}
        setShowInfoSheet={setShowInfoSheet}
        openedFromSearch={openedFromSearch}
        onConversationCleared={handleConversationCleared}
        contextMenuMsg={contextMenuMsg}
        setContextMenuMsg={setContextMenuMsg}
        isPinned={isPinned || false}
        handleTogglePin={handleTogglePin}
        handleRecall={handleRecall}
        handleDeleteForMe={handleDeleteForMe}
        dispatch={dispatch}
        setReplyingMessage={setReplyingMessage}
        setIsSelectMode={setIsSelectMode}
        toggleSelectMessage={toggleSelectMessage}
      />
    </Container>
  );
}

