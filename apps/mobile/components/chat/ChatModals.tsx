import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReactionPicker from "./ReactionPicker";
import ReactionModal from "./ReactionModal";
import ForwardModal from "./ForwardModal";
import MessageDetailModal from "./MessageDetailModal";
import ConversationInfoSheet from "./ConversationInfoSheet";
import MenuItem from "./MenuItem";
import { REACTION_EMOJIS, EMOJI_MAP, type EmojiType } from "@/constants/emoji.constant";
import type { MessagesType, ReactionType } from "@/types/messages.type";

interface ChatModalsProps {
  // Reaction Picker
  reactionPickerMsg: MessagesType | null;
  setReactionPickerMsg: (msg: MessagesType | null) => void;
  user: any;
  handleReaction: (emoji: EmojiType, msgId: string) => void;
  handleRemoveReaction: (msgId: string) => void;

  // Reaction Detail
  reactionModalData: ReactionType[] | null;
  setReactionModalData: (data: ReactionType[] | null) => void;

  // Forward
  showForwardModal: boolean;
  setShowForwardModal: (val: boolean) => void;
  conversations: any[];
  selectedMessages: string[];
  handleForward: (ids: string[]) => void;
  loadingForward: boolean;

  // Message Detail
  detailMessage: MessagesType | null;
  setDetailMessage: (msg: MessagesType | null) => void;

  // Info Sheet
  conversation: any;
  showInfoSheet: boolean;
  setShowInfoSheet: (val: boolean) => void;
  openedFromSearch?: boolean;
  onConversationCleared?: () => void;

  // Context Menu
  contextMenuMsg: MessagesType | null;
  setContextMenuMsg: (msg: MessagesType | null) => void;
  isPinned: boolean;
  handleTogglePin: (id: string) => void;
  handleRecall: (id: string) => void;
  handleDeleteForMe: (id: string) => void;
  dispatch: any;
  setReplyingMessage: any;
  setIsSelectMode: (val: boolean) => void;
  toggleSelectMessage: (id: string) => void;
  onTranslate?: (msg: MessagesType) => void;
}

const ChatModals: React.FC<ChatModalsProps> = ({
  reactionPickerMsg, setReactionPickerMsg, user, handleReaction, handleRemoveReaction,
  reactionModalData, setReactionModalData, showForwardModal, setShowForwardModal,
  conversations, selectedMessages, handleForward, loadingForward,
  detailMessage, setDetailMessage, conversation, showInfoSheet, setShowInfoSheet,
  openedFromSearch,
  onConversationCleared,
  contextMenuMsg, setContextMenuMsg, isPinned, handleTogglePin, handleRecall, handleDeleteForMe,
  dispatch, setReplyingMessage, setIsSelectMode, toggleSelectMessage,
  onTranslate
}) => {
  return (
    <>
      {/* Reaction Picker */}
      {reactionPickerMsg && (
        <ReactionPicker
          visible={true}
          onClose={() => setReactionPickerMsg(null)}
          messageId={reactionPickerMsg._id}
          isMe={reactionPickerMsg.senderId._id === user?.userId}
          messageReactions={reactionPickerMsg.reactions}
          currentUserId={user?.userId || ""}
          onReact={handleReaction}
          onRemoveReaction={handleRemoveReaction}
        />
      )}

      {/* Reaction Detail Modal */}
      {reactionModalData && (
        <ReactionModal
          visible={true}
          onClose={() => setReactionModalData(null)}
          reactions={reactionModalData}
        />
      )}

      {/* Forward Modal */}
      <ForwardModal
        visible={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        conversations={conversations}
        selectedMessageIds={selectedMessages}
        onSubmit={handleForward}
        loadingForward={loadingForward}
      />

      {/* Message Detail Modal */}
      <MessageDetailModal
        visible={!!detailMessage}
        onClose={() => setDetailMessage(null)}
        message={detailMessage}
      />

      {/* Conversation Info Sheet */}
      {conversation && (
        <ConversationInfoSheet
          visible={showInfoSheet}
          onClose={() => setShowInfoSheet(false)}
          conversation={conversation}
          openedFromSearch={openedFromSearch}
          onConversationCleared={onConversationCleared}
        />
      )}

      {/* Context Menu Overlay */}
      {contextMenuMsg && (
        <View className="absolute inset-0 bg-black/20 justify-center items-center z-50">
          <TouchableOpacity
            className="absolute w-full h-full"
            onPress={() => setContextMenuMsg(null)}
          />

          <View className="flex-row bg-white p-2 rounded-[30px] mb-2.5 gap-2.5 shadow-lg">
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  handleReaction(emoji as any, contextMenuMsg._id);
                  setContextMenuMsg(null);
                }}
              >
                <Text className="text-[22px]">{EMOJI_MAP[emoji]}</Text>
              </TouchableOpacity>
            ))}

            {contextMenuMsg.reactions?.some((r) => r.userId?._id === user?.userId) && (
              <TouchableOpacity
                onPress={() => {
                  handleRemoveReaction(contextMenuMsg._id);
                  setContextMenuMsg(null);
                }}
                className="w-9 h-9 justify-center items-center rounded-full bg-[#f3f4f6]"
              >
                <Ionicons name="close" size={18} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>

          <View className="bg-white rounded-xl py-1.5 w-[220px] shadow-lg">
            <MenuItem
              label="Trả lời"
              onPress={() => {
                dispatch(setReplyingMessage(contextMenuMsg));
                setContextMenuMsg(null);
              }}
            />

            <MenuItem
              label="Chuyển tiếp"
              onPress={() => {
                setIsSelectMode(true);
                toggleSelectMessage(contextMenuMsg._id);
                setShowForwardModal(true);
                setContextMenuMsg(null);
              }}
            />

            <MenuItem
              label={isPinned ? "Bỏ ghim" : "Ghim"}
              onPress={() => {
                handleTogglePin(contextMenuMsg._id);
                setContextMenuMsg(null);
              }}
            />

            <MenuItem
              label="Xem chi tiết"
              onPress={() => {
                setDetailMessage(contextMenuMsg);
                setContextMenuMsg(null);
              }}
            />

            {contextMenuMsg.content?.text && !contextMenuMsg.recalled && onTranslate && (
              <MenuItem
                label="Dịch bằng AI"
                onPress={() => {
                  onTranslate(contextMenuMsg);
                  setContextMenuMsg(null);
                }}
              />
            )}

            <MenuItem
              label="Xóa phía tôi"
              danger
              onPress={() => {
                handleDeleteForMe(contextMenuMsg._id);
                setContextMenuMsg(null);
              }}
            />

            {(typeof contextMenuMsg.senderId === "string" ? contextMenuMsg.senderId : contextMenuMsg.senderId?._id) === user?.userId && !contextMenuMsg.recalled && (
              <MenuItem
                label="Thu hồi"
                danger
                onPress={() => {
                  handleRecall(contextMenuMsg._id);
                  setContextMenuMsg(null);
                }}
              />
            )}
          </View>
        </View>
      )}
    </>
  );
};

export default ChatModals;
