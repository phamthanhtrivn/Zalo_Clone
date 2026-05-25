import AppAvatar from "@/components/common/AppAvatar";
import { Quote, MoreHorizontal } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionSummary } from "./ReactionSummary";
import type { MessagesType, ReactionType } from "@/types/messages.type";
import type { EmojiType } from "@/constants/emoji.constant";
import { useState, useEffect } from "react";
import { BsPinAngle } from "react-icons/bs";
import { IoIosInformationCircleOutline } from "react-icons/io";
import { CgUndo } from "react-icons/cg";
import { RiUnpinLine } from "react-icons/ri";
import { FaRegTrashAlt } from "react-icons/fa";
import ViewDetailMessageModal from "./ViewDetailMessageModal";
import { FaListCheck } from "react-icons/fa6";
import { useAppDispatch } from "@/store";
import { setReplyingMessage } from "@/store/slices/conversationSlice";

interface Props {
  message: MessagesType;
  isMe: boolean;
  showAvatar: boolean;
  showTime: boolean;
  reactionMessage: (emojiType: EmojiType, messageId: string) => void;
  onOpenReactionModal: (reactions: ReactionType[]) => void;
  removeReaction: (messageId: string) => void;
  handleRecalledMessage: (messageId: string) => void;
  handlePinnedMessage: (messageId: string) => void;
  handleDeleteMessageForMe: (messageId: string) => void;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
  selectedMessages: string[];
  toggleSelectMessage: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  members?: any[];
  onShowProfile?: (profileId: string) => void;
}

export const MessageItem = ({
  message,
  isMe,
  showAvatar,
  showTime,
  reactionMessage,
  onOpenReactionModal,
  removeReaction,
  handleRecalledMessage,
  handlePinnedMessage,
  handleDeleteMessageForMe,
  isSelected,
  setIsSelected,
  selectedMessages,
  toggleSelectMessage,
  onJumpToMessage,
  members,
  onShowProfile,
}: Props) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className={`flex items-end gap-2 ${isMe || message.expired ? "justify-end" : ""}`}>
      {!isMe &&
        (showAvatar ? (
          <AppAvatar
            src={message.senderId?.profile?.avatarUrl}
            name={message.senderId?.profile?.name || "User"}
            className="h-8 w-8 text-[10px]"
            isAI={message.type === "AI"}
          />
        ) : (
          <div className="w-8" />
        ))}

      {/* BUBBLE WRAPPER */}
      <div
        className={`flex group items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"
          }`}
      >
        <div className="relative flex group/bubble">
          <MessageBubble
            message={message}
            isMe={isMe}
            showTime={showTime}
            isSelected={isSelected}
            selectedMessages={selectedMessages}
            toggleSelectMessage={toggleSelectMessage}
            onJumpToMessage={onJumpToMessage}
            members={members}
            onShowProfile={onShowProfile}
          />

          {!message.recalled && (
            <>
              <ReactionPicker
                messageId={message._id}
                reactionMessage={reactionMessage}
                messageReactions={message.reactions}
                isMe={isMe}
                removeReaction={removeReaction}
              />

              <ReactionSummary
                reactions={message.reactions}
                onClick={onOpenReactionModal}
              />
            </>
          )}
        </div>

        {/* ACTIONS */}
        {!message.recalled && (
          <div
            className="
            relative flex items-center gap-1
            opacity-0 group-hover:opacity-100
            transition-all duration-200
          "
          >
            <button
              title="Trả lời"
              onClick={(e) => {
                e.stopPropagation();
                dispatch(setReplyingMessage(message));
              }}
              className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-blue-500"
            >
              <Quote size={10} className="fill-current" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === message._id ? null : message._id);
              }}
              title="Thêm"
              className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-blue-500"
            >
              <MoreHorizontal size={10} />
            </button>

            {/* MENU MORE ACTION */}
            {openMenuId === message._id && (
              <div
                className={`
                absolute top-1/2 -translate-y-1/2
                ${isMe ? "right-full mr-2" : "left-full ml-2"}
                w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-50
                py-1
                animate-in fade-in zoom-in-95 duration-150
              `}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Ghim */}
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => {
                    handlePinnedMessage(openMenuId);
                    setOpenMenuId(null);
                  }}
                >
                  {!message.pinned ? (
                    <>
                      <BsPinAngle className="text-base text-gray-500" />
                      <span>Ghim tin nhắn</span>
                    </>
                  ) : (
                    <>
                      <RiUnpinLine className="text-base text-gray-500" />
                      <span>Bỏ ghim tin nhắn</span>
                    </>
                  )}
                </button>

                {/* Chọn nhiều tin nhắn */}
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => {
                    setIsSelected(true);
                    toggleSelectMessage(message._id);
                    setOpenMenuId(null);
                  }}
                >
                  <FaListCheck className="text-base text-gray-500" />
                  <span>Chọn nhiều tin nhắn</span>
                </button>

                {/* Chi tiết */}
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => {
                    setShowDetailModal(true);
                    setOpenMenuId(null);
                  }}
                >
                  <IoIosInformationCircleOutline className="text-base text-gray-500" />
                  <span>Xem chi tiết</span>
                </button>

                <div className="my-1 border-t border-gray-200" />

                {/* Divider */}
                {isMe && (
                  <>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                      onClick={() => {
                        handleRecalledMessage(openMenuId);
                        setOpenMenuId(null);
                      }}
                    >
                      <CgUndo className="text-base" />
                      <span>Thu hồi</span>
                    </button>
                  </>
                )}

                {/* Xóa chỉ ở phía tôi */}
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  onClick={() => handleDeleteMessageForMe(message._id)}
                >
                  <FaRegTrashAlt className="text-base" />
                  <span>Xóa chỉ ở phía tôi</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>



      {showDetailModal && (
        <ViewDetailMessageModal
          selectedMessage={message}
          setShowDetailModal={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
};

