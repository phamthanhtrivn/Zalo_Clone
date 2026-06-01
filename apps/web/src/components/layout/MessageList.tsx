import { memo, useEffect, useState, useMemo } from "react";
import { useSearchParams, useParams, useLocation } from "react-router-dom";
import {
  formatTime,
  getDateLabel,
  isSameHourAndMinute,
} from "@/utils/format-message-time..util";
import AppAvatar from "../common/AppAvatar";
import type { MessagesType } from "@/types/messages.type";
import type { RefObject } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { userService } from "@/services/user.service"; // Assuming userService exists
import { useAppSelector } from "@/store"; // To get current user ID

type Props = {
  messages: MessagesType[];
  currentUserId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  handleScrollToTop: () => void;
  // New props for friend status (can be passed from parent or derived from location.state)
  otherUserId?: string; // The ID of the other user in a direct conversation
  isDirectConversation?: boolean; // Flag to indicate if it's a 1-1 chat
};

const MessageList = ({
  messages,
  currentUserId,
  containerRef,
  handleScrollToTop,
  otherUserId,
  isDirectConversation,
}: Props) => {
  const { socket } = useSocket();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetMessageId = searchParams.get("messageId");
  const location = useLocation();
  const { otherUserId: otherUserIdFromState, isNewContact: isNewContactFromState } = location.state || {};
  const user = useAppSelector((state) => state.auth.user);
  const conversations = useAppSelector((state) => state.conversation.conversations);

  // Tìm thông tin cuộc hội thoại hiện tại từ store để lấy otherMemberId nếu cần
  const currentConversation = useMemo(() =>
    conversations.find(c => c.conversationId === id),
    [conversations, id]);

  // Xác định ID của người đối diện và loại hội thoại
  const finalOtherUserId = useMemo(() =>
    otherUserId || otherUserIdFromState || currentConversation?.otherMemberId,
    [otherUserId, otherUserIdFromState, currentConversation]);

  const finalIsDirect = useMemo(() =>
    isDirectConversation || currentConversation?.type === "DIRECT" || !!isNewContactFromState,
    [isDirectConversation, currentConversation, isNewContactFromState]);

  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [hasReceivedRequest, setHasReceivedRequest] = useState(false); // New state for received request
  const [friendStatus, setFriendStatus] = useState<string | null>(null);
  const isBlocked =
    friendStatus === "BLOCKED" || friendStatus === "BLOCKED_BY_OTHER";

  // Kiểm tra trạng thái bạn bè thực tế từ Server
  useEffect(() => {
    const verifyFriendship = async () => {
      if (finalOtherUserId && finalIsDirect) {
        try {
          // Gọi service để kiểm tra xem đã là bạn bè chưa
          const res = await userService.checkFriendStatus(finalOtherUserId);
          if (res.success && res.data) {
            setIsFriend(res.data.isFriend);
            setFriendStatus(res.data.status ?? null);
            // Reset states first
            setFriendRequestSent(false);
            setHasReceivedRequest(false);
            // Nếu chưa là bạn
            if (!res.data.isFriend) {
              // Kiểm tra nếu mình đã gửi lời mời
              if (res.data.status === "PENDING") {
                setFriendRequestSent(true);
              }
              // Kiểm tra nếu đối phương đã gửi lời mời cho mình
              else if (res.data.status === "REQUESTED") {
                setHasReceivedRequest(true);
              }
            }
          }
        } catch (error) {
          // Fallback: Nếu lỗi API, sử dụng logic tạm thời từ state tìm kiếm
          setIsFriend(!isNewContactFromState);
        }
      }
    };

    verifyFriendship();

    if (!socket || !finalOtherUserId || !finalIsDirect) return;
    const handleEvent = () => {
      verifyFriendship();
    };
    socket.on("receive_friend_request", handleEvent);
    socket.on("friend_accepted", handleEvent);
    socket.on("cancel_friend_request", handleEvent);
    socket.on("blocked", handleEvent);
    socket.on("blocked_by", handleEvent);
    socket.on("unblocked", handleEvent);
    socket.on("friend_status_updated", handleEvent);

    return () => {
      socket.off("receive_friend_request", handleEvent);
      socket.off("friend_accepted", handleEvent);
      socket.off("cancel_friend_request", handleEvent);
      socket.off("blocked", handleEvent);
      socket.off("blocked_by", handleEvent);
      socket.off("unblocked", handleEvent);
      socket.off("friend_status_updated", handleEvent);
    };
  }, [finalOtherUserId, finalIsDirect, isNewContactFromState, socket]);

  const handleAddFriend = async () => {
    if (!finalOtherUserId || !user?.userId) return;
    try {
      await userService.addFriend(finalOtherUserId, user.userId);
      setFriendRequestSent(true);
    } catch (error) {
      console.error("Failed to send friend request:", error);
    }
  };

  const handleAcceptFriend = async () => {
    if (!finalOtherUserId || !user?.userId) return;
    try {
      await userService.acceptFriend(finalOtherUserId, user.userId);
      setIsFriend(true); // Cập nhật trạng thái là bạn bè
      setHasReceivedRequest(false); // Ẩn thông báo lời mời
      setFriendStatus("ACCEPTED");
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    }
  };

  const handleUnblockFriend = async () => {
    if (!finalOtherUserId || !user?.userId) return;
    try {
      await userService.unblockFriend(finalOtherUserId, user.userId);
      setIsFriend(false);
      setFriendRequestSent(false);
      setHasReceivedRequest(false);
      setFriendStatus(null);
    } catch (error) {
      console.error("Failed to unblock friend:", error);
    }
  };

  // Logic cuộn đến tin nhắn cụ thể khi được chọn từ kết quả tìm kiếm
  useEffect(() => {
    if (targetMessageId && messages.length > 0) {
      // Đợi một khoảng ngắn để đảm bảo DOM đã render xong
      const timer = setTimeout(() => {
        const element = document.getElementById(`message-${targetMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });

          // Hiệu ứng highlight để người dùng nhận diện tin nhắn vừa tìm
          element.classList.add("ring-2", "ring-blue-400", "ring-offset-2", "bg-blue-50/50");

          // Xóa highlight và query param sau khi xem xong để tránh scroll lại ngoài ý muốn
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-blue-400", "ring-offset-2", "bg-blue-50/50");
            setSearchParams({}, { replace: true });
          }, 2000);
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [targetMessageId, messages, setSearchParams]);

  // Logic tự động render lại khi có tin nhắn hết hạn trong danh sách hiện tại
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const now = Date.now();
    // Tìm các tin nhắn chưa hết hạn nhưng có thời gian hết hạn trong tương lai
    const expiringMessages = messages.filter((m) =>
      m.expiredAt && !m.expired && new Date(m.expiredAt).getTime() > now
    );

    if (expiringMessages.length === 0) return;

    // Tìm thời điểm hết hạn gần nhất
    const nextExpiryTime = Math.min(
      ...expiringMessages.map((m) => new Date(m.expiredAt!).getTime())
    );

    const delay = nextExpiryTime - now;

    // Đặt timer để render lại component ngay khi tin nhắn đó hết hạn
    const timer = setTimeout(() => {
      setTick((t) => t + 1);
    }, delay + 100); // Thêm 100ms để đảm bảo điều kiện < new Date() thỏa mãn

    return () => clearTimeout(timer);
  }, [messages, tick]);

  return (
    <>
      {/* Thanh gửi yêu cầu kết bạn - hiện khi đang chat với người chưa kết bạn */}
      {finalIsDirect && finalOtherUserId && !isFriend && currentConversation?.type !== "AI" && finalOtherUserId !== "69f438929cf8b39d88abd220" && (
        <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-3 text-sm shadow-sm">
          {/* Icon */}
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#0091ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>

          {/* Text */}
          <span className="flex-1 text-gray-600 text-[13px]">
            {isBlocked
              ? friendStatus === "BLOCKED"
                ? "Bạn đã chặn người này"
                : "Người này đã chặn bạn"
              : hasReceivedRequest
                ? "Người này đã gửi lời mời kết bạn cho bạn"
                : friendRequestSent
                  ? "Đã gửi lời mời kết bạn"
                  : "Gửi yêu cầu kết bạn tới người này"}
          </span>

          {/* Action button */}
          {isBlocked ? (
            <button
              onClick={handleUnblockFriend}
              disabled={friendStatus === "BLOCKED_BY_OTHER"}
              className={`shrink-0 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${friendStatus === "BLOCKED_BY_OTHER"
                ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                : "bg-[#0091ff] text-white hover:bg-[#0075dd]"
                }`}
            >
              {friendStatus === "BLOCKED_BY_OTHER" ? "Đã bị chặn" : "Gỡ chặn"}
            </button>
          ) : hasReceivedRequest ? (
            <button
              onClick={handleAcceptFriend}
              className="shrink-0 px-4 py-1.5 bg-[#0091ff] text-white text-[13px] font-medium rounded-md hover:bg-[#0075dd] transition-colors"
            >
              Chấp nhận
            </button>
          ) : friendRequestSent ? (
            <span className="shrink-0 px-4 py-1.5 text-gray-400 text-[13px] border border-gray-200 rounded-md cursor-not-allowed">
              Đã gửi
            </span>
          ) : (
            <button
              onClick={handleAddFriend}
              className="shrink-0 px-4 py-1.5 bg-[#0091ff] text-white text-[13px] font-medium rounded-md hover:bg-[#0075dd] transition-colors"
            >
              Gửi kết bạn
            </button>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScrollToTop}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {messages.map((message, index) => {
          const prev = messages[index - 1];
          const next = messages[index + 1];

          const isMe = message.senderId._id === currentUserId;
          const isRecalled = message.recalled;
          const messageExpiresAt = message.expiredAt;
          const isExpired =
            message.expired ||
            (!!messageExpiresAt &&
              new Date(messageExpiresAt).getTime() <= Date.now());

          const showDivider =
            !prev ||
            new Date(prev.createdAt).toDateString() !==
            new Date(message.createdAt).toDateString();

          const sameSenderPrev =
            prev && prev.senderId._id === message.senderId._id;

          const sameSenderNext =
            next && next.senderId._id === message.senderId._id;

          const sameMinutePrev =
            prev && isSameHourAndMinute(prev.createdAt, message.createdAt);

          const sameMinuteNext =
            next && isSameHourAndMinute(next.createdAt, message.createdAt);

          const isFirstInCluster = !(sameSenderPrev && sameMinutePrev);
          const isLastInCluster = !(sameSenderNext && sameMinuteNext);

          const showAvatar = !isMe && isFirstInCluster;
          const showTime = isLastInCluster;
          return (
            <div key={message._id} id={`message-${message._id}`} className="transition-all duration-500 rounded-lg">
              {showDivider && (
                <div className="flex justify-center my-4">
                  <span className="bg-[#BABBBE] text-white text-xs px-3 py-1 rounded-md">
                    {getDateLabel(message.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
              >
                {!isMe &&
                  (showAvatar ? (
                    <AppAvatar
                      src={message.senderId?.profile?.avatarUrl}
                      name={message.senderId?.profile?.name || "User"}
                      className="w-8 h-8 text-[10px]"
                    />
                  ) : (
                    <div className="w-8" />
                  ))}

                <div className="flex flex-col items-end gap-1 max-w-md">
                  <div
                    className={`rounded-md px-3 py-2 border shadow-sm ${isMe
                      ? "bg-[#E5F1FF]"
                      : "bg-white"
                      } ${isExpired || isRecalled ? "bg-gray-100 text-gray-400" : ""}`}
                  >
                    {/* 🔥 Nội dung */}
                    <div className="space-y-1 wrap-break-word">
                      {isRecalled ? (
                        <div className="text-gray-400 italic">
                          Tin nhắn đã bị thu hồi
                        </div>
                      ) : isExpired ? (
                        <div className="text-gray-400 italic">
                          Tin nhắn đã hết hạn
                        </div>
                      ) : (
                        <>
                          {message.content?.text && <p>{message.content.text}</p>}
                          {message.content?.icon && (
                            <p className="text-2xl">{message.content.icon}</p>
                          )}
                          {message.content?.file && <div>File</div>}
                        </>
                      )}
                    </div>

                    {/* Time */}
                    {showTime && (
                      <div className="text-[13px] text-gray-700 mt-1">
                        {formatTime(message.createdAt)}
                      </div>
                    )}
                  </div>

                  {/* ✅ Hiển thị Avatar những người đã đọc (Read Receipts) */}
                  {!isExpired && !isRecalled && message.readReceipts && message.readReceipts.length > 0 && (
                    <div className={`flex items-center gap-0.5 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                      {message.readReceipts.filter((receipt: any) => !!receipt?.userId?.profile?.avatarUrl).map((receipt: any) => {
                        const reader = receipt.userId;
                        const readerId = reader?._id || reader;
                        // Không hiện avatar của chính mình dưới tin nhắn mình đã đọc
                        if (readerId === currentUserId) return null;

                        return (
                          <AppAvatar
                            key={readerId}
                            src={reader?.profile?.avatarUrl}
                            name={reader?.profile?.name || "User"}
                            className="w-3.5 h-3.5 border border-white text-[5px]"
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default memo(MessageList);
