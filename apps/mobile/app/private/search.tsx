import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import { conversationService } from "@/services/conversation.service";
import { messageService } from "@/services/message.service";
import { userService } from "@/services/user.service";
import { fetchConversations } from "@/store/slices/conversationSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { showToast } from "@/utils/toast";

import { useQuery } from "@tanstack/react-query";
import GroupAvatar from "@/components/ui/GroupAvatar";
import { getFileIcon } from "@/utils/file-icon.util";
import { truncateFileName } from "@/utils/render-file";
import { formatFileSize } from "@/utils/format-file.util";

const TABS = [
  { id: "all", label: "Tất cả" },
  { id: "contacts", label: "Bạn bè" },
  { id: "groups", label: "Nhóm" },
  { id: "messages", label: "Tin nhắn" },
  { id: "files", label: "File" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SearchScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { conversationId: targetConversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();
  const isConversationSearch = !!targetConversationId;

  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [scope, setScope] = useState<TabId>("all");
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [friendRequestingIds, setFriendRequestingIds] = useState<string[]>([]);

  const flatListRef = useRef<FlatList>(null);

  const user = useAppSelector((state) => state.auth.user);
  const userId = user?.userId || (user as any)?._id;

  // Debounce logic for keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  // React Query for fetching members (only for conversation search)
  const { data: memberData } = useQuery({
    queryKey: ["members", targetConversationId],
    queryFn: () => conversationService.getListMembers(targetConversationId!),
    enabled: isConversationSearch && !!targetConversationId,
  });

  // Derived members from query data instead of manual state
  const members = useMemo(() => {
    if (memberData?.success && Array.isArray(memberData.data)) {
      return memberData.data;
    }
    return [];
  }, [memberData]);

  // Main search query
  const { data: searchData, isLoading: loading } = useQuery({
    queryKey: ["search", userId, debouncedKeyword, isConversationSearch, targetConversationId, selectedSenderId],
    queryFn: async () => {
      if (!debouncedKeyword) return null;
      if (isConversationSearch && targetConversationId) {
        const res = await messageService.searchMessages(targetConversationId, {
          userId,
          keyword: debouncedKeyword,
          senderId: selectedSenderId || undefined,
          limit: 50,
        });
        return res?.success ? { messages: res.data?.messages || [] } : null;
      } else {
        const res = await conversationService.search({
          userId,
          keyword: debouncedKeyword,
          scope: "all",
        });
        return res?.success ? res.data : null;
      }
    },
    enabled: !!userId && !!debouncedKeyword,
  });

  const results = searchData;

  const displayData = useMemo(() => {
    if (isConversationSearch) return results?.messages || [];
    if (!results) return [];

    switch (scope) {
      case "contacts":
        return results.contacts || [];
      case "groups":
        return results.groups || [];
      case "messages":
        return results.messages || [];
      case "files":
        return results.files || [];
      default:
        // "all" tab
        return [
          ...(results.contacts || []),
          ...(results.groups || []),
          ...(results.messages || []),
          ...(results.files || []),
        ];
    }
  }, [results, scope, isConversationSearch]);

  const filteredMessages = useMemo(() => results?.messages || [], [results]);

  useEffect(() => {
    if (isConversationSearch && filteredMessages.length > 0) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(-1);
    }
  }, [filteredMessages, isConversationSearch]);

  useEffect(() => {
    if (filteredMessages.length === 0) {
      setCurrentIndex(-1);
      return;
    }

    if (currentIndex >= filteredMessages.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, filteredMessages]);

  const openMessageResult = (messageId: string, conversationId?: string) => {
    const chatId = conversationId || targetConversationId;
    if (!chatId) return;

    router.replace({
      pathname: "/private/chat/[id]",
      params: { id: chatId, messageId, fromSearch: "1" },
    });
  };

  const openDirectConversation = async (targetUserId: string) => {
    try {
      const response: any = await conversationService.getOrCreateDirect(targetUserId);
      const conversationId =
        response?.data?._id ||
        response?.data?.conversationId ||
        response?._id ||
        response?.conversationId;

      if (!conversationId) {
        throw new Error("Missing conversation id");
      }

      try {
        await dispatch(fetchConversations()).unwrap();
      } catch {
        // The chat can still open using the returned conversation id.
      }

      router.push({
        pathname: "/private/chat/[id]",
        params: { id: conversationId, otherUserId: targetUserId, fromSearch: "1" },
      });
    } catch (error) {
      showToast(
        (error as any)?.response?.data?.message ||
        "Không thể mở cuộc trò chuyện, vui lòng thử lại",
      );
    }
  };

  const handleAddFriendFromSearch = async (targetUserId: string) => {
    if (!userId || !targetUserId || friendRequestingIds.includes(targetUserId)) {
      return;
    }

    try {
      setFriendRequestingIds((prev) => [...prev, targetUserId]);
      const response = await userService.addFriend(targetUserId, userId);
      showToast(response?.message || "Đã gửi lời mời kết bạn");
    } catch (error) {
      showToast(
        (error as any)?.response?.data?.message ||
        "Không thể gửi lời mời kết bạn",
      );
    } finally {
      setFriendRequestingIds((prev) => prev.filter((id) => id !== targetUserId));
    }
  };

  const navigateToResult = (direction: "up" | "down") => {
    if (filteredMessages.length === 0) return;

    let nextIndex = currentIndex;
    if (direction === "up") {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredMessages.length - 1;
    } else {
      nextIndex = currentIndex < filteredMessages.length - 1 ? currentIndex + 1 : 0;
    }

    setCurrentIndex(nextIndex);
    flatListRef.current?.scrollToIndex({
      index: nextIndex,
      animated: true,
      viewPosition: 0.5,
    });
  };

  const renderGlobalSearchResult = ({ item }: { item: any }) => {
    const isContact = !!item.userId && !item.senderId && !item.content;
    const isMessage = !!item.senderId || !!item.messageId;
    const isGroup = !!item.memberLabel;
    const isFile = !!item.file;

    const handlePress = () => {
      const conversationId = item.conversationId || item._id;
      const messageId = item.messageId || item._id;

      if (isContact) {
        if (item.conversationId) {
          router.push({
            pathname: "/private/chat/[id]",
            params: { id: item.conversationId, otherUserId: item.userId, fromSearch: "1" },
          });
        } else {
          void openDirectConversation(item.userId);
        }
        return;
      }

      if (isMessage || isFile) {
        openMessageResult(messageId, conversationId);
        return;
      }

      router.push({
        pathname: "/private/chat/[id]",
        params: { id: conversationId, fromSearch: "1" },
      });
    };

    let displayName = "Người dùng";
    const resolveAvatar = (...values: Array<any>) => {
      const found = values.find(
        (v) => typeof v === "string" && v.trim().length > 0,
      );
      return found || "";
    };
    let avatarSource = "";
    let subLabel = "";
    let icon = null;

    if (isContact) {
      displayName = item.name || item.phone || "Người dùng";
      avatarSource = resolveAvatar(
        item.avatar,
        item.avatarUrl,
        item.profile?.avatarUrl,
        item.user?.profile?.avatarUrl,
      );
      if (item.isFriend) {
        subLabel = "Bạn bè";
      } else if (item.isExistingConversation) {
        subLabel = "Đã trò chuyện";
      } else {
        subLabel = item.phone || "Chưa kết bạn";
      }
    } else if (isGroup) {
      displayName = item.name || "Nhóm";
      avatarSource = resolveAvatar(
        item.avatar,
        item.avatarUrl,
        item.groupAvatar,
        item.profile?.avatarUrl,
      );
      subLabel = "Nhóm";
      icon = <Ionicons name="people" size={14} color="#6b7280" />;
    } else if (isMessage) {
      displayName = item.conversationName || "Cuộc trò chuyện";
      avatarSource = resolveAvatar(
        item.conversationAvatar,
        item.avatar,
        item.avatarUrl,
        item.senderAvatar,
      );
      subLabel = `${item.senderName || "Người dùng"}: ${item.text || ""}`;
      icon = <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />;
    } else if (isFile) {
      displayName = item.conversationName || "Cuộc trò chuyện";
      avatarSource = resolveAvatar(
        item.conversationAvatar,
        item.avatar,
        item.avatarUrl,
        item.senderAvatar,
      );
      subLabel = `${item.senderName || "Người dùng"}: ${item.file.fileName}`;
      icon = <Ionicons name="document-outline" size={14} color="#6b7280" />;
    }

    const isSendingFriendRequest = friendRequestingIds.includes(item.userId);
    const canAddFriend =
      isContact &&
      !item.isFriend &&
      !!item.userId &&
      item.status !== "PENDING" &&
      item.status !== "REQUESTED";

    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100"
        onPress={handlePress}
      >
        <GroupAvatar
          uri={avatarSource}
          name={displayName}
          size={48}
        />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-[16px] font-semibold text-black"
              numberOfLines={1}
              style={{ maxWidth: "75%" }}
            >
              {displayName}
            </Text>
            {icon}
          </View>
          <Text className="text-[13px] text-gray-500 mt-0.5" numberOfLines={1}>
            {subLabel}
          </Text>
        </View>
        {canAddFriend && (
          <TouchableOpacity
            disabled={isSendingFriendRequest}
            onPress={() => handleAddFriendFromSearch(item.userId)}
            className={`ml-3 px-3 py-2 rounded-full ${isSendingFriendRequest ? "bg-[#dbeafe]" : "bg-[#0091ff]"
              }`}
          >
            <Text
              className={`text-[12px] font-semibold ${isSendingFriendRequest ? "text-[#0a67d8]" : "text-white"
                }`}
            >
              {isSendingFriendRequest ? "Đang gửi" : "Kết bạn"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderConversationResult = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const senderId = typeof item.senderId === "string" ? item.senderId : item.senderId?._id;
    const isMe = senderId === userId;
    const isActive = index === currentIndex;
    const senderName = item.senderId?.profile?.name || "Người dùng";
    const messageText = item.content?.text || item.text || "";
    const timeText = new Date(item.createdAt).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });

    const documentFiles = (item.content?.files || []).filter(
      (f: any) => f.type === "FILE" || f.type === "VOICE"
    );
    const hasText = !!messageText;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openMessageResult(item._id)}
        style={{
          paddingHorizontal: 12,
          marginBottom: 10,
          alignItems: isMe ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            maxWidth: "82%",
            ...(documentFiles.length > 0 ? { minWidth: Dimensions.get("window").width * 0.65 } : {}),
            borderRadius: 18,
            borderWidth: isActive ? 2 : 0,
            borderColor: "#0a84ff",
            backgroundColor: isMe ? "#d8f0ff" : "#ffffff",
            paddingHorizontal: 14,
            paddingVertical: 10,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          {!isMe && (
            <Text
              style={{
                color: "#6b7280",
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 4,
              }}
            >
              {senderName}
            </Text>
          )}
          {hasText && (
            <Text
              style={{
                color: "#111827",
                fontSize: 16,
                lineHeight: 22,
              }}
              numberOfLines={3}
            >
              {messageText}
            </Text>
          )}
          {documentFiles.length > 0 && (
            <View style={{ marginTop: hasText ? 6 : 0, gap: 4 }}>
              {documentFiles.map((file: any, idx: number) => {
                const cleanName = decodeURIComponent(file.fileName || "");
                const sizeStr = file.fileSize ? formatFileSize(file.fileSize) : "0 KB";

                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(0, 0, 0, 0.05)",
                      padding: 8,
                      borderRadius: 6,
                      gap: 12,
                    }}
                  >
                    <View style={{ width: 28, height: 28, justifyContent: "center", alignItems: "center" }}>
                      {getFileIcon(cleanName, 28)}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "500", color: "#111" }}>
                        {truncateFileName(cleanName, 35) || cleanName}
                      </Text>
                      <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        {sizeStr}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {!hasText && documentFiles.length === 0 && item.content?.files?.length > 0 && (
            <Text
              style={{ color: "#6b7280", fontSize: 14, fontStyle: "italic" }}
              numberOfLines={2}
            >
              {item.content.files.map((f: any) => f.fileName || f.name).join(", ")}
            </Text>
          )}
        </View>
        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: isActive ? "#0a84ff" : "#9ca3af",
          }}
        >
          {timeText}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View className="items-center mt-20 px-10">
      <Text className="text-gray-500 text-center">
        Không tìm thấy kết quả phù hợp cho {'"'}
        {keyword}
        {'"'}
      </Text>
    </View>
  );

  return (
    <Container edges={["left", "right", "bottom", "top"]} className="flex-1 bg-[#F1F2F4]">
      <Header
        back
        gradient={!isConversationSearch}
        centerChild={
          <View
            className={`flex-1 flex-row items-center rounded-md px-3 h-10 `}
          >
            <TextInput
              autoFocus
              placeholder={
                isConversationSearch
                  ? "Tìm tin nhắn văn bản"
                  : "Tìm kiếm bạn bè, tin nhắn..."
              }
              placeholderTextColor={
                isConversationSearch ? "#9ca3af" : "rgba(255,255,255,0.7)"
              }
              className={`flex-1 ml-2 text-[16px] ${isConversationSearch ? "text-black" : "text-white"}`}
              style={{
                paddingVertical: 0,
                textAlignVertical: "center",
                includeFontPadding: false,
              }}
              value={keyword}
              onChangeText={setKeyword}
              selectionColor={isConversationSearch ? "#0a84ff" : "white"}
              returnKeyType="search"
              onSubmitEditing={() => {
                const currentMessage = filteredMessages[currentIndex];
                if (currentMessage?._id) {
                  openMessageResult(currentMessage._id);
                }
              }}
            />
            {keyword.length > 0 && (
              <TouchableOpacity onPress={() => setKeyword("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={isConversationSearch ? "#9ca3af" : "rgba(255,255,255,0.8)"}
                />
              </TouchableOpacity>
            )}
          </View>
        }
        rightChild={
          !isConversationSearch && (
            <TouchableOpacity className="p-2 ml-1" onPress={() => console.log("Scan QR")}>
              <MaterialCommunityIcons name="qrcode-scan" size={22} color="white" />
            </TouchableOpacity>
          )
        }
      />

      {isConversationSearch && members.length > 0 && (
        <View className="bg-white border-b border-gray-200 py-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            <TouchableOpacity
              onPress={() => setSelectedSenderId(null)}
              className={`mr-3 px-3 py-1.5 rounded-full border ${!selectedSenderId ? "bg-blue-50 border-[#0091ff]" : "bg-gray-50 border-gray-200"}`}
            >
              <Text className={`${!selectedSenderId ? "text-[#0091ff]" : "text-gray-600"} text-xs`}>
                Tất cả
              </Text>
            </TouchableOpacity>
            {members.map((member) => (
              <TouchableOpacity
                key={member.userId}
                onPress={() => setSelectedSenderId(member.userId)}
                className={`mr-3 flex-row items-center px-2 py-1 rounded-full border ${selectedSenderId === member.userId ? "bg-blue-50 border-[#0091ff]" : "bg-gray-50 border-gray-200"}`}
              >
                <GroupAvatar
                  uri={
                    member.avatarUrl ||
                    member.profile?.avatarUrl ||
                    member.user?.profile?.avatarUrl ||
                    ""
                  }
                  name={member.name}
                  size={20}
                />
                <Text className={`${selectedSenderId === member.userId ? "text-[#0091ff]" : "text-gray-600"} text-xs ml-1.5`}>
                  {member.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {!isConversationSearch && (
        <View className="flex-row border-b border-gray-200 bg-white">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setScope(tab.id)}
              className={`flex-1 items-center py-2.5 border-b-2 ${scope === tab.id ? "border-[#0091ff]" : "border-transparent"}`}
            >
              <Text
                className={`text-[14px] ${scope === tab.id ? "text-[#0091ff] font-medium" : "text-gray-500"}`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View className={`flex-1 ${isConversationSearch ? "bg-[#e9eef8]" : "bg-[#F1F2F4]"}`}>
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator color="#0091ff" />
            <Text className="mt-2 text-gray-400 text-xs">Đang tìm kiếm...</Text>
          </View>
        ) : keyword.trim() === "" ? (
          <ScrollView className="flex-1">
            <View className="p-4 items-center mt-10">
              <Ionicons name="search-outline" size={80} color="#D1D5DB" />
              <Text className="text-gray-400 text-center mt-4 text-[15px]">
                {isConversationSearch
                  ? "Nhập từ khóa để tìm trong cuộc trò chuyện"
                  : "Tìm kiếm bạn bè, tin nhắn, nhóm..."}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayData}
            keyExtractor={(item, index) =>
              (item.messageId || item._id || item.userId || item.conversationId) + index
            }
            renderItem={isConversationSearch ? renderConversationResult : renderGlobalSearchResult}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={{
              paddingTop: isConversationSearch ? 12 : 0,
              paddingBottom: isConversationSearch ? 96 : 20,
            }}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 250);
            }}
          />
        )}
      </View>

      {isConversationSearch && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "white",
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
            paddingHorizontal: 16,
            paddingVertical: Platform.OS === "ios" ? 14 : 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            activeOpacity={filteredMessages.length > 0 ? 0.8 : 1}
            onPress={() => {
              const currentMessage = filteredMessages[currentIndex];
              if (currentMessage?._id) {
                openMessageResult(currentMessage._id);
              }
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Ionicons
              name="search-outline"
              size={22}
              color={filteredMessages.length > 0 ? "#6b7280" : "#d1d5db"}
            />
            <Text style={{ color: "#6b7280", fontSize: 14 }}>
              {filteredMessages.length > 0 ? `${currentIndex + 1}/${filteredMessages.length}` : "0/0"}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => navigateToResult("up")}
              disabled={filteredMessages.length === 0}
              style={{ padding: 8 }}
            >
              <Ionicons
                name="chevron-up"
                size={24}
                color={filteredMessages.length > 0 ? "#9ca3af" : "#d1d5db"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateToResult("down")}
              disabled={filteredMessages.length === 0}
              style={{ padding: 8 }}
            >
              <Ionicons
                name="chevron-down"
                size={24}
                color={filteredMessages.length > 0 ? "#9ca3af" : "#d1d5db"}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Container>
  );
}
