import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import GroupAvatar from "@/components/ui/GroupAvatar";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import { userService } from "@/services/user.service";
import { conversationService } from "@/services/conversation.service";
import { useRouter } from "expo-router";
import { useSocket } from "@/contexts/SocketContext";
import { Feather } from "@expo/vector-icons";
import { useSelector } from "react-redux";

export default function BlockedFriendsScreen() {
  const router = useRouter();
  const { socket } = useSocket();
  const user = useSelector((state: any) => state.auth.user);
  const currentUserId = user?.userId || user?._id;
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlockedFriends = useCallback(async () => {
    try {
      const res = await userService.getBlockedFriends();
      if (res?.users) {
        setBlockedUsers(res.users);
      } else if (res?.data?.users) {
        setBlockedUsers(res.data.users);
      } else if (Array.isArray(res)) {
        setBlockedUsers(res);
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách chặn:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedFriends();
  }, [fetchBlockedFriends]);

  useEffect(() => {
    if (!socket) return;
    const handleEvent = () => fetchBlockedFriends();
    socket.on("blocked", handleEvent);
    socket.on("blocked_by", handleEvent);
    socket.on("unblocked", handleEvent);
    return () => {
      socket.off("blocked", handleEvent);
      socket.off("blocked_by", handleEvent);
      socket.off("unblocked", handleEvent);
    };
  }, [socket, fetchBlockedFriends]);

  const handleUnblock = async (friendId: string) => {
    if (!currentUserId) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin tài khoản.");
      return;
    }
    try {
      setUnblockingId(friendId);
      await userService.unblockFriend(friendId, currentUserId);
      setBlockedUsers((prev) => prev.filter((u) => u.friendId !== friendId));
    } catch (error) {
      console.error("Lỗi gỡ chặn:", error);
      Alert.alert("Lỗi", "Không thể gỡ chặn lúc này.");
    } finally {
      setUnblockingId(null);
    }
  };

  const handleNavigateToChat = async (blocked: any) => {
    try {
      const response = await conversationService.getOrCreateDirect(blocked.friendId);
      const conversationId = response?.data?._id || response?.data?.conversationId || response?._id;
      if (conversationId) {
        router.push({
          pathname: `/private/chat/${conversationId}`,
          params: {
            conversation: JSON.stringify({
              conversationId,
              type: "DIRECT",
              name: blocked.name,
              avatar: blocked.avatarUrl,
              otherMemberId: blocked.friendId,
            }),
            openedFromBlock: "true",
          },
        });
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể mở hộp thoại lúc này.");
    }
  };

  return (
    <Container>
      <View className="flex-1 bg-white">
        <Header
          gradient
          back
          leftChild={
            <Text className="text-white font-semibold text-[17px] ml-2">
              Danh sách chặn
            </Text>
          }
        />
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#0068FF" />
          </View>
        ) : blockedUsers.length === 0 ? (
          <View className="flex-1 justify-center items-center px-4">
            <Feather name="user-x" size={48} color="#D1D5DB" />
            <Text className="mt-4 text-gray-500 font-medium text-base text-center">
              Danh sách chặn trống
            </Text>
            <Text className="mt-2 text-gray-400 text-sm text-center">
              Những người bạn đã chặn tin nhắn hoặc cuộc gọi sẽ hiển thị ở đây.
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.friendId}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleNavigateToChat(item)}
                className="flex-row items-center px-4 py-3 border-b border-gray-100"
              >
                <GroupAvatar
                  uri={item.avatarUrl}
                  name={item.name}
                  size={46}
                />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-black" numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleUnblock(item.friendId)}
                  disabled={unblockingId === item.friendId}
                  className="bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200"
                >
                  {unblockingId === item.friendId ? (
                    <ActivityIndicator size="small" color="#6B7280" />
                  ) : (
                    <Text className="text-xs font-semibold text-gray-700">Gỡ chặn</Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Container>
  );
}
