import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ToastAndroid,
} from "react-native";
import { userService } from "@/services/user.service";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useSocket } from "@/contexts/SocketContext";
import GroupAvatar from "../ui/GroupAvatar";

export default function SentTab() {
  const [sentUsers, setSentUsers] = useState<any>([]);
  const { friendRefreshKey, socket } = useSocket();

  const fetchSentRequests = useCallback(async () => {
    try {
      let data = await userService.sentFriendRequests();
      if (data) {
        setSentUsers(data.users);
      } else {
        setSentUsers([]);
      }
    } catch (err) {
      console.log(err);
    }
  }, []);

  useEffect(() => {
    void fetchSentRequests();
  }, [friendRefreshKey, fetchSentRequests]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      void fetchSentRequests();
    };

    socket.on("receive_friend_request", refresh);
    socket.on("friend_accepted", refresh);
    socket.on("cancel_friend_request", refresh);
    socket.on("blocked", refresh);
    socket.on("blocked_by", refresh);

    return () => {
      socket.off("receive_friend_request", refresh);
      socket.off("friend_accepted", refresh);
      socket.off("cancel_friend_request", refresh);
      socket.off("blocked", refresh);
      socket.off("blocked_by", refresh);
    };
  }, [socket, fetchSentRequests]);

  return (
    <View className="flex-1">
      {sentUsers.length > 0 ? (
        sentUsers.map((user: any) => (
          <SentItem
            key={user.friendId}
            item={user}
            message="Đã gửi"
            setSentUsers={setSentUsers}
          />
        ))
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">
            Bạn chưa gửi lời mời kết bạn nào
          </Text>
        </View>
      )}
    </View>
  );
}

type SentItemProps = {
  item: any;
  message: string;
  setSentUsers: React.Dispatch<React.SetStateAction<any[]>>;
};

function SentItem({ item, message, setSentUsers }: SentItemProps) {
  const userId = useSelector((item: any) => item.auth.user.userId);

  const handelRecall = (id: string) => {
    const recallFriend = async () => {
      try {
        const data = await userService.cancelFriend(id, userId);
        if (data) {
          setSentUsers((prev: any) =>
            prev.filter((item: any) => item.friendId !== id),
          );

          ToastAndroid.show(
            data?.message || "Đã thu hồi lời mời kết bạn",
            ToastAndroid.SHORT,
          );
        }
      } catch (err) {
        ToastAndroid.show(
          (err as any)?.response?.data?.message ||
            "Không thể thu hồi lời mời kết bạn",
          ToastAndroid.SHORT,
        );
        console.log(err);
      }
    };
    recallFriend();
  };

  return (
    <View className="bg-white px-4 py-4 mx-4 mt-2 rounded-2xl border border-gray-100 flex-row items-center">
      <View className="flex-row items-center flex-1 pr-3">
        <GroupAvatar
          uri={item?.avatarUrl}
          name={item?.name || "Người dùng"}
          size={56}
        />
        <View className="ml-3 flex-1">
          <Text className="text-[16px] font-semibold text-gray-900">
            {item?.name}
          </Text>
          <Text className="text-[13px] text-gray-500 mt-0.5">{message}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => handelRecall(item.friendId)}
        className="bg-gray-100 px-4 py-2.5 rounded-full min-w-[96px] items-center"
      >
        <Text className="text-[13px] font-semibold text-gray-700">THU HỒI</Text>
      </TouchableOpacity>
    </View>
  );
}
