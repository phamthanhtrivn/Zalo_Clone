import { View, Text, Image, TouchableOpacity, ToastAndroid } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { userService } from "@/services/user.service";
import { useSelector } from "react-redux";
import { useSocket } from "@/contexts/SocketContext";
import GroupAvatar from "../ui/GroupAvatar";

export default function ReceivedTab() {
  const [receivedUsers, setReceivedUsers] = useState<any>([]);
  const { friendRefreshKey, socket } = useSocket();

  const fetchReceivedRequests = useCallback(async () => {
    try {
      let data = await userService.receivedFriendRequests();
      if (data) {
        setReceivedUsers(data.users);
      } else {
        setReceivedUsers([]);
      }
    } catch (err) {
      console.log(err);
    }
  }, []);

  useEffect(() => {
    void fetchReceivedRequests();
  }, [friendRefreshKey, fetchReceivedRequests]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      void fetchReceivedRequests();
    };

    socket.on("receive_friend_request", refresh);
    socket.on("friend_accepted", refresh);
    socket.on("cancel_friend_request", refresh);
    socket.on("blocked", refresh);
    socket.on("blocked_by", refresh);
    socket.on("unblocked", refresh);
    socket.on("friend_status_updated", refresh);

    return () => {
      socket.off("receive_friend_request", refresh);
      socket.off("friend_accepted", refresh);
      socket.off("cancel_friend_request", refresh);
      socket.off("blocked", refresh);
      socket.off("blocked_by", refresh);
      socket.off("unblocked", refresh);
      socket.off("friend_status_updated", refresh);
    };
  }, [socket, fetchReceivedRequests]);

  return (
    <View className="flex-1">
      {receivedUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Bạn chưa có lời mời kết bạn nào</Text>
        </View>
      ) : (
        receivedUsers.map((user: any) => (
          <ReceivedItem
            key={user.friendId}
            item={user}
            message="Muốn kết bạn"
            setReceivedUsers={setReceivedUsers}
          />
        ))
      )}
    </View>
  );
}

type ReceivedItemProps = {
  item: any;
  message: string;
  setReceivedUsers: any
};

function ReceivedItem({ item, message, setReceivedUsers }: ReceivedItemProps) {
  const userId = useSelector((item: any) => item.auth.user.userId);


  const handelAccept = (id: string) => {
    const acceptFriend = async () => {
      try {
        const data = await userService.acceptFriend(id, userId);
        if (data) {
          setReceivedUsers((prev: any) =>
            prev.filter((item: any) => item.friendId !== id),
          );
          ToastAndroid.show(
            data?.message || "Đã chấp nhận lời mời kết bạn",
            ToastAndroid.SHORT,
          );
        }
      } catch (err) {
        console.log(err);
        ToastAndroid.show(
          (err as any)?.response?.data?.message ||
          "Không thể chấp nhận lời mời kết bạn",
          ToastAndroid.SHORT,
        );
        console.log(err);
      }
    };
    acceptFriend();
  };

  const handelReject = (id: string) => {
    const rejectFriend = async () => {
      try {
        const data = await userService.rejectFriend(id, userId);
        if (data) {
          setReceivedUsers((prev: any) =>
            prev.filter((item: any) => item.friendId !== id),
          );
          ToastAndroid.show(
            data?.message || "Đã từ chối lời mời kết bạn",
            ToastAndroid.SHORT,
          );
        }
      } catch (err) {
        ToastAndroid.show(
          (err as any)?.response?.data?.message ||
          "Không thể từ chối lời mời kết bạn",
          ToastAndroid.SHORT,
        );
        console.log(err);
      }
    };
    rejectFriend();
  };

  return (
    <View className="bg-white px-4 py-4 mx-4 mt-2 rounded-2xl border border-gray-100">
      <View className="flex-row items-center">
        <GroupAvatar
          uri={item.avatarUrl}
          name={item.name || "Người dùng"}
          size={56}
        />
        <View className="ml-3 flex-1">
          <Text className="text-[16px] font-semibold text-gray-900">
            {item.name}
          </Text>
          <Text className="text-[13px] text-gray-500 mt-0.5">{message}</Text>
        </View>
      </View>
      <View className="flex-row gap-x-2 mt-3">
        <TouchableOpacity
          className="flex-1 bg-gray-100 py-2.5 rounded-full items-center"
          onPress={() => handelReject(item.friendId)}
        >
          <Text className="text-[13px] font-semibold text-gray-700">
            TỪ CHỐI
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-[#e7f3ff] py-2.5 rounded-full items-center"
          onPress={() => handelAccept(item.friendId)}
        >
          <Text className="text-[13px] text-[#0091ff] font-semibold">
            ĐỒNG Ý
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
