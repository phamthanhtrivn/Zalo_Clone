import { Ionicons } from "@expo/vector-icons";
import GroupAvatar from "../ui/GroupAvatar";
import { View, Text, TouchableOpacity } from "react-native";

function FriendItem({ item, isOnline, onStartConversation, onStartVideoCall }: any) {
  return (
    <View className="flex-row items-center px-4 py-3 active:bg-gray-100">
      {/* Khối Avatar */}
      <TouchableOpacity
        onPress={() => onStartConversation(item?.friendId)}
        className="relative"
      >
        <GroupAvatar uri={item?.avatarUrl} name={item?.name || ""} size={48} />

        {isOnline && (
          <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
        )}
      </TouchableOpacity>

      {/* Tên User */}
      <Text className="ml-4 flex-1 text-[17px] font-medium text-gray-800">
        {item?.name}
      </Text>

      {/* Cụm Icon Call & Video */}
      <View className="flex-row gap-x-6 items-center pr-1">
        <TouchableOpacity onPress={() => item && onStartVideoCall?.(item)}>
          <Ionicons name="call-outline" size={22} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => item && onStartVideoCall?.(item)}>
          <Ionicons name="videocam-outline" size={25} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default FriendItem;
