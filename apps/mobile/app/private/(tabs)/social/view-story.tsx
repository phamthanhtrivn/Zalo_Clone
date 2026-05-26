import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Alert, Modal, ScrollView, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Audio, Video, ResizeMode } from "expo-av";
import Container from "@/components/common/Container";
import { useAppSelector } from "@/store/store";
import {
  deleteStory,
  getStoryViewers,
  markStoryViewed,
  reactStory,
  replyStory,
} from "@/services/social.service";
import { conversationService } from "@/services/conversation.service";

const IMAGE_STORY_DURATION_MS = 25000;
const TEXT_STORY_DURATION_MS = 15000;
const VIDEO_FALLBACK_DURATION_MS = 30000;

type StoryItem = {
  id: string;
  mediaUri?: string;
  text?: string;
  mediaType?: "IMAGE" | "VIDEO" | "TEXT";
  viewCount?: number;
  reactionCount?: number;
  reactionSummary?: { type: string; count: number }[];
  myReactionTypes?: string[];
  music?: {
    title?: string;
    artist?: string;
    previewUrl?: string;
    thumbnail?: string;
  } | null;
};

type StoryGroup = {
  authorId: string;
  userName: string;
  userAvatar: string;
  stories: StoryItem[];
};


type FloatingReaction = {
  id: number;
  emoji: string;
  left: number;
  translateY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
};

const REACTION_EMOJIS: Record<string, string> = {
  HEART: "\u2764\uFE0F",
  LIKE: "\u{1F44D}",
  HAHA: "\u{1F606}",
  WOW: "\u{1F62E}",
  SAD: "\u{1F622}",
};

