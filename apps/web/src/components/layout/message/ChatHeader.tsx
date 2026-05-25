import { Video, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { MdGroupAdd } from "react-icons/md";
import { LuPanelRight, LuPanelRightClose } from "react-icons/lu";
import type { ConversationItemType } from "@/types/conversation-item.type";
import AppAvatar from "@/components/common/AppAvatar";
import { Button } from "@/components/ui/button";
import type { MessagesType } from "@/types/messages.type";
import PinnedMessagesBar from "./PinnedMessagesBar";
import { useCall } from "@/contexts/VideoCallContext";
import { useAppSelector } from "@/store";
import { CallType } from "@/constants/types";
import { formatLastSeen } from "@/utils/lastSeen.util";

type ChatHeaderProps = {
  conversation: ConversationItemType;
  isInfoOpen: boolean;
  toggleInfo: () => void;
  pinnedMessages: MessagesType[];
  handlePinnedMessage: (messageId: string) => void;
  handleJumpToMessage: (messageId: string) => void;
  isSearchOpen: boolean;
  toggleSearch: () => void;
};

const ChatHeader = ({
  conversation,
  isInfoOpen,
  toggleInfo,
  pinnedMessages,
  handlePinnedMessage,
  handleJumpToMessage,
  isSearchOpen,
  toggleSearch,
}: ChatHeaderProps) => {
  const { startGroupCall, startDirectCall } = useCall();
  const currentUserId = useAppSelector((state) => state.auth.user?.userId);
  const [isInitializingCall, setIsInitializingCall] = useState(false);
  const [, setTick] = useState(0);

  // Tự động cập nhật lại thời gian "Hoạt động X phút trước" mỗi 30 giây
  useEffect(() => {
    if (conversation.type !== "DIRECT" || conversation.isOnline) return;

    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);

    return () => clearInterval(timer);
  }, [conversation.isOnline, conversation.lastSeenAt, conversation.type]);

  const otherMemberId =
    conversation?.participants?.find((id: string) => id !== currentUserId) ||
    (conversation as any)?.otherMemberId;

  const handleVideoCall = async () => {
    if (
      !conversation.conversationId ||
      !currentUserId ||
      isInitializingCall
    ) {
      console.log("Không đủ thông tin hoặc đang khởi tạo cuộc gọi");
      return;
    }

    setIsInitializingCall(true);
    try {
      if (conversation.type === "GROUP") {
        await startGroupCall(
          conversation.conversationId,
          CallType.VIDEO
        );
      } else {
        await startDirectCall(
          otherMemberId,
          conversation.conversationId,
          CallType.VIDEO,
          conversation.name,
          conversation.avatar
        );
      }
    } catch (error) {
      console.log("Lỗi khi khởi tạo cuộc gọi:", error);
    } finally {
      setIsInitializingCall(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <AppAvatar
            src={conversation?.avatar}
            name={conversation?.name || ""}
            isAI={conversation?.type === "AI"}
            isOnline={conversation?.type === "DIRECT" && conversation?.isOnline}
            className="w-10 h-10 border-0 shadow-sm"
          />

          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-gray-800 truncate flex items-center gap-1">
              {conversation.name}
            </h3>
            {conversation.type !== "AI" && (
              <span className="text-[12px] text-gray-400 select-none">
                {conversation.type === "DIRECT" ? (
                  conversation.isOnline ? (
                    <span className="text-[#0084ff] font-medium">Đang hoạt động</span>
                  ) : (
                    <span>{formatLastSeen(conversation.lastSeenAt)}</span>
                  )
                ) : (
                  <span>Trò chuyện nhóm</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {conversation?.type !== "AI" && (
            <>
              <Button variant="ghost" size="icon">
                <MdGroupAdd />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleVideoCall}
                disabled={isInitializingCall}
              >
                {isInitializingCall ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Video />
                )}
              </Button>
            </>
          )}

          <Button
            variant={isSearchOpen ? "default" : "ghost"}
            size="icon"
            onClick={toggleSearch}
          >
            <Search color={isSearchOpen ? "white" : "currentColor"} />
          </Button>

          <Button
            variant={isInfoOpen ? "default" : "ghost"}
            size="icon"
            onClick={toggleInfo}
          >
            {isInfoOpen ? (
              <LuPanelRightClose color="white" />
            ) : (
              <LuPanelRight />
            )}
          </Button>
        </div>
      </header>

      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        handlePinnedMessage={handlePinnedMessage}
        onClickMessage={handleJumpToMessage}
      />
    </>
  );
};

export default ChatHeader;
