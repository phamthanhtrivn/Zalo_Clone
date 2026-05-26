import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import Container from "@/components/common/Container";
import { useSocket } from "@/contexts/SocketContext";
import {
  getSocialNotifications,
  getStories,
  markSocialNotificationRead,
} from "@/services/social.service";

type SocialNotificationItem = {
  id: string;
  type: "POST_COMMENT" | "POST_REACTION" | "STORY_REACTION" | "STORY_REPLY";
  title: string;
  body: string;
  actorName: string;
  actorAvatar: string;
  postId?: string | null;
  storyId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

const formatNotificationTitle = (item: SocialNotificationItem) => {
  switch (item.type) {
    case "POST_COMMENT":
      return "Bình luận mới";
    case "POST_REACTION":
      return item.title?.toLowerCase().includes("chia")
        ? "Bài đăng được chia sẻ"
        : "Cảm xúc mới trên bài đăng";
    case "STORY_REACTION":
      return "Cảm xúc mới trên story";
    case "STORY_REPLY":
      return "Có phản hồi story mới";
    default:
      return item.title || "Thông báo mới";
  }
};

const formatNotificationBody = (item: SocialNotificationItem) => {
  switch (item.type) {
    case "POST_COMMENT":
      return "đã bình luận bài đăng của bạn";
    case "POST_REACTION":
      if (item.title?.toLowerCase().includes("chia")) {
        return "đã chia sẻ bài đăng của bạn";
      }
      return item.body?.toLowerCase().includes("tim")
        ? "đã thả tim vào bài đăng của bạn"
        : "đã thả cảm xúc vào bài đăng của bạn";
    case "STORY_REACTION":
      return item.body?.toLowerCase().includes("tim")
        ? "đã thả tim vào story của bạn"
        : "đã thả cảm xúc vào story của bạn";
    case "STORY_REPLY":
      return "đã trả lời story của bạn";
    default:
      return item.body || "";
  }
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
};

export default function SocialNotificationsScreen() {
  const router = useRouter();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<SocialNotificationItem[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const res: any = await getSocialNotifications();
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (payload: SocialNotificationItem) => {
      setItems((prev) => [
        {
          ...payload,
          readAt: payload.readAt || null,
        },
        ...prev.filter((item) => item.id !== payload.id),
      ]);
    };

    socket.on("social:notification", handleNewNotification);
    return () => {
      socket.off("social:notification", handleNewNotification);
    };
  }, [socket]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.readAt).length,
    [items],
  );

  const openStoryNotification = useCallback(
    async (notification: SocialNotificationItem) => {
      const storyId = notification.storyId;
      if (!storyId) return;

      try {
        const res: any = await getStories();
        const groups = Array.isArray(res?.data) ? res.data : [];

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
          const group = groups[groupIndex];
          const startIndex = (group?.stories || []).findIndex(
            (story: any) => String(story.id) === String(storyId),
          );

          if (startIndex > -1) {
            const story = group.stories[startIndex];
            router.push({
              pathname: "/private/story-viewer",
              params: {
                authorId: group.authorId,
                userName: group.userName,
                userAvatar: group.userAvatar,
                hoursAgo: "",
                storiesJson: JSON.stringify(group.stories || []),
                startIndex,
                groupsJson: JSON.stringify(groups),
                groupIndex,
                id: story.id,
                mediaUri: story.mediaUri || "",
                text: story.text || "",
                mediaType: story.mediaType || "TEXT",
              },
            });
            return;
          }
        }

        Alert.alert("Thông báo", "Story này đã hết hạn hoặc không còn tồn tại.");
      } catch {
        Alert.alert("Lỗi", "Không mở được story lúc này.");
      }
    },
    [router],
  );

  const handleOpen = useCallback(
    async (notification: SocialNotificationItem) => {
      try {
        await markSocialNotificationRead(notification.id);
      } catch {
        // no-op
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: item.readAt || new Date().toISOString() }
            : item,
        ),
      );

      if (notification.postId) {
        router.push({
          pathname: "/private/post-viewer",
          params: { postId: notification.postId },
        });
        return;
      }

      if (notification.storyId) {
        await openStoryNotification(notification);
      }
    },
    [openStoryNotification, router],
  );

  return (
    <Container className="bg-[#eef2f7]">
      <View className="px-4 pt-4 pb-3 flex-row items-center justify-between bg-white border-b border-[#e5e7eb]">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text className="text-[18px] font-semibold text-[#111827]">
            Thông báo
          </Text>
        </View>
        {unreadCount > 0 ? (
          <View className="px-2 py-1 rounded-full bg-[#ef4444]">
            <Text className="text-white text-[12px] font-semibold">
              {unreadCount}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0068FF" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
              colors={["#0068FF"]}
            />
          }
          contentContainerStyle={{
            padding: 12,
            flexGrow: items.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6">
              <Ionicons name="notifications-off-outline" size={40} color="#94a3b8" />
              <Text className="text-[#475569] text-[16px] font-semibold mt-3">
                Chưa có thông báo
              </Text>
              <Text className="text-[#94a3b8] text-center mt-1">
                Khi ai đó bình luận hoặc thả cảm xúc, thông báo sẽ hiện ở đây.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleOpen(item)}
              className={`mb-3 rounded-[22px] px-4 py-4 border ${
                item.readAt
                  ? "bg-white border-[#e5e7eb]"
                  : "bg-[#eff6ff] border-[#bfdbfe]"
              }`}
            >
              <View className="flex-row items-start">
                <Image
                  source={{
                    uri:
                      item.actorAvatar ||
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
                  }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                />
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[15px] font-semibold text-[#111827] flex-1 mr-3">
                      {formatNotificationTitle(item)}
                    </Text>
                    {!item.readAt ? (
                      <View className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                    ) : null}
                  </View>
                  <Text className="text-[#374151] mt-1">
                    <Text className="font-semibold">{item.actorName}</Text>{" "}
                    {formatNotificationBody(item)}
                  </Text>
                  <Text className="text-[#94a3b8] text-[12px] mt-2">
                    {timeAgo(item.createdAt)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </Container>
  );
}