export default function ViewStoryScreen() {
  const router = useRouter();
  const soundRef = useRef<Audio.Sound | null>(null);
  const reactionSeedRef = useRef(1);
  const {
    authorId = "",
    userName = "Người dùng",
    userAvatar = "",
    hoursAgo = "",
    storiesJson = "[]",
    startIndex = "0",
    groupsJson = "[]",
    groupIndex = "0",
  } = useLocalSearchParams<{
    authorId?: string;
    userName?: string;
    userAvatar?: string;
    hoursAgo?: string;
    storiesJson?: string;
    startIndex?: string;
    groupsJson?: string;
    groupIndex?: string;
  }>();

  const me = useAppSelector((s: any) => s.auth?.user);
  const myId = me?.userId || me?._id || "";

  const fallbackStories: StoryItem[] = useMemo(() => {
    try {
      const parsed = JSON.parse(String(storiesJson || "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [storiesJson]);

  const allGroups: StoryGroup[] = useMemo(() => {
    try {
      const parsed = JSON.parse(String(groupsJson || "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [groupsJson]);

  const initialGroupIndex = Math.max(0, Number(groupIndex || 0));
  const initialStoryIndex = Math.max(0, Number(startIndex || 0));

  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [storyReactionSummary, setStoryReactionSummary] = useState<
    { type: string; count: number }[]
  >([]);
  const [myStoryReactionTypes, setMyStoryReactionTypes] = useState<string[]>([]);

  const activeGroup = allGroups[currentGroupIndex] || {
    authorId,
    userName,
    userAvatar,
    stories: fallbackStories,
  };
  const activeStories = activeGroup?.stories || [];
  const current = activeStories[currentStoryIndex];
  const mediaUri = current?.mediaUri || "";
  const mediaType = (current?.mediaType || (mediaUri ? "IMAGE" : "TEXT")).toUpperCase();
  const text = current?.text || "";
  const storyId = current?.id || "";
  const isVideo = mediaType === "VIDEO" || /\.(mp4|mov|mkv|webm)$/i.test(mediaUri || "");
  const musicPreviewUrl = current?.music?.previewUrl || "";
  const isMine =
    !!activeGroup?.authorId && String(activeGroup.authorId) === String(myId);
  const viewerCount = current?.viewCount ?? viewers.length;
  const reactionSummary = useMemo(() => {
    const counts: Record<string, number> = {};

    viewers.forEach((viewer: any) => {
      const reactionTypes = Array.isArray(viewer?.reactionTypes)
        ? viewer.reactionTypes
        : viewer?.reactionType
          ? [viewer.reactionType]
          : [];

      reactionTypes.forEach((type: string) => {
        counts[type] = (counts[type] || 0) + 1;
      });
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [viewers]);
  const storyReactionEntries = isMine
    ? reactionSummary.map(([type, count]) => ({ type, count }))
    : storyReactionSummary;
  const compactReactionSummary = reactionSummary.slice(0, 3);
  const hiddenReactionKinds = Math.max(0, reactionSummary.length - compactReactionSummary.length);
  const compactStoryReactionEntries = storyReactionEntries.slice(0, 4);
  const hiddenStoryReactionKinds = Math.max(
    0,
    storyReactionEntries.length - compactStoryReactionEntries.length,
  );

  useEffect(() => {
    setStoryReactionSummary(Array.isArray(current?.reactionSummary) ? current.reactionSummary : []);
    setMyStoryReactionTypes(Array.isArray(current?.myReactionTypes) ? current.myReactionTypes : []);
  }, [current?.id, current?.reactionSummary, current?.myReactionTypes]);

  useEffect(() => {
    if (!storyId || isMine) return;
    markStoryViewed(storyId).catch(() => undefined);
  }, [storyId, isMine]);

  useEffect(() => {
    if (!storyId || !isMine) return;
    getStoryViewers(storyId)
      .then((res: any) => setViewers(res?.data || []))
      .catch(() => setViewers([]));
  }, [storyId, isMine]);

  const goNext = useCallback(() => {
    setProgress(0);
    if (currentStoryIndex < activeStories.length - 1) {
      setCurrentStoryIndex((value) => value + 1);
      return;
    }
    if (currentGroupIndex < allGroups.length - 1) {
      setCurrentGroupIndex((value) => value + 1);
      setCurrentStoryIndex(0);
      return;
    }
    router.back();
  }, [activeStories.length, allGroups.length, currentGroupIndex, currentStoryIndex, router]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((value) => value - 1);
      return;
    }
    if (currentGroupIndex > 0) {
      const prevGroupIndex = currentGroupIndex - 1;
      const prevStories = allGroups[prevGroupIndex]?.stories || [];
      setCurrentGroupIndex(prevGroupIndex);
      setCurrentStoryIndex(Math.max(0, prevStories.length - 1));
    }
  }, [allGroups, currentGroupIndex, currentStoryIndex]);

  useEffect(() => {
    setProgress(0);
    if (!current || isVideo) return;

    const durationMs =
      mediaType === "TEXT" || !mediaUri
        ? TEXT_STORY_DURATION_MS
        : IMAGE_STORY_DURATION_MS;
    const start = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min((Date.now() - start) / durationMs, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(timer);
        goNext();
      }
    }, 60);
    return () => clearInterval(timer);
  }, [current, currentGroupIndex, currentStoryIndex, goNext, isVideo, mediaType, mediaUri]);

  useEffect(() => {
    if (!current || !isVideo) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min((Date.now() - start) / VIDEO_FALLBACK_DURATION_MS, 1);
      setProgress((prev) => (prev > 0 ? prev : pct));
      if (pct >= 1) {
        clearInterval(timer);
        goNext();
      }
    }, 120);
    return () => clearInterval(timer);
  }, [current, currentGroupIndex, currentStoryIndex, goNext, isVideo]);

  useEffect(() => {
    const run = async () => {
      if (!musicPreviewUrl || muted) {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        return;
      }
      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        const { sound } = await Audio.Sound.createAsync(
          { uri: musicPreviewUrl },
          { shouldPlay: true, isLooping: true, volume: 1 },
        );
        soundRef.current = sound;
      } catch {
        // no-op
      }
    };
    run();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [musicPreviewUrl, muted, currentGroupIndex, currentStoryIndex]);

  const handleDelete = () => {
    if (!storyId || deleting) return;
    Alert.alert("Xóa story", "Bạn có chắc chắn muốn xóa story này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await deleteStory(storyId);
            goNext();
          } catch (error: any) {
            Alert.alert("Lỗi", error?.response?.data?.message || "Không thể xóa story.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const openViewers = async () => {
    if (!storyId || !isMine) return;
    try {
      const res: any = await getStoryViewers(storyId);
      setViewers(res?.data || []);
      setViewerOpen(true);
    } catch {
      Alert.alert("Lỗi", "Không tải được danh sách người đã xem.");
    }
  };

  const handleReply = async () => {
    if (!storyId || !message.trim() || sending) return;
    try {
      setSending(true);
      const res: any = await replyStory(storyId, message.trim());
      setMessage("");
      const conversationId = res?.data?.conversationId || res?.conversationId;
      if (conversationId) {
        await conversationService.getMyConversations().catch(() => undefined);
      }
      Alert.alert("Thành công", "Tin nhắn đã được gửi vào chat.");
    } catch (error: any) {
      Alert.alert("Lỗi", error?.response?.data?.message || "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (type: "HEART" | "LIKE" | "HAHA" | "WOW" | "SAD") => {
    if (!storyId) return;
    try {
      await reactStory(storyId, type);
      setMyStoryReactionTypes((prev) =>
        prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
      );
      setStoryReactionSummary((prev) => {
        const existing = prev.find((item) => item.type === type);
        const hasType = myStoryReactionTypes.includes(type);

        if (!existing) {
          return [...prev, { type, count: 1 }];
        }

        const next = prev
          .map((item) =>
            item.type === type
              ? { ...item, count: Math.max(0, item.count + (hasType ? -1 : 1)) }
              : item,
          )
          .filter((item) => item.count > 0)
          .sort((a, b) => b.count - a.count);

        return next;
      });
      const id = reactionSeedRef.current++;
      const translateY = new Animated.Value(0);
      const opacity = new Animated.Value(1);
      const scale = new Animated.Value(0.72);

      setFloatingReactions((prev) => [
        ...prev,
        {
          id,
          emoji: REACTION_EMOJIS[type] || REACTION_EMOJIS.HEART,
          left: 20 + ((id % 4) * 34),
          translateY,
          opacity,
          scale,
        },
      ]);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -160,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.14,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1320,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setFloatingReactions((prev) => prev.filter((item) => item.id !== id));
      });
    } catch {
      Alert.alert("Lỗi", "Không thể thả cảm xúc.");
    }
  };

  return (
    <Container className="bg-black" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-black">
        <View className="absolute top-12 left-4 right-4 z-20">
          <View className="flex-row gap-1 mb-4">
            {(activeStories.length ? activeStories : [current]).map((_, idx) => (
              <View key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <View
                  className="h-full bg-white"
                  style={{
                    width:
                      idx < currentStoryIndex
                        ? "100%"
                        : idx > currentStoryIndex
                          ? "0%"
                          : `${Math.max(0, Math.min(1, progress)) * 100}%`,
                  }}
                />
              </View>
            ))}
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Image
                source={{
                  uri:
                    activeGroup?.userAvatar ||
                    userAvatar ||
                    "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
                }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
              <Text className="text-white text-[18px] font-semibold ml-3">
                {activeGroup?.userName || userName}
              </Text>
              <Text className="text-white/70 text-[16px] ml-2">{hoursAgo}</Text>
            </View>
            <View className="flex-row items-center">
              {isMine ? (
                <>
                  <Pressable onPress={openViewers} className="mr-3">
                    <Ionicons name="eye-outline" size={22} color="white" />
                  </Pressable>
                  <Pressable onPress={handleDelete} className="mr-3">
                    <Ionicons name="trash-outline" size={22} color="white" />
                  </Pressable>
                </>
              ) : null}
              <Pressable onPress={() => router.back()} className="ml-3">
                <Ionicons name="close" size={34} color="white" />
              </Pressable>
            </View>
          </View>
        </View>

        <View className="absolute top-40 left-4 z-20">
          <Pressable
            onPress={() => setMuted((value) => !value)}
            className="w-14 h-14 rounded-full border border-white/40 items-center justify-center"
          >
            <Ionicons
              name={muted ? "volume-mute-outline" : "volume-high-outline"}
              size={28}
              color="white"
            />
          </Pressable>
        </View>

        {isVideo && mediaUri ? (
          <Video
            source={{ uri: mediaUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isMuted={muted}
            onPlaybackStatusUpdate={(status: any) => {
              if (!status?.isLoaded) return;
              const duration = status.durationMillis || 0;
              const position = status.positionMillis || 0;
              if (duration > 0) setProgress(Math.min(position / duration, 1));
              if (status.didJustFinish) goNext();
            }}
          />
        ) : mediaUri ? (
          <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
        ) : (
          <View className="flex-1 items-center justify-center px-8 bg-[#1f2937]">
            <Text className="text-white text-[28px] text-center">{text || "Story chữ"}</Text>
          </View>
        )}

        <View className="absolute inset-0 z-10 flex-row">
          <Pressable className="flex-1" onPress={goPrev} />
          <Pressable className="flex-1" onPress={goNext} />
        </View>

        {!isMine && floatingReactions.map((item) => (
          <Animated.View
            key={item.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: item.left,
              bottom: 96,
              zIndex: 30,
              opacity: item.opacity,
              transform: [{ translateY: item.translateY }, { scale: item.scale }],
            }}
          >
            <Text style={{ fontSize: 34 }}>{item.emoji}</Text>
          </Animated.View>
        ))}

        {isMine ? (
          <Pressable
            onPress={openViewers}
            className="absolute bottom-4 left-3 right-3 z-20 rounded-[24px] bg-black/45 px-4 py-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="eye-outline" size={20} color="white" />
                <Text className="text-white text-[18px] font-semibold ml-2">
                  {viewerCount} người xem
                </Text>
              </View>
              <Ionicons name="chevron-up" size={18} color="white" />
            </View>
            {compactReactionSummary.length > 0 ? (
              <View className="flex-row items-center flex-wrap mt-3">
                {compactReactionSummary.map(([type, count]) => (
                  <View
                    key={type}
                    className="mr-2 mb-2 px-3 py-1 rounded-full bg-white/15"
                  >
                    <Text className="text-white text-[13px] font-medium">
                      {(REACTION_EMOJIS[type] || REACTION_EMOJIS.HEART)} {count}
                    </Text>
                  </View>
                ))}
                {hiddenReactionKinds > 0 ? (
                  <View className="mb-2 px-3 py-1 rounded-full bg-white/10">
                    <Text className="text-white text-[13px] font-medium">
                      +{hiddenReactionKinds}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View className="absolute bottom-4 left-3 right-3 z-20">
            {compactStoryReactionEntries.length > 0 ? (
              <View className="flex-row items-center flex-wrap mb-3">
                {compactStoryReactionEntries.map((entry) => (
                  <View
                    key={entry.type}
                    className="mr-2 mb-2 px-3 py-1 rounded-full bg-black/40"
                  >
                    <Text className="text-white text-[13px] font-medium">
                      {(REACTION_EMOJIS[entry.type] || REACTION_EMOJIS.HEART)} {entry.count}
                    </Text>
                  </View>
                ))}
                {hiddenStoryReactionKinds > 0 ? (
                  <View className="mb-2 px-3 py-1 rounded-full bg-black/30">
                    <Text className="text-white text-[13px] font-medium">
                      +{hiddenStoryReactionKinds}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <View className="flex-row items-center">
              <View className="flex-1 mr-3 rounded-full bg-white/25 px-4 py-2 flex-row items-center">
                <TextInput
                  placeholder="Gửi tin nhắn..."
                  placeholderTextColor="#e5e7eb"
                  style={{ color: "white", fontSize: 18, flex: 1 }}
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={handleReply}
                />
                <Pressable onPress={handleReply} className="ml-2">
                  <Ionicons name="send" size={20} color="white" />
                </Pressable>
              </View>
              <Pressable onPress={() => handleReact("HEART")}>
                <Text className="text-[30px] mr-2">{REACTION_EMOJIS.HEART}</Text>
              </Pressable>
              <Pressable onPress={() => handleReact("LIKE")}>
                <Text className="text-[30px] mr-2">{REACTION_EMOJIS.LIKE}</Text>
              </Pressable>
              <Pressable onPress={() => handleReact("HAHA")}>
                <Text className="text-[30px] mr-2">{REACTION_EMOJIS.HAHA}</Text>
              </Pressable>
              <Pressable onPress={() => handleReact("WOW")}>
                <Text className="text-[30px]">{REACTION_EMOJIS.WOW}</Text>
              </Pressable>
              <Pressable onPress={() => handleReact("SAD")}>
                <Text className="text-[30px]">{REACTION_EMOJIS.SAD}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Modal visible={viewerOpen} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-4 max-h-[70%]">
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-[20px] font-semibold">Người đã xem</Text>
                  <Text className="text-[13px] text-[#6b7280] mt-1">
                    Danh sách người xem và cảm xúc của họ
                  </Text>
                  {compactReactionSummary.length > 0 ? (
                    <View className="flex-row items-center flex-wrap mt-3">
                      {compactReactionSummary.map(([type, count]) => (
                        <View
                          key={type}
                          className="mr-2 mb-2 px-3 py-1.5 rounded-full bg-[#eff6ff]"
                        >
                          <Text className="text-[#1d4ed8] text-[13px] font-semibold">
                            {(REACTION_EMOJIS[type] || REACTION_EMOJIS.HEART)} {count}
                          </Text>
                        </View>
                      ))}
                      {hiddenReactionKinds > 0 ? (
                        <View className="mb-2 px-3 py-1.5 rounded-full bg-[#f3f4f6]">
                          <Text className="text-[#6b7280] text-[13px] font-semibold">
                            +{hiddenReactionKinds}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Pressable onPress={() => setViewerOpen(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </Pressable>
              </View>
              <ScrollView>
                {viewers.length === 0 ? (
                  <Text className="text-[#6b7280] py-4">Chưa có ai xem.</Text>
                ) : (
                  viewers.map((viewer: any) => (
                    <View key={viewer.userId} className="flex-row items-center justify-between py-3">
                      <View className="flex-row items-center flex-1">
                        <Image
                          source={{
                            uri:
                              viewer.avatar ||
                              "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
                          }}
                          style={{ width: 42, height: 42, borderRadius: 21 }}
                        />
                        <Text className="text-[16px] font-medium ml-3 flex-1">
                          {viewer.name}
                        </Text>
                      </View>
                      {Array.isArray(viewer.reactionTypes) && viewer.reactionTypes.length > 0 ? (
                        <View className="flex-row items-center flex-wrap justify-end max-w-[120px]">
                          {viewer.reactionTypes.slice(0, 3).map((type: string, index: number) => (
                            <View
                              key={`${viewer.userId}-${type}-${index}`}
                              className="px-2 py-1 rounded-full bg-[#fff1f2] ml-1 mb-1"
                            >
                              <Text className="text-[18px]">
                                {REACTION_EMOJIS[type] || REACTION_EMOJIS.HEART}
                              </Text>
                            </View>
                          ))}
                          {viewer.reactionTypes.length > 3 ? (
                            <View className="px-2 py-1 rounded-full bg-[#f3f4f6] ml-1 mb-1">
                              <Text className="text-[12px] text-[#6b7280] font-semibold">
                                +{viewer.reactionTypes.length - 3}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : viewer.reactionType ? (
                        <View className="px-3 py-1.5 rounded-full bg-[#fff1f2]">
                          <Text className="text-[22px]">
                            {REACTION_EMOJIS[viewer.reactionType] || REACTION_EMOJIS.HEART}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-[13px] text-[#9ca3af]">Đã xem</Text>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Container>
  );
}

