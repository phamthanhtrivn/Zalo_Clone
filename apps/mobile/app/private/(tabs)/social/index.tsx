import { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Container from "@/components/common/Container";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchDiaryPosts } from "@/store/slices/diaryThunk";
import { useRouter } from "expo-router";
import { getStories } from "@/services/social.service";
import { useSocket } from "@/contexts/SocketContext";

import SocialHeader from "../../../../components/social/SocialHeader";
import FeedTopTabs from "../../../../components/social/FeedTopTabs";
import DiaryContent from "../../../../components/social/DiaryContent";
import VideoScreen from "../../../../components/social/VideoScreen";

type SocialTab = "diary" | "video";
type StoryMode = "camera" | "image" | "video" | "album" | "text";

const pruneExpiredStories = (groups: any[]) => {
  const now = Date.now();
  return (groups || [])
    .map((g) => ({
      ...g,
      stories: (g.stories || []).filter((s: any) => {
        const exp = s?.expiresAt ? new Date(s.expiresAt).getTime() : 0;
        return exp > now;
      }),
    }))
    .filter((g) => (g.stories || []).length > 0);
};

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<SocialTab>("diary");
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const { socket } = useSocket();
  const router = useRouter();

  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const userInfo = useAppSelector((state: any) => state.userInfo?.userInfo);
  const posts = useAppSelector((state: any) => state.diary?.posts ?? []);
  const loading = useAppSelector((state: any) => state.diary?.loading ?? false);

  const avatar =
    userInfo?.profile?.avatarUrl ||
    userInfo?.avatarUrl ||
    user?.profile?.avatarUrl ||
    user?.avatarUrl ||
    null;

  const loadContent = useCallback(async () => {
    if (activeTab === "diary") {
      await dispatch(fetchDiaryPosts());
      try {
        const res: any = await getStories();
        setStories(pruneExpiredStories(res?.data || []));
      } catch {
        setStories([]);
      }
    }
  }, [activeTab, dispatch]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (!socket) return;

    const handleStoryNew = (payload: any) => {
      setStories((prev) => {
        const exp = payload?.story?.expiresAt
          ? new Date(payload.story.expiresAt).getTime()
          : 0;
        if (!exp || exp <= Date.now()) return prev;

        const idx = prev.findIndex((g: any) => g.authorId === payload.authorId);
        if (idx === -1) {
          return pruneExpiredStories([
            {
              authorId: payload.authorId,
              userName: payload.userName,
              userAvatar: payload.userAvatar,
              stories: [payload.story],
            },
            ...prev,
          ]);
        }

        const next = [...prev];
        next[idx] = {
          ...next[idx],
          userName: payload.userName || next[idx].userName,
          userAvatar: payload.userAvatar || next[idx].userAvatar,
          stories: [payload.story, ...(next[idx].stories || [])],
        };
        const updated = next.splice(idx, 1)[0];
        return pruneExpiredStories([updated, ...next]);
      });
    };

    const handleStoryDeleted = (payload: {
      storyId: string;
      authorId: string;
    }) => {
      setStories((prev) => {
        const next = prev
          .map((g: any) =>
            g.authorId !== payload.authorId
              ? g
              : {
                ...g,
                stories: (g.stories || []).filter(
                  (s: any) => String(s.id) !== String(payload.storyId),
                ),
              },
          )
          .filter((g: any) => (g.stories || []).length > 0);
        return pruneExpiredStories(next);
      });
    };

    socket.on("story:new", handleStoryNew);
    socket.on("story:deleted", handleStoryDeleted);
    return () => {
      socket.off("story:new", handleStoryNew);
      socket.off("story:deleted", handleStoryDeleted);
    };
  }, [socket]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStories((prev) => pruneExpiredStories(prev));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContent();
    setRefreshing(false);
  };

  const handleCreatePost = () => {
    router.push("/private/social/create-post");
  };

  const openStoryCamera = () => {
    router.push("/private/story-create");
  };

  const openStoryViewer = (story: {
    id: string;
    authorId: string;
    userName: string;
    userAvatar: string;
    mediaUri?: string;
    text?: string;
    mediaType?: "IMAGE" | "VIDEO" | "TEXT";
    hoursAgo: string;
    storiesJson: string;
    startIndex: number;
    groupsJson: string;
    groupIndex: number;
  }) => {
    router.push({
      pathname: "/private/story-viewer",
      params: story,
    });
  };

  const openStoryCreator = async (mode: StoryMode) => {
    if (mode === "text" || mode === "camera") {
      router.push({
        pathname: "/private/social/create-post",
        params: { mode },
      });
      return;
    }

    try {
      const mediaType =
        mode === "video"
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images;

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Thiếu quyền", "Vui lòng cấp quyền truy cập thư viện.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      router.push({
        pathname: "/private/social/create-post",
        params: {
          mode,
          assetUri: asset.uri,
          assetType: asset.type ?? (mode === "video" ? "video" : "image"),
        },
      });
    } catch {
      Alert.alert("Lỗi", "Không thể mở thư viện.");
    }
  };

  return (
    <Container className="bg-[#eef2f7]">
      <StatusBar style="light" />
      <SocialHeader onCreatePost={handleCreatePost} />
      <FeedTopTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "diary" ? (
        <DiaryContent
          avatar={avatar}
          posts={posts}
          stories={stories}
          loading={loading && !refreshing}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onOpenStoryCreator={openStoryCreator}
          onOpenStoryCamera={openStoryCamera}
          onOpenStoryViewer={openStoryViewer}
        />
      ) : (
        <VideoScreen />
      )}
    </Container>
  );
}
