import Container from "@/components/common/Container";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppSelector } from "@/store/store";
import { messageService } from "@/services/message.service";
import { useSocket } from "@/contexts/SocketContext";

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { socket, setActiveConversationId } = useSocket();

  const conversationId =
    (typeof params.id === "string" ? params.id : undefined) ||
    (typeof params.conversationId === "string" ? params.conversationId : undefined) ||
    "";

  console.log("Màn hình chat đã mở với ID:", conversationId);

  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.userId || "";

  const conversations = useAppSelector(
    // BUG-7 fix: state.conversation.items không tồn tại → gây crash khi gọi .find()
    (state) => state.conversation.conversations,
  );
  const conversation = useMemo(
    () => conversations.find((c) => c.conversationId === conversationId),
    [conversations, conversationId],
  );

  const title = conversation?.name || "Trò chuyện";

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setActiveConversationId(conversationId || null);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const load = async () => {
      try {
        const res = await messageService.getMessagesFromConversation(
          conversationId,
          currentUserId,
          null,
          30,
        );
        if (res?.success && res?.data?.messages) {
          // Backend trả newest-first -> dùng inverted để newest nằm dưới.
          setMessages(res.data.messages);
        }
      } catch (e) {
        // ignore for now
      }
    };
    load();
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("join_room", conversationId);

    const onNewMessage = (payload: any) => {
      if (payload?.conversationId !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === payload._id)) return prev;
        // newest-first
        return [payload, ...prev];
      });
    };

    socket.on("new_message", onNewMessage);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.emit("leave_room", conversationId);
    };
  }, [socket, conversationId]);

  const handleSend = async () => {
    if (!conversationId || !currentUserId) return;
    if (!text.trim()) return;

    const sendingText = text.trim();
    setText("");
    try {
      await messageService.sendMessage(conversationId, currentUserId, {
        text: sendingText,
      });
      // Tin nhắn sẽ được socket "new_message" đẩy về để append.
    } catch (e) {
      // nếu fail thì restore text để user không mất nội dung
      setText(sendingText);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSystem = item?.type === "SYSTEM" || item?.senderId == null;
    if (isSystem) {
      return (
        <View className="px-4 py-2 items-center">
          <Text className="text-[11px] text-gray-400 text-center">
            {item?.content?.text || ""}
          </Text>
        </View>
      );
    }

    const senderId =
      typeof item?.senderId === "string"
        ? item.senderId
        : item?.senderId?._id || "";
    const isMe = String(senderId) === String(currentUserId);
    const msgText = item?.content?.text || "";

    return (
      <View className={`px-3 py-1 ${isMe ? "items-end" : "items-start"}`}>
        <View
          className={`max-w-[80%] px-3 py-2 rounded-2xl ${isMe ? "bg-[#e1f0ff]" : "bg-white"
            }`}
        >
          <Text className="text-[14px] text-black">{msgText}</Text>
        </View>
      </View>
    );
  };

  return (
    <Container className="bg-[#f5f6f8]">
      <Text className="px-4 py-2 text-[12px] text-gray-500">Chat Screen Ready</Text>
      {/* Header */}
      <View className="h-14 bg-white flex-row items-center px-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View className="flex-1 min-w-0 px-1">
          <Text className="text-[15px] font-bold text-black" numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View className="flex-row items-center">
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <Ionicons name="call-outline" size={20} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <Ionicons name="videocam-outline" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <Ionicons name="menu" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
        />

        {/* Input */}
        <View className="bg-white px-2 py-2 border-t border-gray-100 flex-row items-end">
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <MaterialCommunityIcons name="sticker-emoji" size={22} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <Ionicons name="image-outline" size={22} color="#6b7280" />
          </TouchableOpacity>

          <View className="flex-1 mx-1 bg-[#f3f4f6] rounded-2xl px-3 py-2">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Nhắn tin"
              placeholderTextColor="#9ca3af"
              className="text-[14px] text-black"
              multiline
            />
          </View>

          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <Ionicons name="mic-outline" size={22} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSend}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="send" size={20} color="#0068ff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}
