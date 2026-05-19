import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, MaterialIcons, AntDesign } from "@expo/vector-icons";
import GroupAvatar from "../ui/GroupAvatar";
import Header from "../common/Header";
import { moderateScale } from "@/utils/responsive";
import { useAppSelector } from "@/store/store";
import { formatLastSeen } from "@/utils/formater";

interface ChatHeaderProps {
  conversation: any;
  isFriend: boolean | null;
  handleVideoCall: () => void;
  router: any;
  id: string;
  setShowInfoSheet: (val: boolean) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation, isFriend, handleVideoCall, router, id, setShowInfoSheet
}) => {
  // Lấy trạng thái live trực tiếp từ Redux để re-render tức thì
  const liveConversation = useAppSelector((state) =>
    state.conversation.conversations.find((c) => c.conversationId === id)
  );

  const type = liveConversation?.type || conversation?.type;
  const isOnline = liveConversation?.isOnline;
  const lastSeenAt = liveConversation?.lastSeenAt;

  const isDirect = type === "DIRECT";
  const isAI = type === "AI";

  const [tick, setTick] = useState(0);

  // Tự động đếm 60 giây khi offline để cập nhật nhãn thời gian hoạt động động
  useEffect(() => {
    if (isOnline || !isDirect) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, [isOnline, isDirect]);

  return (
    <Header
      back
      gradient
      leftChild={
        <View className="relative">
          <GroupAvatar
            uri={conversation?.avatar}
            name={conversation?.name || ""}
            size={38}
          />
          {/* Chấm xanh lá báo trạng thái hoạt động */}
          {isDirect && isOnline && (
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 11,
                height: 11,
                borderRadius: 5.5,
                backgroundColor: "#22c55e",
                borderWidth: 1.5,
                borderColor: "#FFFFFF",
              }}
            />
          )}
        </View>
      }
      centerChild={
        <View className="justify-center">
          <View className="flex-row items-center">
            <Text
              className="text-white text-base font-semibold"
              numberOfLines={1}
              style={{ maxWidth: 160 }}
            >
              {conversation?.name}
            </Text>
            {isAI && (
              <MaterialIcons
                name="verified"
                size={14}
                color="white"
                className="ml-1"
              />
            )}
          </View>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            {isDirect && !isAI && (
              <Text
                className={`text-[11px] ${isOnline ? "text-emerald-300 font-semibold" : "text-white/70"}`}
                numberOfLines={1}
              >
                {isOnline ? "Đang hoạt động" : formatLastSeen(lastSeenAt)}
              </Text>
            )}
            {!isDirect && !isAI && (
              <Text className="text-white/70 text-[11px]" numberOfLines={1}>
                Trò chuyện nhóm
              </Text>
            )}
            {isFriend === false && (
              <View className="bg-white/20 px-1.5 py-px rounded-[10px]">
                <Text className="text-white text-[9px] font-semibold">
                  Người lạ
                </Text>
              </View>
            )}
          </View>
        </View>
      }
      rightChild={
        <View className="flex-row items-center gap-3">
          {!isAI && (
            <TouchableOpacity className="p-1" onPress={handleVideoCall}>
              <Ionicons name="videocam-outline" size={moderateScale(24)} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="p-1"
            onPress={() =>
              router.push({
                pathname: "/private/search",
                params: { conversationId: id },
              })
            }
          >
            <Ionicons name="search-outline" size={moderateScale(24)} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            className="p-1"
            onPress={() => setShowInfoSheet(true)}
          >
            <AntDesign name="unordered-list" size={moderateScale(24)} color="white" />
          </TouchableOpacity>
        </View>
      }
    />
  );
};

export default ChatHeader;
