import { memo, useState, useEffect } from "react";
import AppAvatar from "@/components/common/AppAvatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  getDateLabel,
  isSameHourAndMinute,
} from "@/utils/format-message-time..util";
import type { MessagesType, ReactionType } from "@/types/messages.type";
import type { RefObject } from "react";
import type { EmojiType } from "@/constants/emoji.constant";
import { ReactionModal } from "./ReactionModal";
import { MessageItem } from "./MessageItem";
import { SystemMessage } from "./SystemMessage";

type Props = {
  messages: MessagesType[];
  currentUserId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  handleScrollToTop: () => void;
  handleScrollToBottom: () => void;
  reactionMessage: (emojiType: EmojiType, messageId: string) => void;
  removeReaction: (messageId: string) => void;
  handleRecalledMessage: (messageId: string) => void;
  handlePinnedMessage: (messageId: string) => void;
  handleDeleteMessageForMe: (messageId: string) => void;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
  selectedMessages: string[];
  toggleSelectMessage: (messageId: string) => void;
  lastMessageId: string;
  isGroup: boolean;
  onJumpToMessage?: (messageId: string) => void;
  aiStatus?: "thinking" | "typing" | null;
  aiStreamingText?: string;
  aiAvatar?: string;
  members?: any[];
  onShowProfile?: (profileId: string) => void;
};

const MessageList = ({
  messages,
  currentUserId,
  containerRef,
  handleScrollToTop,
  handleScrollToBottom,
  reactionMessage,
  removeReaction,
  handleRecalledMessage,
  handlePinnedMessage,
  handleDeleteMessageForMe,
  isSelected,
  setIsSelected,
  selectedMessages,
  toggleSelectMessage,
  lastMessageId,
  isGroup,
  onJumpToMessage,
  aiStatus,
  aiStreamingText,
  aiAvatar,
  members,
  onShowProfile,
}: Props) => {
  const [selectedMessageReactions, setSelectedMessageReactions] = useState<
    ReactionType[] | null
  >(null);

  return (
    <div
      ref={containerRef}
      onScroll={() => {
        handleScrollToTop();
        handleScrollToBottom();
      }}
      className="flex-1 overflow-y-auto p-4 space-y-1"
    >
      {selectedMessageReactions && (
        <ReactionModal
          reactions={selectedMessageReactions}
          onClose={() => setSelectedMessageReactions(null)}
        />
      )}
      {messages.map((message, index) => {
        const prev = messages[index - 1];
        const next = messages[index + 1];

        // 1. Kiểm tra isMe và isSystem
        const isMe =
          message.type !== "SYSTEM" && message.senderId?._id === currentUserId;
        const isSystem = message.type === "SYSTEM";

        // 2. Logic gom nhóm tin nhắn
        const sameSenderPrev =
          !isSystem &&
          prev &&
          prev.type !== "SYSTEM" &&
          prev.senderId?._id === message.senderId?._id;
        const sameSenderNext =
          !isSystem &&
          next &&
          next.type !== "SYSTEM" &&
          next.senderId?._id === message.senderId?._id;

        const sameMinutePrev =
          prev && isSameHourAndMinute(prev.createdAt, message.createdAt);
        const sameMinuteNext =
          next && isSameHourAndMinute(next.createdAt, message.createdAt);

        const isFirstInCluster = !(sameSenderPrev && sameMinutePrev);
        const isLastInCluster = !(sameSenderNext && sameMinuteNext);

        // 3. Hiển thị Avatar, Thời gian và Divider ngày
        const showAvatar = !isSystem && !isMe && isFirstInCluster;
        const showTime = !isSystem && isLastInCluster;
        const isLastMessage = lastMessageId === message._id;

        const showDivider =
          !prev ||
          new Date(prev.createdAt).toDateString() !==
          new Date(message.createdAt).toDateString();

        return (
          <div
            id={message._id}
            key={message._id}
            className={
              message.reactions && message.reactions.length > 0 ? "mb-4" : ""
            }
          >
            {showDivider && (
              <div className="flex justify-center my-4">
                <span className="bg-[#BABBBE] text-white text-xs px-3 py-1 rounded-md">
                  {getDateLabel(message.createdAt)}
                </span>
              </div>
            )}

            {isSystem ? (
              <SystemMessage message={message} />
            ) : (
              <MessageItem
                message={message}
                isMe={isMe}
                showAvatar={showAvatar}
                showTime={showTime}
                reactionMessage={reactionMessage}
                onOpenReactionModal={(reactions) =>
                  setSelectedMessageReactions(reactions)
                }
                removeReaction={removeReaction}
                handleRecalledMessage={handleRecalledMessage}
                handlePinnedMessage={handlePinnedMessage}
                handleDeleteMessageForMe={handleDeleteMessageForMe}
                isSelected={isSelected}
                setIsSelected={setIsSelected}
                selectedMessages={selectedMessages}
                toggleSelectMessage={toggleSelectMessage}
                isGroup={isGroup}
                onJumpToMessage={onJumpToMessage}
                members={members}
                onShowProfile={onShowProfile}
              />
            )}

            {isLastMessage && !message.recalled && message.readReceipts && message.readReceipts.length > 0 && (
              <div className={`flex ${isMe ? "justify-end" : "justify-start ml-11"} mt-1 pr-1`}>
                <div className="flex items-center">
                  {message.readReceipts
                    .filter(
                      (receipt: any) =>
                        !!(
                          receipt.userId?.profile?.avatarUrl ||
                          receipt.userId?.avatarUrl
                        ),
                    )
                    .slice(0, 3)
                    .map((receipt: any, idx: number) => {
                      const avatarUrl =
                        receipt.userId?.profile?.avatarUrl ||
                        receipt.userId?.avatarUrl ||
                        "";
                      const userName =
                        receipt.userId?.profile?.name ||
                        receipt.userId?.name ||
                        "User";

                      return (
                        <AppAvatar
                          key={idx}
                          src={avatarUrl}
                          name={userName}
                          className="w-4 h-4 border border-white text-[8px]"
                        />
                      );
                    })}
                  {message.readReceipts.filter(
                    (receipt: any) =>
                      !!(
                        receipt.userId?.profile?.avatarUrl ||
                        receipt.userId?.avatarUrl
                      ),
                  ).length > 3 && (
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-[10px] flex items-center justify-center border border-white">
                        +{message.readReceipts.filter(
                          (receipt: any) =>
                            !!(
                              receipt.userId?.profile?.avatarUrl ||
                              receipt.userId?.avatarUrl
                            ),
                        ).length - 3}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* AI STREAMING MESSAGE */}
      {aiStatus && (
        <div className="flex items-end gap-2 mt-2">
          {aiAvatar ? (
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img src={aiAvatar} alt="AI" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
              AI
            </div>
          )}

          <div className="bg-white rounded-lg px-3 py-2 max-w-md border shadow-sm">
            {aiStatus === "thinking" ? (
              <p className="text-[15px] italic text-gray-400 animate-pulse">
                AI đang suy nghĩ...
              </p>
            ) : (
              <div className="text-[15px] text-gray-800 markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {aiStreamingText}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default memo(MessageList);
