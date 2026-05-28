import { FlatList, View, Text, RefreshControl, Pressable, TouchableOpacity, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector } from "@/store/store";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import SearchIcon from "@/components/common/SearchIcon";
import SearchLabel from "@/components/common/SearchLabel";
import ConversationItem from "@/components/chat/ConversationItem";
import { useEffect, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import { useRouter } from "expo-router";
import { scale } from "@/utils/responsive";
import CreateGroupModal from "@/components/chat/CreateGroupModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  removeExpiredMessages,
  setConversations,
  updateConversation,
} from "@/store/slices/conversationSlice";
import { useSocket } from "@/contexts/SocketContext";
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";
import QRIcon from "@/components/common/QRIcon";

// Memoized selector — only recomputes when conversations array changes

// Home.tsx
const selectVisibleConversations = createSelector(
  (state: RootState) => state.conversation.conversations,
  (conversations) => {
    return [...conversations]
      .filter((c) => !c.hidden)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
        );
      });
  },
);

export default function Home() {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const conversations = useAppSelector(selectVisibleConversations);
  const user = useAppSelector((state) => state.auth.user);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"PRIORITY" | "OTHER">("PRIORITY");
  const [showMenu, setShowMenu] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // 🔥 Load conversations
  const loadConversations = async () => {
    if (!user?.userId) return;

    const res = await conversationService.getConversationsFromUserId(
      user.userId,
    );

    if ((res as any).success) {
      dispatch(setConversations(res.data));
    }
  };
  // 🔄 Pull refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };


  useEffect(() => {
    loadConversations();
  }, [user?.userId]);

  useEffect(() => {
    if (!socket || !user?.userId) return;

    const handleNewMessage = (newMessage: any) => {
      if (newMessage?.conversation) {
        dispatch(updateConversation(newMessage.conversation));
      }
    };

    const handleBlockEvent = () => {
      loadConversations();
    };

    socket.on("new_message", handleNewMessage);
    socket.on("blocked", handleBlockEvent);
    socket.on("blocked_by", handleBlockEvent);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("blocked", handleBlockEvent);
      socket.off("blocked_by", handleBlockEvent);
    };
  }, [socket, user?.userId]);

  useEffect(() => {
    const expiringConversations = conversations.filter(
      (conversation) =>
        conversation.lastMessage &&
        !conversation.lastMessage.expired &&
        conversation.lastMessage.expiresAt,
    );

    if (!expiringConversations.length) return;

    const nextExpiryAt = Math.min(
      ...expiringConversations
        .map((conversation) =>
          new Date(conversation.lastMessage.expiresAt!).getTime(),
        )
        .filter((time) => !Number.isNaN(time)),
    );

    if (!Number.isFinite(nextExpiryAt)) return;

    const syncExpiredConversations = () => {
      const expiredMessageIds = conversations
        .filter((conversation) => {
          const expiresAt = conversation.lastMessage?.expiresAt;
          if (conversation.lastMessage?.expired || !expiresAt) return false;

          const expiresAtMs = new Date(expiresAt).getTime();
          return !Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now();
        })
        .map((conversation) => conversation.lastMessage!._id);

      if (expiredMessageIds.length) {
        dispatch(removeExpiredMessages(expiredMessageIds));
      }
    };

    const delay = nextExpiryAt - Date.now();
    if (delay <= 0) {
      syncExpiredConversations();
      return;
    }

    const timeoutId = setTimeout(syncExpiredConversations, delay + 50);
    return () => clearTimeout(timeoutId);
  }, [conversations, dispatch]);

  return (
    <Container>
      <Header
        gradient
        centerChild={<SearchLabel />}
        leftChild={<SearchIcon />}
        rightChild={
          <View className="flex-row items-center gap-x-6">
            <QRIcon />
            <TouchableOpacity onPress={() => setShowMenu(true)}>
              <Ionicons name="add" size={scale(24)} color="white" />
            </TouchableOpacity>
          </View>
        }
      />
      <View className="flex-1 bg-white">
        {/* Tabs */}


        {conversations.length === 0 ? (
          <View className="flex-1 items-center justify-center px-10">
            <Text className="text-gray-400 text-center text-sm">
              Chưa có cuộc trò chuyện nào. Hãy bắt đầu nhắn tin!
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.conversationId}
            renderItem={({ item }) => (
              <ConversationItem
                conversation={item}
                currentUserId={user?.userId || ""}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 20 }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={10}
            removeClippedSubviews
          />
        )}
      </View>

      {/* Pop-up Options Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          className="flex-1 bg-black/10"
          onPress={() => setShowMenu(false)}
        >
          <View
            style={{
              position: "absolute",
              top: insets.top + 52,
              right: 12,
              backgroundColor: "white",
              borderRadius: 8,
              paddingVertical: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 8,
              width: 185,
              borderWidth: 0.5,
              borderColor: "#e5e7eb",
            }}
          >
            {/* 1. Thêm bạn */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
              onPress={() => {
                setShowMenu(false);
                router.push("/private/search-friends");
              }}
            >
              <Ionicons name="person-add-outline" size={19} color="#374151" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: "#1f2937", fontWeight: "400" }}>Thêm bạn</Text>
            </TouchableOpacity>

            {/* 2. Tạo nhóm */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
              onPress={() => {
                setShowMenu(false);
                setIsCreateGroupOpen(true);
              }}
            >
              <Ionicons name="people-outline" size={19} color="#374151" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: "#1f2937", fontWeight: "400" }}>Tạo nhóm</Text>
            </TouchableOpacity>

            {/* 3. Thiết bị đăng nhập */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
              onPress={() => {
                setShowMenu(false);
                router.push("/private/sessions");
              }}
            >
              <Ionicons name="desktop-outline" size={19} color="#374151" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: "#1f2937", fontWeight: "400" }}>Thiết bị đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <CreateGroupModal
        visible={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSuccess={loadConversations}
      />
    </Container>
  );
}
