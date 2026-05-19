import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import FriendItem from "./FriendItem";
import { useEffect, useMemo, useState } from "react";
import { userService } from "@/services/user.service";
import { router } from "expo-router";
import { useSocket } from "@/contexts/SocketContext";
import { conversationService } from "@/services/conversation.service";
import { useVideoCall } from "@/contexts/VideoCallContext";
import GroupAvatar from "@/components/ui/GroupAvatar";

type FriendItemType = {
  friendId: string;
  name?: string;
  avatarUrl?: string;
  birthday?: string;
  status?: string;
};

const getBirthdayDate = (birthday?: string) => {
  if (!birthday) return null;

  const date = new Date(birthday);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isBirthdayToday = (birthday?: string) => {
  const date = getBirthdayDate(birthday);

  if (!date) return false;

  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth()
  );
};

export default function FriendsTab() {
  const [friends, setFriends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ALL" | "ONLINE">("ALL");
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  
  const { socket, friendRefreshKey } = useSocket();
  const { startDirectCall } = useVideoCall();

  const getDirectConversationId = async (targetUserId: string) => {
    const response = await conversationService.getOrCreateDirect(targetUserId);
    return (
      response?.data?._id || response?.data?.conversationId
    );
  };

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await userService.getListFriends();
        setFriends(response.users);
        
        const allFriendIds = response.users.flatMap((group: any) => group.friends.map((f: any) => f.friendId));
        if (allFriendIds.length > 0) {
          const statuses = await userService.getBulkStatus(allFriendIds);
          const statusMap = statuses.reduce((acc: any, s: any) => {
             acc[s.userId] = s.isOnline;
             return acc;
          }, {});
          setOnlineStatuses(statusMap);
        }
      } catch (error) {
        console.error("Lỗi khi lấy danh sách bạn bè:", error);
      }
    };

    fetchFriends();
  }, [friendRefreshKey]);

  useEffect(() => {
    if (!socket) return;
    
    const handleStatusChange = (data: { userId: string, isOnline: boolean }) => {
      setOnlineStatuses(prev => ({ ...prev, [data.userId]: data.isOnline }));
    };
    
    socket.on('user_status_change', handleStatusChange);
    
    return () => {
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket]);
  
  const handleStartConversation = async (targetUserId: string) => {
    try {
      const conversationId = await getDirectConversationId(targetUserId);

      if (!conversationId) return;
      // Điều hướng tới màn chat của conversation vừa lấy/khởi tạo
      router.push(`/private/chat/${conversationId}`);
    } catch (error) {
      console.log(error);
    }
  };

  const handleStartVideoCall = async (friend: any) => {
    try {
      const conversationId = await getDirectConversationId(friend?.friendId);

      if (!conversationId || !friend?.friendId) return;

      await startDirectCall(
        friend.friendId,
        conversationId,
        "VIDEO",
        friend?.name,
        friend?.avatarUrl,
      );
    } catch (error) {
      console.log(error);
    }
  };

  const birthdayFriends = useMemo(() => {
    const allFriends = friends.flatMap((group: any) => group?.friends || []);

    return allFriends.filter((friend: FriendItemType) =>
      isBirthdayToday(friend?.birthday),
    );
  }, [friends]);

  const allCount = useMemo(() => friends.reduce((acc, group) => acc + (group.friends?.length || 0), 0), [friends]);
  const onlineCount = useMemo(() => Object.values(onlineStatuses).filter(Boolean).length, [onlineStatuses]);

  const displayGroups = useMemo(() => {
    if (activeTab === "ALL") return friends;
    
    return friends.map((group: any) => ({
      ...group,
      friends: group.friends.filter((f: any) => onlineStatuses[f.friendId])
    })).filter((group: any) => group.friends.length > 0);
  }, [friends, activeTab, onlineStatuses]);

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Các mục chức năng đầu trang */}
      <TouchableOpacity onPress={() => router.push('/private/friend-requests')}>
        <View className="px-4 py-3 flex-row items-center">
          <View className="w-10 h-10 bg-blue-500 rounded-xl items-center justify-center">
            <MaterialIcons name="person-add" size={20} color="white" />
          </View>
          <Text className="ml-4 text-base flex-1">Lời mời kết bạn</Text>
        </View>
      </TouchableOpacity>

      <View className="px-4 py-3 flex-row items-center">
        <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center">
          <Ionicons name="calendar" size={20} color="#3b82f6" />
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-base">Sinh nhật</Text>
          <Text className="text-gray-500 text-sm">
            {birthdayFriends.length > 0
              ? `Hôm nay có ${birthdayFriends.length} bạn sinh nhật`
              : "Không có bạn nào sinh nhật hôm nay"}
          </Text>
        </View>
      </View>
      {birthdayFriends.length > 0 && (
        <View className="px-4 pb-2">
          {birthdayFriends.map((friend: FriendItemType) => (
            <View
              key={friend.friendId}
              className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0"
            >
              <GroupAvatar
                uri={friend.avatarUrl}
                name={friend.name || ""}
                size={44}
              />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-medium text-gray-900">
                  {friend.name}
                </Text>
                <Text className="text-gray-500 text-sm">
                  Chúc mừng sinh nhật hôm nay
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <View className="h-2 bg-gray-100" />
      {/* Bộ lọc */}
      <View className="flex-row p-4 gap-x-3">
        <TouchableOpacity 
          onPress={() => setActiveTab("ALL")}
          className={`px-4 py-1.5 rounded-full ${activeTab === 'ALL' ? 'border border-gray-300 bg-gray-50' : 'bg-gray-100'}`}
        >
          <Text className={activeTab === 'ALL' ? 'font-bold' : 'text-gray-600'}>Tất cả {allCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab("ONLINE")}
          className={`px-4 py-1.5 rounded-full ${activeTab === 'ONLINE' ? 'border border-gray-300 bg-gray-50' : 'bg-gray-100'}`}
        >
          <Text className={activeTab === 'ONLINE' ? 'font-bold' : 'text-gray-600'}>Mới truy cập {onlineCount}</Text>
        </TouchableOpacity>
      </View>

      {displayGroups?.map((group: any, index: number) => (
        <View key={index}>
          <View className="px-4 py-2 bg-white">
            <Text className="font-bold text-sm text-black uppercase">
              {group.key}
            </Text>
          </View>
          <View>
            {group.friends.map((friend: any) => (
              <FriendItem
                key={friend.friendId}
                item={friend}
                isOnline={onlineStatuses[friend.friendId] || false}
                onStartConversation={handleStartConversation}
                onStartVideoCall={handleStartVideoCall}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
