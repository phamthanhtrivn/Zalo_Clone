import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FriendBannerProps {
  isGroup: boolean;
  isFriend: boolean | null;
  friendStatus: string | null;
  handleAcceptFriend: () => void;
  handleAddFriend: () => void;
  handleUnblockFriend: () => void;
}

const FriendBanner: React.FC<FriendBannerProps> = ({
  isGroup,
  isFriend,
  friendStatus,
  handleAcceptFriend,
  handleAddFriend,
  handleUnblockFriend,
}) => {
  if (isGroup || isFriend !== false) return null;

  const isBlocked = friendStatus === "BLOCKED" || friendStatus === "BLOCKED_BY_OTHER";

  return (
    <View className="bg-white py-2.5 px-4 flex-row items-center justify-center border-b border-[#f3f4f6]">
      <TouchableOpacity
        onPress={
          isBlocked
            ? friendStatus === "BLOCKED"
              ? handleUnblockFriend
              : undefined
            : friendStatus === "PENDING"
              ? undefined
              : friendStatus === "REQUESTED" || friendStatus === "REJECTED"
                ? handleAcceptFriend
                : handleAddFriend
        }
        disabled={friendStatus === "BLOCKED_BY_OTHER"}
        className="flex-row items-center gap-2"
      >
        <Ionicons
          name={
            isBlocked
              ? "remove-circle-outline"
              : friendStatus === "PENDING"
                ? "time-outline"
                : "person-add-outline"
          }
          size={20}
          color="#0068ff"
        />
        <Text className={`font-semibold text-sm ${friendStatus === "BLOCKED_BY_OTHER" ? "text-gray-500" : "text-[#0068ff]"}`}>
          {isBlocked
            ? friendStatus === "BLOCKED"
              ? "Gỡ chặn"
              : "Đã bị chặn"
            : friendStatus === "PENDING"
              ? "Đã gửi lời mời"
              : friendStatus === "REQUESTED" || friendStatus === "REJECTED"
                ? "Chấp nhận lời mời"
                : "Kết bạn"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default FriendBanner;
