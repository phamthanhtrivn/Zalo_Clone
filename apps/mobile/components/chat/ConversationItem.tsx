import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ConversationItemType } from "@/types/conversation-item.type";

import { MaterialIcons, Ionicons, Feather } from "@expo/vector-icons";
import { formatMessageTime } from "@/utils/format-message-time.util";
import {
  pinConversation,
  unpinConversation,
  hideConversation,
  unhideConversation,
  muteConversation,
  unmuteConversation,
  deleteConversation,
} from "@/services/conversation-settings.service";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  updateConversationSetting,
  removeConversation,
  setUnreadCount,
} from "@/store/slices/conversationSlice";
import GroupAvatar from "../ui/GroupAvatar";
import { useSocket } from "@/contexts/SocketContext";
import ConversationPinModal from "./ConversationPinModal";
const SCREEN_HEIGHT = Dimensions.get("window").height;

interface Props {
  conversation: ConversationItemType;
  currentUserId: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
}

type SubMenu = "mute" | null;

const ConversationItem: React.FC<Props> = React.memo(({
  conversation,
  currentUserId,
  isSelectMode = false,
  isSelected = false,
  onSelectToggle,
}) => {
  const { socket, markAsRead, markAsUnread } = useSocket();  // ✅ Lấy cả 3
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [subMenu, setSubMenu] = useState<SubMenu>(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinAction, setPinAction] = useState<"hide" | "unhide" | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const user = useAppSelector((state) => state.auth.user);
  const authUserId = user?.userId || (user as any)?._id || "";
  const dispatch = useAppDispatch();
  const isUnread = (conversation.unreadCount ?? 0) > 0;
  const lastMessage = conversation.lastMessage;
  const isRecall = lastMessage?.recalled;

  const preview = useMemo(() => {
    const lastMsg = conversation.lastMessage;
    const content = lastMsg?.content;
    const call = (lastMsg as any)?.call;

    if (!lastMsg) {
      return { icon: null, text: "Chưa có tin nhắn" };
    }

    if (isRecall) {
      return {
        icon: null,
        text: "Tin nhắn đã được thu hồi",
      };
    }
    if (lastMsg.expired) {
      return {
        icon: null,
        text: "Tin nhắn đã hết hạn",
      };
    }

    if (call) {
      const isVideo = call.type === "VIDEO";
      if (call.status === "MISSED" || call.status === "REJECTED") {
        return {
          icon: (
            <Ionicons
              name={isVideo ? "videocam-outline" : "call-outline"}
              size={14}
              color="#ef4444"
            />
          ),
          text: "Cuộc gọi nhỡ",
        };
      }
      if (call.status === "BUSY") {
        return {
          icon: (
            <Ionicons
              name={isVideo ? "videocam-outline" : "call-outline"}
              size={14}
              color="#f59e0b"
            />
          ),
          text: "Cuộc gọi bận",
        };
      }
      return {
        icon: (
          <Ionicons
            name={isVideo ? "videocam-outline" : "call-outline"}
            size={14}
            color="#6b7280"
          />
        ),
        text: `Cuộc gọi ${isVideo ? "video" : "thoại"}`,
      };
    }

    if ((lastMsg as any)?.type === "SYSTEM") {
      return {
        icon: (
          <Ionicons
            name="information-circle-outline"
            size={14}
            color="#6b7280"
          />
        ),
        text: content?.text || "Tin nhắn hệ thống",
      };
    }

    if (!content) return { icon: null, text: "Tin nhắn" };

    if (content.text && /https?:\/\//.test(content.text)) {
      return {
        icon: <Feather name="link" size={14} color="#6b7280" />,
        text: content.text,
      };
    }

    if (content.icon) {
      return {
        icon: <MaterialIcons name="emoji-emotions" size={14} color="#6b7280" />,
        text: "Sticker",
      };
    }

    if (Array.isArray(content.files) && content.files.length > 0) {
      switch (content.files[content.files.length - 1].type) {
        case "IMAGE":
          return {
            icon: <MaterialIcons name="image" size={14} color="#6b7280" />,
            text: "Hình ảnh",
          };
        case "VIDEO":
          return {
            icon: <MaterialIcons name="videocam" size={14} color="#6b7280" />,
            text: "Video",
          };
        case "FILE":
          return {
            icon: (
              <MaterialIcons name="attach-file" size={14} color="#6b7280" />
            ),
            text: content.files[0].fileName,
          };
        case "VOICE":
          return {
            icon: <Ionicons name="mic" size={14} color="#6b7280" />,
            text: "Tin nhắn thoại",
          };
        default:
          return { icon: null, text: "Tin nhắn" };
      }
    }

    if (content.text) {
      return {
        icon: null,
        text: content.text,
      };
    }

    return { icon: null, text: "Tin nhắn" };
  }, [lastMessage]);

  const previewDisplay = useMemo(() => {
    const lastMsg = conversation.lastMessage;
    const content = lastMsg?.content;
    const call = (lastMsg as any)?.call;

    if (!lastMsg?._id) {
      return { icon: null, text: "Chưa có tin nhắn" };
    }

    if (lastMsg.recalled) {
      return {
        icon: null,
        text: "Tin nhắn đã được thu hồi",
      };
    }

    if (lastMsg.expired) {
      return {
        icon: null,
        text: "Tin nhắn đã hết hạn",
      };
    }

    if (call) {
      const isVideo = call.type === "VIDEO";
      const isMe = lastMsg.senderName === "Bạn";

      if (call.status === "MISSED") {
        return {
          icon: (
            <Ionicons
              name={isVideo ? "videocam-outline" : "call-outline"}
              size={14}
              color="#ef4444"
            />
          ),
          text: "Cuộc gọi nhỡ",
        };
      }

      if (call.status === "REJECTED") {
        return {
          icon: (
            <Ionicons
              name={isVideo ? "videocam-outline" : "call-outline"}
              size={14}
              color="#ef4444"
            />
          ),
          text: isMe ? "Cuộc gọi bị từ chối" : "Cuộc gọi nhỡ",
        };
      }

      if (call.status === "BUSY") {
        return {
          icon: (
            <Ionicons
              name={isVideo ? "videocam-outline" : "call-outline"}
              size={14}
              color="#f59e0b"
            />
          ),
          text: "Máy bận",
        };
      }

      return {
        icon: (
          <Ionicons
            name={isVideo ? "videocam-outline" : "call-outline"}
            size={14}
            color="#6b7280"
          />
        ),
        text: `Cuộc gọi ${isVideo ? "video" : "thoại"}`,
      };
    }

    if ((lastMsg as any)?.type === "SYSTEM") {
      return {
        icon: (
          <Ionicons
            name="information-circle-outline"
            size={14}
            color="#6b7280"
          />
        ),
        text: content?.text || "Tin nhắn hệ thống",
      };
    }

    if (!content) return { icon: null, text: "Tin nhắn mới" };

    if ((content as any).storyLink?.storyId) {
      return {
        icon: null,
        text: content.text
          ? `Trả lời story: ${content.text}`
          : `Trả lời story: ${(content as any).storyLink.previewText || "Xem lại story"}`,
      };
    }

    if (content.text && /https?:\/\//.test(content.text)) {
      return {
        icon: <Feather name="link" size={14} color="#6b7280" />,
        text: content.text,
      };
    }

    if ((content as any).icon) {
      return {
        icon: <MaterialIcons name="emoji-emotions" size={14} color="#6b7280" />,
        text: "Sticker",
      };
    }

    if (Array.isArray((content as any).files) && (content as any).files.length > 0) {
      switch ((content as any).files[(content as any).files.length - 1].type) {
        case "IMAGE":
          return {
            icon: <MaterialIcons name="image" size={14} color="#6b7280" />,
            text: "Hình ảnh",
          };
        case "VIDEO":
          return {
            icon: <MaterialIcons name="videocam" size={14} color="#6b7280" />,
            text: "Video",
          };
        case "FILE":
          return {
            icon: (
              <MaterialIcons name="attach-file" size={14} color="#6b7280" />
            ),
            text: (content as any).files[0].fileName,
          };
        case "VOICE":
          return {
            icon: <Ionicons name="mic" size={14} color="#6b7280" />,
            text: "Tin nhắn thoại",
          };
        default:
          return { icon: null, text: "Tin nhắn mới" };
      }
    }

    if (content.text) {
      return {
        icon: null,
        text: content.text,
      };
    }

    return { icon: null, text: "Tin nhắn mới" };
  }, [conversation.lastMessage]);

  const isOwn =
    lastMessage?.senderId === currentUserId ||
    lastMessage?.senderName === "Bạn";
  const senderPrefixDisplay =
    !conversation.lastMessage?.senderName ||
      (conversation.lastMessage as any)?.type === "SYSTEM"
      ? ""
      : conversation.type === "DIRECT" && !isOwn
        ? ""
        : `${isOwn ? "Bạn" : conversation.lastMessage?.senderName}: `;

  // ── Animation ──
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setMenuVisible(true);
    translateY.setValue(SCREEN_HEIGHT);
    Animated.parallel([

      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = (onDone?: () => void) => {
    Animated.parallel([

      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
      setSubMenu(null);
      onDone?.();
    });
  };

  // ── Swipe down to close ──
  const dragY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 4,

      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) dragY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 1.2) {
          dragY.setValue(0);
          closeSheet();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;


  // ── Handlers — optimistic update với giá trị tường minh, KHÔNG toggle ──


  const handlePin = () => {
    const newPinned = !conversation.pinned;

    // 1. Optimistic update ngay lập tức

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        pinned: newPinned,
      }),
    );

    // 2. Gọi API (socket sẽ confirm lại — nhưng updateConversationSetting idempotent nên không giật)
    closeSheet(async () => {
      try {
        newPinned
          ? await pinConversation(authUserId, conversation.conversationId)
          : await unpinConversation(authUserId, conversation.conversationId);
      } catch (err) {
        // Rollback nếu lỗi

        dispatch(
          updateConversationSetting({
            conversationId: conversation.conversationId,
            pinned: !newPinned,
          }),
        );
        console.error(err);
      }
    });
  };

  const handleMute = (duration: number) => {
    const newMuted = duration !== 0;


    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        muted: newMuted,
        mutedUntil: newMuted
          ? new Date(Date.now() + duration * 60 * 1000).toISOString()
          : null,
      }),
    );

    closeSheet(async () => {
      try {
        duration === 0
          ? await unmuteConversation(authUserId, conversation.conversationId)

          : await muteConversation(
            authUserId,
            conversation.conversationId,
            duration,
          );
      } catch (err) {
        dispatch(
          updateConversationSetting({
            conversationId: conversation.conversationId,
            muted: !newMuted,
            mutedUntil: null,
          }),
        );
        console.error(err);
      }
    });
  };

  const handleHide = () => {
    setPinAction(conversation.hidden ? "unhide" : "hide");
    setPinModalVisible(true);
    closeSheet();
  };

  const handleHideWithPin = async (pin: string) => {
    const newHidden = !conversation.hidden;
    setPinLoading(true);

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        hidden: newHidden,
      }),
    );

    try {
      newHidden
        ? await hideConversation(authUserId, conversation.conversationId, pin)
        : await unhideConversation(authUserId, conversation.conversationId, pin);
      setPinModalVisible(false);
      setPinAction(null);
    } catch (err: any) {
      dispatch(
        updateConversationSetting({
          conversationId: conversation.conversationId,
          hidden: !newHidden,
        }),
      );
      Alert.alert("Lỗi", err?.response?.data?.message || "Không thể cập nhật ẩn cuộc trò chuyện");
    } finally {
      setPinLoading(false);
    }
  };

  const handleDelete = () => {
    closeSheet(() => {
      Alert.alert(
        "Xác nhận",
        "Toàn bộ nội dung trò chuyện sẽ bị xóa vĩnh viễn. Bạn có chắc chắn muốn xóa?",
        [
          { text: "Không", style: "cancel" },
          {
            text: "Xóa",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteConversation(authUserId, conversation.conversationId);
                dispatch(removeConversation(conversation.conversationId));
              } catch (err) {
                console.error(err);
              }
            },
          },
        ],
      );
    });
  };

  const handleSelectMulti = () => {
    closeSheet(() => onSelectToggle?.(conversation.conversationId));
  };

  const handleMarkUnread = async () => {
    if (!authUserId) return;

    const isMarkRead = conversation.unreadCount > 0;
    const oldUnreadCount = conversation.unreadCount;

    dispatch(setUnreadCount({
      conversationId: conversation.conversationId,
      unreadCount: isMarkRead ? 0 : 1,
    }));

    try {
      if (isMarkRead) {
        await markAsRead({
          userId: authUserId,
          conversationId: conversation.conversationId,
        });
      } else {
        await markAsUnread({
          userId: authUserId,
          conversationId: conversation.conversationId,
        });
      }
    } catch (error) {
      dispatch(setUnreadCount({
        conversationId: conversation.conversationId,
        unreadCount: oldUnreadCount,
      }));
    }

    closeSheet();
  };
  return (
    <>
      <ConversationPinModal
        visible={pinModalVisible}
        title={
          pinAction === "unhide"
            ? "Nhập mã PIN để gỡ ẩn trò chuyện"
            : "Nhập mã PIN để ẩn trò chuyện"
        }
        description={
          pinAction === "hide"
            ? "Nếu đây là lần đầu, mã PIN 4 số này sẽ được dùng cho các lần ẩn hoặc gỡ ẩn tiếp theo."
            : "Nhập đúng mã PIN 4 số để xác nhận gỡ ẩn cuộc trò chuyện."
        }
        confirmLabel={pinAction === "unhide" ? "Gỡ ẩn" : "Ẩn"}
        loading={pinLoading}
        onClose={() => {
          if (pinLoading) return;
          setPinModalVisible(false);
          setPinAction(null);
        }}
        onSubmit={handleHideWithPin}
      />
      <TouchableOpacity
        onPress={() => {
          if (isSelectMode) {
            onSelectToggle?.(conversation.conversationId);
            return;
          }
          // ✅ Optimistic: clear unread badge ngay lập tức
          if (isUnread && authUserId) {
            dispatch(setUnreadCount({ conversationId: conversation.conversationId, unreadCount: 0 }));
            markAsRead({ userId: authUserId, conversationId: conversation.conversationId }).catch(() => { });
          }
          router.push(`/private/chat/${conversation.conversationId}`);
        }}
        onLongPress={isSelectMode ? undefined : openSheet}
        activeOpacity={0.6}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: isSelected ? "#eff6ff" : "#fff",
          borderBottomWidth: 0.5,
          borderBottomColor: "#f0f0f0",
        }}
      >
        {isSelectMode && (
          <View style={{ marginRight: 12 }}>

            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: isSelected ? "#3b82f6" : "#d1d5db",
                backgroundColor: isSelected ? "#3b82f6" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={13} color="#fff" />
              )}
            </View>
          </View>
        )}

        <View style={{ position: "relative" }}>
          <GroupAvatar
            uri={conversation.avatar}
            name={conversation.name}
            size={48}
          />
          {/* Chấm xanh online - chỉ cho DIRECT, không phải AI */}
          {conversation.type === "DIRECT" && conversation.isOnline && !(user?.privacy?.hideActiveStatus || false) && (
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 13,
                height: 13,
                borderRadius: 7,
                backgroundColor: "#22c55e",
                borderWidth: 2,
                borderColor: "#fff",
              }}
            />
          )}
          {conversation.type === "AI" && (
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                backgroundColor: "#fff",
                borderRadius: 10,
                padding: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <MaterialIcons
                name="verified"
                size={16}
                color="#0068ff"
              />
            </View>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                minWidth: 0,
                marginRight: 8,
              }}
            >
              {conversation.type === "GROUP" && (
                <MaterialIcons
                  name="group"
                  size={14}
                  color={isUnread ? "#374151" : "#9ca3af"}
                  style={{ marginRight: 3, flexShrink: 0 }}
                />
              )}
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: isUnread ? "500" : "400",
                  color: isUnread ? "#000000" : "#111827",
                }}
              >
                {conversation.name}
              </Text>
              {conversation.pinned && (
                <MaterialIcons
                  name="push-pin"
                  size={12}
                  color="#3b82f6"
                  style={{ marginLeft: 4, flexShrink: 0 }}
                />
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              {conversation.muted && (
                <Ionicons
                  name="notifications-off-outline"
                  size={13}
                  color="#9ca3af"
                />
              )}
              <Text style={{ fontSize: 11, color: "#9ca3af" }}>
                {formatMessageTime(conversation.lastMessageAt)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-1 w-full">
            <View className="flex-row items-center flex-1 mr-3 min-w-0">
              {/* sender */}
              <Text
                style={{
                  fontSize: 13,
                  color: isUnread ? "#111827" : "#6b7280",
                  fontWeight: isUnread ? "500" : "400",
                }}
              >
                {senderPrefixDisplay}
              </Text>

              {/* preview */}
              <View className="flex-row items-center flex-1 min-w-0">
                {previewDisplay.icon && (
                  <View className="mr-1 justify-center">{previewDisplay.icon}</View>
                )}

                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    flex: 1,
                    color: isUnread ? "#111827" : "#6b7280",
                    fontWeight: isUnread ? "500" : "400",
                  }}
                >
                  {previewDisplay.text}
                </Text>
              </View>
            </View>

            {conversation.unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: "#d10e0eff",
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 5,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>


      <Modal
        visible={menuVisible}
        transparent
        statusBarTranslucent
        animationType="none"
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            opacity: backdropOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => closeSheet()} />
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            transform: [{ translateY: Animated.add(translateY, dragY) }],
            overflow: "hidden",
          }}
        >
          <View
            {...panResponder.panHandlers}
            style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#e0e0e0",
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: "#f0f0f0",
            }}
          >
            <View style={{ position: "relative", marginRight: 12 }}>
              <GroupAvatar
                uri={conversation.avatar}
                name={conversation.name}
                size={38}
              />
              {conversation.type === "AI" && (
                <View
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    backgroundColor: "#fff",
                    borderRadius: 8,
                    padding: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <MaterialIcons
                    name="verified"
                    size={14}
                    color="#0068ff"
                  />
                </View>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}
              >
                {conversation.name}
              </Text>
              {preview?.text ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}
                >
                  {previewDisplay.text}
                </Text>
              ) : null}
            </View>
          </View>

          {subMenu === "mute" ? (
            <View>
              <TouchableOpacity
                onPress={() => setSubMenu(null)}

                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 0.5,
                  borderBottomColor: "#f5f5f5",
                }}
              >
                <Ionicons name="chevron-back" size={18} color="#6b7280" />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#6b7280",
                  }}
                >
                  Tắt thông báo
                </Text>
              </TouchableOpacity>

              {[
                { label: "Trong 1 giờ", duration: 60 },
                { label: "Trong 4 giờ", duration: 240 },
                { label: "Cho đến 8:00 AM", duration: -2 },
                { label: "Cho đến khi mở lại", duration: -1 },
              ].map((opt, i, arr) => (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => handleMute(opt.duration)}

                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 15,
                    borderBottomWidth: i < arr.length - 1 ? 0.5 : 0,
                    borderBottomColor: "#f5f5f5",
                  }}
                >
                  <Text style={{ fontSize: 15, color: "#111827" }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 28 }} />
            </View>
          ) : (
            <View>

              <SheetItem
                icon={
                  <MaterialIcons
                    name="mark-chat-unread"
                    size={21}
                    color="#374151"
                  />
                }
                label={conversation.unreadCount > 0 ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}
                onPress={handleMarkUnread}
              />
              <Divider />
              <SheetItem
                icon={
                  <MaterialIcons name="push-pin" size={21} color="#374151" />
                }
                label={
                  conversation.pinned ? "Bỏ ghim hội thoại" : "Ghim hội thoại"
                }
                onPress={handlePin}
              />

              {conversation.muted ? (
                <SheetItem
                  icon={
                    <Ionicons
                      name="notifications-outline"
                      size={21}
                      color="#374151"
                    />
                  }
                  label="Bật lại thông báo"
                  onPress={() => handleMute(0)}
                />
              ) : (
                <SheetItem
                  icon={
                    <Ionicons
                      name="notifications-off-outline"
                      size={21}
                      color="#374151"
                    />
                  }
                  label="Tắt thông báo"
                  onPress={() => setSubMenu("mute")}
                  hasArrow
                />
              )}

              <SheetItem
                icon={
                  <Ionicons name="eye-off-outline" size={21} color="#374151" />
                }
                label={
                  conversation.hidden ? "Bỏ ẩn trò chuyện" : "Ẩn trò chuyện"
                }
                onPress={handleHide}
              />
              <SheetItem
                icon={
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#374151"
                  />
                }
                label="Chọn nhiều"
                onPress={handleSelectMulti}
              />
              <Divider />
              <SheetItem
                icon={
                  <Ionicons name="trash-outline" size={21} color="#ef4444" />
                }
                label="Xóa hội thoại"
                labelStyle={{ color: "#ef4444" }}
                onPress={handleDelete}
              />
              <View style={{ height: 28 }} />
            </View>
          )}
        </Animated.View>
      </Modal>
    </>
  );
});

const SheetItem = ({
  icon,
  label,
  onPress,
  hasArrow = false,
  labelStyle = {},
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  hasArrow?: boolean;
  labelStyle?: object;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.6}
    style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 15,
      gap: 16,
    }}
  >
    {icon}
    <Text style={{ flex: 1, fontSize: 15, color: "#111827", ...labelStyle }}>
      {label}
    </Text>
    {hasArrow && <Ionicons name="chevron-forward" size={16} color="#c4c4c4" />}
  </TouchableOpacity>
);

const Divider = () => (

  <View
    style={{ height: 0.5, backgroundColor: "#f0f0f0", marginVertical: 4 }}
  />
);

export default ConversationItem;  
