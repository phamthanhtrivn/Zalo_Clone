import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatHeader from "@/components/layout/message/ChatHeader";
import MessageList from "@/components/layout/message/MessageList";
import ChatInput from "@/components/layout/message/ChatInput";
import ConversationInfoPanel from "@/components/layout/message/ConversationInfoPanel";
import MessageSearchPanel from "@/components/layout/message/MessageSearchPanel";
import { messageService } from "@/services/message.service";
import { userService } from "@/services/user.service";
import type { MessagesType } from "@/types/messages.type";
import { toast, Zoom } from "react-toastify";
import { useSocket } from "@/contexts/SocketContext";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  setConversations,
  clearReplyingMessage,
  updateRecallMessageInConversation,
} from "@/store/slices/conversationSlice";
import {
  setMessages,
  prependMessages,
  appendMessages,
  updateRecallMessage,
  updateMessagesExpired,
  updateCallStatus,
  updateMessagePinned,
  updateMessageReaction,
  updateReadReceipt,
} from "@/store/slices/messageSlice";
import { addMessage } from "@/store/slices/messageSlice"; // Added import for addMessage
import ForwardModal from "@/components/layout/message/ForwardModal";
import { conversationService } from "@/services/conversation.service";
import HomePage from "./HomePage";

const EMPTY_MESSAGES: MessagesType[] = [];

const ConversationPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { conversation: stateConversation, otherUserId: locationOtherUserId } =
    location.state || {};
  const openedFromSearch = Boolean(location.state?.fromSearch);
  const dispatch = useAppDispatch();

  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.userId || (currentUser as any)?._id || "";

  const conversations = useAppSelector(
    (state) => state.conversation.conversations,
  );
  const isConversationLoading = useAppSelector(
    (state) => state.conversation.isLoading,
  );
  const replyingMessage = useAppSelector(
    (state) => state.conversation.replyingMessage,
  );
  const messages = useAppSelector(
    (state) => state.message.messagesByConversation[id || ""] ?? EMPTY_MESSAGES,
  );

  const conversation =
    stateConversation || conversations.find((c) => c.conversationId === id);
  const isGroup = conversation?.type === "GROUP";

  const effectiveOtherMemberId = !isGroup
    ? conversation?.otherMemberId || locationOtherUserId || null
    : null;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<MessagesType[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const isJumpingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isFetchingNewerRef = useRef(false);

  const [isSelected, setIsSelected] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [loadingForward, setLoadingForward] = useState(false);
  const pendingJumpMessageIdRef = useRef<string | null>(null);

  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [friendStatus, setFriendStatus] = useState<string | null>(null);
  const lastMessageId = messages[messages.length - 1]?._id;
  const {
    setActiveConversationId,
    socket,
    aiStatus,
    aiStreamingText,
    streamingTargetId,
  } = useSocket();
  
  const selectedMessageId = new URLSearchParams(location.search).get(
    "messageId",
  );

  const toastAlert = useCallback((message: string) => {
    toast(message, {
      position: "top-center",
      autoClose: 3000,
      hideProgressBar: true,
      theme: "dark",
      transition: Zoom,
    });
  }, []);

  const handleConversationCleared = useCallback(() => {
    if (!id) return;
    dispatch(setMessages({ conversationId: id, messages: [] }));
    setPinnedMessages([]);
  }, [dispatch, id]);

  useEffect(() => {
    setActiveConversationId(id || null);
    return () => setActiveConversationId(null);
  }, [id, setActiveConversationId]);

  // --- FRIEND STATUS CHECK ---
  useEffect(() => {
    if (isGroup || !effectiveOtherMemberId || !currentUserId) {
      setIsFriend(null);
      setFriendStatus(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await userService.checkFriendStatus(effectiveOtherMemberId);
        const friendData = res?.data?.data ?? res?.data;
        if (!cancelled && friendData) {
          setIsFriend(!!friendData.isFriend);
          setFriendStatus(friendData.status ?? null);
        } else if (!cancelled) {
          setIsFriend(false);
          setFriendStatus(null);
        }
      } catch (err) {
        console.error("[FriendStatus] API error:", err);
        if (!cancelled) {
          setIsFriend(false);
          setFriendStatus(null);
        }
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [id, effectiveOtherMemberId, isGroup, currentUserId]);
  const handleSendFriendRequest = async () => {
    if (!effectiveOtherMemberId || !currentUserId) return;
    try {
      await userService.addFriend(effectiveOtherMemberId, currentUserId);
      setFriendStatus("PENDING");
    } catch (err) {
      console.error("Gửi lời mời kết bạn thất bại:", err);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!effectiveOtherMemberId || !currentUserId) return;
    try {
      await userService.acceptFriend(effectiveOtherMemberId, currentUserId);
      setIsFriend(true);
      setFriendStatus("ACCEPTED");
    } catch (err) {
      console.error("Chấp nhận kết bạn thất bại:", err);
    }
  };

  // --- LOGIC CUỘN & NHẢY TIN NHẮN ---
  const scrollToMessage = useCallback((messageId: string, retry = 0) => {
    const el = document.getElementById(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight");
      setTimeout(() => el.classList.remove("highlight"), 5000);
      return true;
    }

    if (retry < 10) {
      setTimeout(() => scrollToMessage(messageId, retry + 1), 50);
    }

    return false;
  }, []);

  const handleJumpToMessage = useCallback(
    async (messageId: string) => {
      if (!id || !currentUserId || !messageId) return;

      if (scrollToMessage(messageId)) return;

      isJumpingRef.current = true;
      try {
        const res = await messageService.getMessagesAroundPinnedMessage(
          id,
          currentUserId,
          messageId,
          15,
        );

        if (!res.success) return;

        dispatch(
          setMessages({ conversationId: id, messages: res.data.messages }),
        );
        setNextCursor(res.data.nextCursor);
        setPrevCursor(res.data.prevCursor);

        setTimeout(() => {
          scrollToMessage(messageId);
        }, 100);
      } catch (error) {
        console.error(error);
      } finally {
        setTimeout(() => {
          isJumpingRef.current = false;
        }, 1000);
      }
    },
    [id, currentUserId, dispatch, scrollToMessage],
  );

  const handleLoadMessagesFromConversation = async () => {
    if (!id || !currentUserId) return;
    try {
      const res = await messageService.getMessagesFromConversation(
        id,
        currentUserId,
        null,
        20,
      );
      if (res.success) {
        dispatch(
          setMessages({ conversationId: id, messages: res.data.messages }),
        );
        setNextCursor(res.data.nextCursor);
        setPrevCursor(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoadPinnedMessages = async () => {
    if (!id || !currentUserId) return;
    try {
      const res = await messageService.getPinnedMessages(id, currentUserId);
      if (res.success) setPinnedMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  };
  // ✅ SỬA: Chỉ xử lý read_receipt, bỏ qua messages_unread_updated
  // ConversationPage.tsx
  const handleReadReceipt = useCallback(
    (data: {
      conversationId: string;
      messages: Array<{ _id: string; readReceipts: any[] }>;
    }) => {
      if (data.conversationId !== id) return;

      data.messages.forEach((msg) => {
        msg.readReceipts?.forEach((receipt) => {
          dispatch(
            updateReadReceipt({
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
              type: "read",
            }),
          );
        });
      });
    },
    [id, dispatch],
  );

  const handleScrollToTop = async () => {
    const container = containerRef.current;
    if (
      !container ||
      !nextCursor ||
      !id ||
      !currentUserId ||
      isJumpingRef.current ||
      isFetchingRef.current
    )
      return;
    if (container.scrollTop < 100) {
      isFetchingRef.current = true;
      const prevHeight = container.scrollHeight;
      const res = await messageService.getMessagesFromConversation(
        id,
        currentUserId,
        nextCursor,
        20,
      );
      if (res.success && res.data.messages.length > 0) {
        dispatch(
          prependMessages({ conversationId: id, messages: res.data.messages }),
        );
        setNextCursor(res.data.nextCursor);
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevHeight;
        });
      } else {
        setNextCursor(null);
      }
      isFetchingRef.current = false;
    }
  };

  const handleScrollToBottom = async () => {
    const container = containerRef.current;
    if (
      !container ||
      !prevCursor ||
      !id ||
      !currentUserId ||
      isJumpingRef.current ||
      isFetchingNewerRef.current
    )
      return;
    if (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100
    ) {
      isFetchingNewerRef.current = true;
      const res = await messageService.getNewerMessages(
        id,
        currentUserId,
        prevCursor,
        20,
      );
      if (res.success && res.data.messages.length) {
        dispatch(
          appendMessages({ conversationId: id, messages: res.data.messages }),
        );
        setPrevCursor(res.data.messages[res.data.messages.length - 1]._id);
      } else {
        setPrevCursor(null);
      }
      isFetchingNewerRef.current = false;
    }
  };
  // --- ACTIONS ---
  const onSendMessage = async (text: string) => {
    if (!id || !currentUserId || !text.trim()) return;
    try {
      const res = await messageService.sendMessage(
        id,
        currentUserId,
        replyingMessage?._id,
        { text },
      );

      // Cập nhật local store từ response API để UI phản hồi ngay (không phụ thuộc socket)
      const msg = res?.data ?? res;
      if (msg) {
        const messageObj = msg.message ?? msg;
        if (messageObj && (messageObj._id || messageObj.messageId)) {
          dispatch(addMessage({ conversationId: id, message: messageObj } as any));
        }
      }
      if (replyingMessage) dispatch(clearReplyingMessage());
    } catch (error) {
      console.error(error);
    }
  };

  const onSendFiles = async (files: FileList) => {
    if (!id || !currentUserId || !files.length) return;
    try {
      const filesArray = Array.from(files);
      const audioFiles = filesArray.filter((f) => f.type.startsWith("audio/"));
      const mediaFiles = filesArray.filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      const docFiles = filesArray.filter(
        (f) =>
          !f.type.startsWith("image/") &&
          !f.type.startsWith("video/") &&
          !f.type.startsWith("audio/"),
      );

      const getAudioDurationSeconds = (file: File) =>
        new Promise<number>((resolve) => {
          const url = URL.createObjectURL(file);
          const audio = new Audio();
          audio.preload = "metadata";
          audio.src = url;

          const cleanup = () => {
            URL.revokeObjectURL(url);
          };

          audio.onloadedmetadata = () => {
            const duration = Number.isFinite(audio.duration)
              ? audio.duration
              : 0;
            cleanup();
            resolve(duration);
          };

          audio.onerror = () => {
            cleanup();
            resolve(0);
          };
        });

      const promises: Promise<any>[] = [];

      // Voice: 1 message / audio file
      for (const file of audioFiles) {
        promises.push(
          (async () => {
            const durationSeconds = await getAudioDurationSeconds(file);
            const voiceDuration = Math.max(1, Math.floor(durationSeconds || 1));
            const formData = new FormData();
            formData.append("conversationId", id);
            formData.append("senderId", currentUserId);
            if (replyingMessage?._id)
              formData.append("repliedId", replyingMessage._id);
            formData.append(
              "content",
              JSON.stringify({
                voiceDuration,
              }),
            );
            formData.append("files", file);
            return messageService.sendVoiceMessage(formData);
          })(),
        );
      }

      if (mediaFiles.length > 0)
        promises.push(
          messageService.sendMessage(
            id,
            currentUserId,
            replyingMessage?._id,
            undefined,
            mediaFiles,
          ),
        );
      docFiles.forEach((file) =>
        promises.push(
          messageService.sendMessage(
            id,
            currentUserId,
            replyingMessage?._id,
            undefined,
            [file],
          ),
        ),
      );

      const results = await Promise.all(promises);

      // Cập nhật ngay các message trả về từ API
      results.forEach((r) => {
        const msg = r?.data ?? r;
        const messageObj = msg?.message ?? msg;
        if (messageObj && (messageObj._id || messageObj.messageId)) {
          dispatch(addMessage({ conversationId: id, message: messageObj } as any));
        }
      });

      if (replyingMessage) dispatch(clearReplyingMessage());
    } catch (error) {
      console.error(error);
    }
  };

  const onSendVoice = async (voice: {
    blob: Blob;
    fileName: string;
    mimeType: string;
    durationMs: number;
  }) => {
    if (!id || !currentUserId) return;

    const formData = new FormData();
    formData.append("conversationId", id);
    formData.append("senderId", currentUserId);
    if (replyingMessage?._id) {
      formData.append("repliedId", replyingMessage._id);
    }

    const audioFile = new File([voice.blob], voice.fileName, {
      type: voice.mimeType || "audio/webm",
    });

    formData.append(
      "content",
      JSON.stringify({
        voiceDuration: Math.max(1, Math.floor(voice.durationMs / 1000)),
      }),
    );
    formData.append("files", audioFile);

    const res = await messageService.sendVoiceMessage(formData);
    // Cập nhật local ngay
    const msg = res?.data ?? res;
    const messageObj = msg?.message ?? msg;
    if (messageObj && (messageObj._id || messageObj.messageId)) {
      dispatch(addMessage({ conversationId: id, message: messageObj } as any));
    }

    if (replyingMessage) dispatch(clearReplyingMessage());
  };

  const handleRecalledMessage = async (messageId: string) => {
    try {
      const res = await messageService.recalledMessage(
        currentUserId,
        messageId,
        id!,
      );

      // Cập nhật UI ngay khi API trả về
      dispatch(updateRecallMessage({ conversationId: id!, messageId }));
      dispatch(updateRecallMessageInConversation({ conversationId: id!, messageId }));
      return res;
    } catch (err) {
      toastAlert("Bạn chỉ có thể thu hồi tin nhắn trong vòng 24 giờ");
    }
  };

  const handlePinnedMessage = async (messageId: string) => {
    try {
      const res = await messageService.pinnedMessage(
        currentUserId,
        messageId,
        id!,
      );

      // Cập nhật UI ngay
      const msgLocal = messages.find((m) => m._id === messageId);
      const newPinned = !msgLocal?.pinned;
      dispatch(updateMessagePinned({ conversationId: id!, messageId, pinned: newPinned }));
      try {
        await handleLoadPinnedMessages();
      } catch (e) {
        // ignore
      }
      return res;
    } catch (err) {
      toastAlert("Bạn chỉ có thể ghim tối đa 3 tin nhắn");
    }
  };

  const handleDeleteMessageForMe = async (messageId: string) => {
    const res = await messageService.deleteMessageForMe(
      currentUserId,
      messageId,
      id!,
    );
    if (res.success) {
      dispatch(
        setMessages({
          conversationId: id!,
          messages: messages.filter((m) => m._id !== messageId),
        }),
      );
      setPinnedMessages((prev) => prev.filter((m) => m._id !== messageId));
      const convs =
        await conversationService.getConversationsFromUserId(currentUserId);
      if (convs.success) dispatch(setConversations(convs.data));
    }
  };

  const handleForwardMessages = async (targetConversationIds: string[]) => {
    try {
      setLoadingForward(true);
      await messageService.forwardMessagesToConversations(
        currentUserId,
        selectedMessages,
        targetConversationIds,
      );
      setShowForwardModal(false);
      setSelectedMessages([]);
      setIsSelected(false);
    } finally {
      setLoadingForward(false);
    }
  };

  useEffect(() => {
    dispatch(setMessages({ conversationId: id || "", messages: [] }));
    setPinnedMessages([]);
    setNextCursor(null);
    setPrevCursor(null);
    isFirstLoad.current = true;
    pendingJumpMessageIdRef.current = selectedMessageId;
    handleLoadMessagesFromConversation();
    handleLoadPinnedMessages();
    messageService.readReceipt(currentUserId, id!);
    dispatch(clearReplyingMessage());
  }, [id, selectedMessageId]);

  useEffect(() => {
    if (!pendingJumpMessageIdRef.current || !messages.length) return;
    const targetMessageId = pendingJumpMessageIdRef.current;
    pendingJumpMessageIdRef.current = null;
    setTimeout(() => {
      handleJumpToMessage(targetMessageId);
    }, 250);
  }, [messages.length]);

  // Xử lý scroll khi nhận stream message AI
  useEffect(() => {
    if (aiStatus && streamingTargetId === id && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [aiStatus, aiStreamingText, streamingTargetId, id]);

  useEffect(() => {
    if (containerRef.current && isFirstLoad.current && messages.length) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      isFirstLoad.current = false;
    }
  }, [messages.length]);

  const handleMessagesExpired = useCallback(
    (data: { conversationId: string; messageIds: string[] }) => {
      if (data.conversationId !== id) return;

      // Dùng dispatch thay vì setMessages
      dispatch(
        updateMessagesExpired({
          conversationId: id,
          messageIds: data.messageIds,
        }),
      );
    },
    [id, dispatch],
  );
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("join_room", id);

    // ✅ Tin nhắn mới: Redux đã được cập nhật từ SocketContext, chỉ cần auto-scroll
    const handleNewMessage = () => {
      // (không cần setMessages)
      const container = containerRef.current;
      if (
        container &&
        container.scrollHeight - container.scrollTop - container.clientHeight <
          150
      ) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    };

    // ✅ Cảm xúc: dùng action updateMessageReaction
    const handleMessageReacted = (data: any) => {
      const conversationId = data.conversationId || id;
      if (conversationId !== id) return;

      dispatch(
        updateMessageReaction({
          conversationId,
          messageId: data.messageId,
          reactions: data.reactions,
        }),
      );
    };

    // ✅ Thu hồi: dùng updateRecallMessage
    const handleMessageRecalled = (data: any) => {
      const conversationId = data.conversationId || id;
      if (conversationId !== id) return;

      dispatch(
        updateRecallMessage({
          conversationId,
          messageId: data.messageId,
        }),
      );
      setPinnedMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    };

    // ✅ Ghim: dùng updateMessagePinned
    const handleMessagePinned = (data: any) => {
      const conversationId = data.conversationId || id;
      if (conversationId !== id) return;

      dispatch(
        updateMessagePinned({
          conversationId,
          messageId: data.messageId,
          pinned: data.pinned,
        }),
      );
      if (Array.isArray(data.pinnedMessages)) {
        setPinnedMessages(data.pinnedMessages);
      }
    };

    // ✅ Cuộc gọi: dùng updateCallStatus
    const handleCallUpdated = (data: any) => {
      if (data.conversationId === id) {
        dispatch(
          updateCallStatus({
            conversationId: id,
            messageId: data.messageId,
            status: data.status,
            duration: data.duration,
          }),
        );
      }
    };

    // ✅ Cuộc gọi nhóm cập nhật (ENDED)
    const handleGroupCallUpdated = (data: any) => {
      console.log("👥 [Web Socket] Group Call Updated:", data);
      if (data.conversationId === id) {
        dispatch(updateCallStatus({
          conversationId: id,
          messageId: data.messageId,
          status: data.status,
        }));
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_reacted", handleMessageReacted);
    socket.on("message_recalled", handleMessageRecalled);
    socket.on("message_pinned", handleMessagePinned);
    socket.on("messages_expired", handleMessagesExpired);
    socket.on("read_receipt", handleReadReceipt);
    socket.on("call_updated", handleCallUpdated);
    socket.on("group_call_updated", handleGroupCallUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_reacted", handleMessageReacted);
      socket.off("message_recalled", handleMessageRecalled);
      socket.off("message_pinned", handleMessagePinned);
      socket.off("messages_expired", handleMessagesExpired);
      socket.off("read_receipt", handleReadReceipt);
      socket.off("call_updated", handleCallUpdated);
      socket.off("group_call_updated", handleGroupCallUpdated);
      socket.emit("leave_room", id);
    };
  }, [socket, id, dispatch, handleMessagesExpired, handleReadReceipt]);

  useEffect(() => {
    if (!id || conversation || isConversationLoading) return;
    navigate("/", { replace: true });
  }, [conversation, id, isConversationLoading, navigate]);

  if (!conversation) {
    return <HomePage />;
  }
  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="flex-1 flex flex-col h-full bg-[#EBECF0] min-w-0">
        <ChatHeader
          conversation={conversation}
          isInfoOpen={isInfoOpen}
          toggleInfo={() => {
            setIsInfoOpen(!isInfoOpen);
            setIsSearchOpen(false);
          }}
          pinnedMessages={pinnedMessages}
          handlePinnedMessage={handlePinnedMessage}
          handleJumpToMessage={handleJumpToMessage}
          isSearchOpen={isSearchOpen}
          toggleSearch={() => {
            setIsSearchOpen(!isSearchOpen);
            setIsInfoOpen(false);
          }}
        />
        {/* Thanh gửi yêu cầu kết bạn */}
        {!isGroup && isFriend === false && (
          <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-3 text-sm">
            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-[#0091ff]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>

            {/* Text */}
            <span className="flex-1 text-gray-600 text-[13px]">
              {friendStatus === "REQUESTED"
                ? "Người này đã gửi lời mời kết bạn cho bạn"
                : friendStatus === "PENDING"
                  ? "Đã gửi lời mời kết bạn"
                  : "Gửi yêu cầu kết bạn tới người này"}
            </span>

            {/* Action button */}
            {friendStatus === "REQUESTED" ? (
              <button
                onClick={handleAcceptFriendRequest}
                className="shrink-0 px-4 py-1.5 bg-[#0091ff] text-white text-[13px] font-medium rounded-md hover:bg-[#0075dd] transition-colors"
              >
                Chấp nhận
              </button>
            ) : friendStatus === "PENDING" ? (
              <span className="shrink-0 px-4 py-1.5 text-gray-400 text-[13px] border border-gray-200 rounded-md">
                Đã gửi
              </span>
            ) : (
              <button
                onClick={handleSendFriendRequest}
                className="shrink-0 px-4 py-1.5 bg-[#0091ff] text-white text-[13px] font-medium rounded-md hover:bg-[#0075dd] transition-colors"
              >
                Gửi kết bạn
              </button>
            )}
          </div>
        )}
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          containerRef={containerRef}
          handleScrollToTop={handleScrollToTop}
          handleScrollToBottom={handleScrollToBottom}
          reactionMessage={(emoji, mid) =>
            messageService.reactionMessage(id!, currentUserId, emoji, mid)
          }
          removeReaction={(mid) =>
            messageService.removeReaction(currentUserId, mid, id!)
          }
          handleRecalledMessage={handleRecalledMessage}
          handlePinnedMessage={handlePinnedMessage}
          handleDeleteMessageForMe={handleDeleteMessageForMe}
          isSelected={isSelected}
          setIsSelected={setIsSelected}
          selectedMessages={selectedMessages}
          toggleSelectMessage={(mid) =>
            setSelectedMessages((p) =>
              p.includes(mid) ? p.filter((i) => i !== mid) : [...p, mid],
            )
          }
          lastMessageId={lastMessageId || ""}
          isGroup={isGroup}
          onJumpToMessage={handleJumpToMessage}
          aiStatus={
            streamingTargetId === id || streamingTargetId === currentUserId
              ? aiStatus
              : null
          }
          aiStreamingText={
            streamingTargetId === id || streamingTargetId === currentUserId
              ? aiStreamingText
              : ""
          }
          aiAvatar={
            conversation?.type === "AI"
              ? conversation?.avatar
              : "https://res.cloudinary.com/dmv766v92/image/upload/v1711111111/ai_avatar_placeholder.png"
          }
        />

        <ChatInput
          chatName={conversation.name}
          onSendMessage={onSendMessage}
          onSendFiles={onSendFiles}
          onSendVoice={onSendVoice}
          isSelected={isSelected}
          setIsSelected={setIsSelected}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          onOpenForwardModal={() => setShowForwardModal(true)}
          conversationId={conversation.conversationId}
        />
      </div>

      <ForwardModal
        open={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        conversations={conversations}
        selectedMessageIds={selectedMessages}
        loadingForward={loadingForward}
        onSubmit={handleForwardMessages}
      />

      <ConversationInfoPanel
        isOpen={isInfoOpen}
        conversation={conversation}
        openedFromSearch={openedFromSearch}
        onClose={() => setIsInfoOpen(false)}
        onConversationCleared={handleConversationCleared}
      />
      <MessageSearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        conversation={conversation}
        onJumpToMessage={handleJumpToMessage}
      />
    </div>
  );
};

export default ConversationPage;




