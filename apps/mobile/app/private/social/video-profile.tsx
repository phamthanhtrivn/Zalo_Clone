import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  followVideoCreator,
  getVideoProfile,
  unfollowVideoCreator,
} from "@/services/social.service";

const formatCompactNumber = (value: number) => {
  if (!value) return "0";
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000)
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
};

export default function VideoProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res: any = await getVideoProfile(
        typeof userId === "string" ? userId : undefined,
      );
      setProfile(res?.data || null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const videos = useMemo(() => profile?.videos || [], [profile]);
  const stats = profile?.stats || {
    videoCount: 0,
    followerCount: 0,
    totalLikes: 0,
  };
  const meta = profile?.meta || {
    isOwner: true,
    isFriend: false,
    isFollowing: false,
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleOpenUpload = () => {
    router.push("/private/social/video-upload");
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Xem trang video của ${profile?.profile?.name || "tôi"} trên Zalo Clone`,
      });
    } catch {
      // ignore native share cancel
    }
  };

  const handlePlaceholderAction = (label: string) => {
    Alert.alert("Thông báo", `${label} sẽ được hoàn thiện ở bước tiếp theo.`);
  };

  const handleToggleFollow = async () => {
    const targetUserId = profile?.profile?.userId;
    if (!targetUserId || meta.isOwner || followLoading) return;

    try {
      setFollowLoading(true);
      const res: any = meta.isFollowing
        ? await unfollowVideoCreator(targetUserId)
        : await followVideoCreator(targetUserId);
      const payload = res?.data ?? res;
      setProfile((prev: any) =>
        prev
          ? {
            ...prev,
            meta: {
              ...prev.meta,
              isFollowing: payload?.isFollowing ?? !prev.meta?.isFollowing,
            },
            stats: {
              ...prev.stats,
              followerCount:
                payload?.followerCount ?? prev.stats?.followerCount ?? 0,
            },
          }
          : prev,
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenVideo = (videoId: string) => {
    router.push({
      pathname: "/private/social/video-feed",
      params: {
        initialVideoId: videoId,
        category: "cho-ban",
        authorId: profile?.profile?.userId,
      },
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#090909" }}
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </Pressable>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full">
          <Ionicons name="ellipsis-horizontal" size={24} color="white" />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1d9bf0" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#1d9bf0"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pb-12 pt-4">
            <View className="flex-row items-start">
              <Image
                source={{
                  uri:
                    profile?.profile?.avatar ||
                    "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=400&auto=format&fit=crop",
                }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 18,
                  backgroundColor: "#222",
                }}
              />
              <View className="ml-6 flex-1 flex-row justify-between pt-2">
                <View className="items-center">
                  <Text className="text-[22px] font-bold text-white">
                    {formatCompactNumber(stats.videoCount)}
                  </Text>
                  <Text className="mt-1 text-[15px] text-[#8b8b8b]">Video</Text>
                </View>
                <View className="items-center">
                  <Text className="text-[22px] font-bold text-white">
                    {formatCompactNumber(stats.followerCount)}
                  </Text>
                  <Text className="mt-1 text-[15px] text-[#8b8b8b]">
                    Theo dõi
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-[22px] font-bold text-white">
                    {formatCompactNumber(stats.totalLikes)}
                  </Text>
                  <Text className="mt-1 text-[15px] text-[#8b8b8b]">
                    Lượt thích
                  </Text>
                </View>
              </View>
            </View>

            <Text className="mt-6 text-[18px] font-bold text-white">
              {profile?.profile?.name || "Người dùng Zalo"}
            </Text>

            {meta.isOwner ? (
              <>
                <View className="mt-5 flex-row gap-3">
                  <Pressable
                    onPress={() =>
                      handlePlaceholderAction("Thêm số liên hệ Zalo")
                    }
                    className="flex-1 flex-row items-center justify-center rounded-full border border-[#404040] px-4 py-3"
                  >
                    <Ionicons name="add" size={20} color="#d4d4d4" />
                    <Text className="ml-2 text-[15px] font-medium text-[#d4d4d4]">
                      Thêm số liên hệ Zalo
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handlePlaceholderAction("Thêm trang thông tin")
                    }
                    className="flex-1 flex-row items-center justify-center rounded-full border border-[#404040] px-4 py-3"
                  >
                    <Ionicons name="add" size={20} color="#d4d4d4" />
                    <Text className="ml-2 text-[15px] font-medium text-[#d4d4d4]">
                      Thêm trang thông tin
                    </Text>
                  </Pressable>
                </View>

                <View className="mt-5 flex-row gap-3">
                  <Pressable
                    onPress={handleOpenUpload}
                    className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#2c2c2c] px-4 py-4"
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={22}
                      color="#d4d4d4"
                    />
                    <Text className="ml-3 text-[17px] font-semibold text-[#d4d4d4]">
                      Đăng video
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleShareProfile}
                    className="h-[56px] w-[56px] items-center justify-center rounded-2xl bg-[#2c2c2c]"
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={24}
                      color="#d4d4d4"
                    />
                  </Pressable>
                </View>
              </>
            ) : (
              <View className="mt-5 flex-row gap-3">
                <Pressable
                  onPress={handleToggleFollow}
                  disabled={followLoading}
                  className={`flex-1 items-center justify-center rounded-2xl px-4 py-4 ${meta.isFollowing ? "bg-[#2c2c2c]" : "bg-[#1677ff]"}`}
                >
                  <Text className="text-[17px] font-semibold text-white">
                    {followLoading
                      ? "Đang xử lý..."
                      : meta.isFollowing
                        ? "Đang theo dõi"
                        : "Theo dõi"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleShareProfile}
                  className="h-[56px] w-[56px] items-center justify-center rounded-2xl bg-[#2c2c2c]"
                >
                  <Ionicons
                    name="share-social-outline"
                    size={24}
                    color="#d4d4d4"
                  />
                </Pressable>
              </View>
            )}

            {videos.length === 0 ? (
              <View className="items-center justify-center pb-20 pt-40">
                <Text className="text-[20px] font-bold text-[#f5f5f5]">
                  Chưa có video nào
                </Text>
                <Text className="mt-3 text-center text-[16px] text-[#777]">
                  {meta.isOwner
                    ? "Đăng video cho mọi người cùng xem"
                    : "Người dùng này chưa có video công khai để hiển thị"}
                </Text>
                {meta.isOwner ? (
                  <Pressable
                    onPress={handleOpenUpload}
                    className="mt-7 rounded-2xl bg-[#1677ff] px-8 py-4"
                  >
                    <Text className="text-[18px] font-semibold text-white">
                      Đăng video
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View className="mt-8 flex-row flex-wrap justify-between">
                {videos.map((item: any, index: number) => (
                  <Pressable
                    key={item.id || index}
                    onPress={() => handleOpenVideo(item.id)}
                    className="mb-3 w-[32%] overflow-hidden rounded-2xl bg-[#181818]"
                  >
                    <Video
                      source={{ uri: item.previewUrl || item.videoUrl }}
                      style={{ width: "100%", height: 170 }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      isMuted
                    />
                    <View className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1">
                      <Text className="text-[11px] font-medium text-white">
                        {formatCompactNumber(item.likes || 0)} thích
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
