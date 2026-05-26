import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import { userService } from "@/services/user.service";
import Ionicons from "@expo/vector-icons/Ionicons";
import GroupAvatar from "@/components/ui/GroupAvatar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";

type SuggestFriend = {
  friendId: string;
  name: string;
  avatarUrl: string;
  score?: number;
};

type SuggestFriendItemProps = {
  item: SuggestFriend;
  isAdding: boolean;
  onAddFriend: (friendId: string) => void;
  onDismiss: (friendId: string) => void;
};


export default function SuggestFriendsScreen() {
  const userId = useSelector((state: any) => state.auth.user.userId);

  const [suggestedFriends, setSuggestedFriends] = useState<SuggestFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestedFriends = async () => {
      try {
        setLoading(true);
        const data = await userService.suggestFriend();
        const users = Array.isArray(data) ? data : (data?.users ?? []);
        setSuggestedFriends(users);
      } catch (err) {
        ToastAndroid.show(
          (err as any)?.response?.data?.message || "Không thể tải gợi ý kết bạn",
          ToastAndroid.SHORT,
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestedFriends();
  }, []);

  const handleAddFriend = async (friendId: string) => {
    if (!userId || addingId) {
      return;
    }

    try {
      setAddingId(friendId);
      const data = await userService.addFriend(friendId, userId);
      ToastAndroid.show(
        data?.message || "Đã gửi lời mời kết bạn",
        ToastAndroid.SHORT,
      );
      setSuggestedFriends((prev) =>
        prev.filter((friend) => friend.friendId !== friendId),
      );
    } catch (err) {
      ToastAndroid.show(
        (err as any)?.response?.data?.message || "Không thể gửi lời mời kết bạn",
        ToastAndroid.SHORT,
      );
    } finally {
      setAddingId(null);
    }
  };

  const handleDismiss = (friendId: string) => {
    setSuggestedFriends((prev) =>
      prev.filter((friend) => friend.friendId !== friendId),
    );
  };

  return (
    <Container className="bg-white">
      <Header
        gradient
        back
        centerChild={
          <Text className="text-white text-sm font-semibold">Có thể bạn quen</Text>
        }
        rightChild={
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={22} color="white" />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0091ff" />
        </View>
      ) : suggestedFriends.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-500 text-center text-[16px]">
            Hiện chưa có gợi ý bạn bè phù hợp
          </Text>
        </View>
      ) : (
        <FlatList
          data={suggestedFriends}
          keyExtractor={(item) => item.friendId}
          showsVerticalScrollIndicator={false}
          className="flex-1 bg-[#f4f5f7]"
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => {
            const isAdding = addingId === item.friendId;

            return (
              <SuggestFriendItem
                item={item}
                isAdding={isAdding}
                onAddFriend={handleAddFriend}
                onDismiss={handleDismiss}
              />
            );
          }}
        />
      )}
    </Container>
  );
}


function SuggestFriendItem({
  item,
  isAdding,
  onAddFriend,
  onDismiss,
}: SuggestFriendItemProps) {
  return (
    <View className="bg-white px-4 py-4 mx-4 mt-2 rounded-2xl border border-gray-100">
      <View className="flex-row items-center">
        <GroupAvatar
          uri={item.avatarUrl}
          name={item.name || "Người dùng"}
          size={56}
        />

        <View className="ml-3 flex-1 pr-2">
          <Text className="text-[16px] font-semibold text-gray-900" numberOfLines={1}>
            {item.name || "Người dùng"}
          </Text>
          <Text className="text-[13px] text-gray-500 mt-0.5">Có thể bạn quen</Text>
        </View>
      </View>

      <View className="flex-row gap-x-2 mt-3">
        <TouchableOpacity
          className="flex-1 bg-gray-100 py-2.5 rounded-full items-center"
          onPress={() => onDismiss(item.friendId)}
        >
          <Text className="text-[13px] font-semibold text-gray-700">BỎ QUA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={isAdding}
          onPress={() => onAddFriend(item.friendId)}
          className={`flex-1 py-2.5 rounded-full items-center ${isAdding ? "bg-[#cce8ff]" : "bg-[#e7f3ff]"
            }`}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#0091ff" />
          ) : (
            <Text className="text-[13px] text-[#0091ff] font-semibold">KẾT BẠN</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
