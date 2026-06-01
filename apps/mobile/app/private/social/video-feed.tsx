import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppSelector } from "@/store/store";
import CommentSheet from "@/components/social/CommentSheet";
import {
  followVideoCreator,
  getVideoFeed,
  reactPost,
  sharePost,
  unfollowVideoCreator,
} from "@/services/social.service";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const TOP_TABS = [
  { key: "following", label: "Theo dõi" },
  { key: "for-you", label: "Cho bạn" },
];

export default function VideoFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initialVideoId, category, authorId, feedType } =
    useLocalSearchParams<{
      initialVideoId?: string;
      category?: string;
      authorId?: string;
      feedType?: string;
    }>();
  const listRef = useRef<FlatList<any> | null>(null);
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.userId || (currentUser as any)?._id || "";
  const [videos, setVideos] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTopTab, setActiveTopTab] = useState(
    typeof feedType === "string" && feedType === "following"
      ? "following"
      : "for-you",
  );
  const [commentSheetPostId, setCommentSheetPostId] = useState<string | null>(
    null,
  );

  const loadVideos = useCallback(async () => {
    try {
      const res: any = await getVideoFeed(
        typeof category === "string" ? category : undefined,
        activeTopTab,
        typeof authorId === "string" ? authorId : undefined,
      );
      setVideos(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setVideos([]);
    }
  }, [activeTopTab, authorId, category]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    if (!initialVideoId || videos.length === 0) return;
    const index = videos.findIndex(
      (item) => String(item.id) === String(initialVideoId),
    );
    if (index >= 0) {
      setActiveIndex(index);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index, animated: false });
      });
    }
  }, [initialVideoId, videos]);

  const onMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.y / SCREEN_HEIGHT,
    );
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  const updateVideoItem = useCallback(
    (postId: string, patch: Record<string, any>) => {
      setVideos((prev) =>
        prev.map((item) =>
          String(item.id) === String(postId) ? { ...item, ...patch } : item,
        ),
      );
    },
    [],
  );

  const updateAuthorItems = useCallback(
    (nextAuthorId: string, patch: Record<string, any>) => {
      setVideos((prev) =>
        prev.map((item) =>
          String(item.authorId) === String(nextAuthorId)
            ? { ...item, ...patch }
            : item,
        ),
      );
    },
    [],
  );

  const handleToggleLike = useCallback(
    async (postId: string, myReaction?: string | null) => {
      const res: any = await reactPost(
        postId,
        myReaction ? myReaction : "LIKE",
      );
      const payload = res?.data ?? res;
      updateVideoItem(postId, {
        likes: payload?.likes ?? 0,
        reactionCounts: payload?.reactionCounts ?? {},
        myReaction: payload?.myReaction ?? null,
      });
    },
    [updateVideoItem],
  );

  const handleShareVideo = useCallback(
    async (item: any) => {
      await Share.share({
        message: `${item.text || "Xem video này trên Zalo Clone"}\n${item.videoUrl}`,
      });
      try {
        const res: any = await sharePost(item.id);
        const payload = res?.data ?? res;
        updateVideoItem(item.id, {
          shares: payload?.shareCount ?? (item.shares || 0) + 1,
        });
      } catch {
        updateVideoItem(item.id, {
          shares: (item.shares || 0) + 1,
        });
      }
    },
    [updateVideoItem],
  );

  const handleToggleFollow = useCallback(
    async (item: any) => {
      if (!item?.authorId || String(item.authorId) === String(currentUserId))
        return;

      try {
        const res: any = item.isFollowing
          ? await unfollowVideoCreator(item.authorId)
          : await followVideoCreator(item.authorId);
        const payload = res?.data ?? res;
        updateAuthorItems(item.authorId, {
          isFollowing: payload?.isFollowing ?? !item.isFollowing,
        });
      } catch {
        // ignore follow toggle error
      }
    },
    [currentUserId, updateAuthorItems],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isActive = index === activeIndex;
      const isOwnVideo =
        String(item.authorId || "") === String(currentUserId || "");

      return (
        <View
          style={{
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            backgroundColor: "#000",
          }}
        >
          <Video
            source={{ uri: item.videoUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive}
            isLooping
            isMuted={false}
          />

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              paddingTop: insets.top + 10,
              paddingHorizontal: 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={28} color="white" />
              </Pressable>

              <View className="flex-row items-center gap-8">
                {TOP_TABS.map((tab) => {
                  const active = activeTopTab === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveTopTab(tab.key)}
                    >
                      <Text
                        className={`text-[18px] ${active ? "font-semibold text-white" : "text-white/65"}`}
                      >
                        {tab.label}
                      </Text>
                      {active ? (
                        <View className="mt-2 h-[2px] rounded-full bg-white" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row items-center gap-4">
                <Ionicons name="search-outline" size={24} color="white" />
                <Ionicons
                  name="person-circle-outline"
                  size={28}
                  color="white"
                />
              </View>
            </View>
          </View>

          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: insets.bottom + 18,
            }}
          >
            <View className="flex-row items-end justify-between">
              <View className="mr-4 flex-1">
                <View className="mb-3 flex-row items-center">
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/private/social/video-profile",
                        params: { userId: item.authorId },
                      })
                    }
                    className="flex-1 flex-row items-center"
                  >
                    <Image
                      source={{ uri: item.avatar }}
                      style={{ width: 34, height: 34, borderRadius: 17 }}
                    />
                    <Text className="ml-2 flex-1 text-[15px] font-semibold text-white">
                      {item.name}
                    </Text>
                  </Pressable>
                  {!isOwnVideo ? (
                    <Pressable
                      onPress={() => handleToggleFollow(item)}
                      className={`rounded-xl px-4 py-2 ${item.isFollowing ? "bg-white/15" : "bg-[#0b63ce]"}`}
                    >
                      <Text className="text-[15px] font-semibold text-white">
                        {item.isFollowing ? "Đang theo dõi" : "Theo dõi"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text
                  numberOfLines={2}
                  className="mb-3 text-[15px] leading-6 text-white"
                >
                  {item.text || "Video từ Zalo Video"}
                </Text>

                <View className="h-1 overflow-hidden rounded-full bg-white/35">
                  <View className="h-full w-[18%] rounded-full bg-white" />
                </View>
              </View>

              <View className="items-center pb-1">
                <Pressable
                  className="mb-5 items-center"
                  onPress={() => handleToggleLike(item.id, item.myReaction)}
                >
                  <Ionicons
                    name={item.myReaction ? "heart" : "heart-outline"}
                    size={34}
                    color={item.myReaction ? "#ef4444" : "white"}
                  />
                  <Text className="mt-1 text-[13px] font-semibold text-white">
                    {item.likes || 0}
                  </Text>
                </Pressable>
                <Pressable
                  className="mb-5 items-center"
                  onPress={() => setCommentSheetPostId(item.id)}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={34}
                    color="white"
                  />
                  <Text className="mt-1 text-[13px] font-semibold text-white">
                    {item.comments || 0}
                  </Text>
                </Pressable>
                <Pressable className="mb-5 items-center">
                  <Ionicons name="bookmark-outline" size={34} color="white" />
                  <Text className="mt-1 text-[13px] font-semibold text-white">
                    0
                  </Text>
                </Pressable>
                <Pressable
                  className="mb-5 items-center"
                  onPress={() => handleShareVideo(item)}
                >
                  <Ionicons name="arrow-redo-outline" size={34} color="white" />
                  <Text className="mt-1 text-[13px] font-semibold text-white">
                    {item.shares || 0}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [
      activeIndex,
      activeTopTab,
      currentUserId,
      handleShareVideo,
      handleToggleFollow,
      handleToggleLike,
      insets.bottom,
      insets.top,
      router,
    ],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    [],
  );

  if (!videos.length) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Pressable
          onPress={() => router.back()}
          className="absolute left-4 top-14"
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </Pressable>
        <Text className="text-white/80">Chưa có video để hiển thị</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        ref={listRef}
        data={videos}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        windowSize={3}
      />
      <CommentSheet
        postId={commentSheetPostId || ""}
        visible={!!commentSheetPostId}
        onClose={() => setCommentSheetPostId(null)}
        currentUserId={currentUserId}
        onCommentAdded={() => {
          if (commentSheetPostId) {
            const current = videos.find(
              (item) => String(item.id) === String(commentSheetPostId),
            );
            updateVideoItem(commentSheetPostId, {
              comments: (current?.comments || 0) + 1,
            });
          }
        }}
        onCommentDeleted={() => {
          if (commentSheetPostId) {
            const current = videos.find(
              (item) => String(item.id) === String(commentSheetPostId),
            );
            updateVideoItem(commentSheetPostId, {
              comments: Math.max((current?.comments || 1) - 1, 0),
            });
          }
        }}
      />
    </>
  );
}
