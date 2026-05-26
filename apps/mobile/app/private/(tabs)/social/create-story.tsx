import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import Container from "@/components/common/Container";
import { userService } from "@/services/user.service";
import { createStory, musicService } from "@/services/social.service";

type StoryMode = "text" | "image" | "video" | "loop";
type PrivacyMode = "friends" | "include" | "exclude" | "private";
type Friend = { id: string; name: string; avatar?: string };

const SAMPLE_THUMBS = [
  "https://images.unsplash.com/photo-1560343090-f0409e92791a",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455",
  "https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
  "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9",
];

export default function CreateStoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [assetUri, setAssetUri] = useState<string>();
  const [activeMode, setActiveMode] = useState<StoryMode>("image");
  const [showTools, setShowTools] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("friends");
  const [friendPickerMode, setFriendPickerMode] = useState<"include" | "exclude">("include");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [includedFriendIds, setIncludedFriendIds] = useState<Set<string>>(new Set());
  const [excludedFriendIds, setExcludedFriendIds] = useState<Set<string>>(new Set());
  const [textStory, setTextStory] = useState("");
  const [posting, setPosting] = useState(false);
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [musicKeyword, setMusicKeyword] = useState("");
  const [musicList, setMusicList] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<any | null>(null);

  const filteredFriends = useMemo(() => {
    const q = friendQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.name.toLowerCase().includes(q));
  }, [friends, friendQuery]);

  useEffect(() => {
    let mounted = true;
    const loadFriends = async () => {
      try {
        const res: any = await userService.getListFriends();
        const users = res?.users ?? res?.data?.users ?? [];
        const mapped: Friend[] = users.flatMap((group: any) =>
          (group.friends || []).map((f: any) => ({
            id: f.friendId,
            name: f.name || "Người dùng",
            avatar: f.avatarUrl,
          })),
        );
        if (mounted) setFriends(mapped);
      } catch {
        if (mounted) setFriends([]);
      }
    };
    loadFriends();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res: any = await musicService.searchMusic(musicKeyword || "");
        const tracks = res?.data || [];
        const normalized = Array.isArray(tracks)
          ? tracks.map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              thumbnail: t.thumbnail || t.image || "",
              previewUrl: t.previewUrl || "",
            }))
          : [];
        if (mounted) setMusicList(normalized);
      } catch {
        if (mounted) setMusicList([]);
      }
    };
    if (showMusicSheet) run();
    return () => {
      mounted = false;
    };
  }, [musicKeyword, showMusicSheet]);

  const pickMedia = async (pickMode: "image" | "video") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Thiếu quyền", "Vui lòng cấp quyền thư viện.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        pickMode === "video"
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return;
    setAssetUri(result.assets[0].uri);
    setActiveMode(pickMode);
  };

  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        setAssetUri(photo.uri);
        setActiveMode("image");
      }
    } catch {
      Alert.alert("Lỗi", "Không thể chụp ảnh.");
    }
  };

  const saveToDevice = async () => {
    if (!assetUri) {
      Alert.alert("Thông báo", "Chưa có ảnh/video để tải về.");
      return;
    }
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Vui lòng cấp quyền lưu vào thư viện.");
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(assetUri);
      Alert.alert("Thành công", "Đã lưu vào thư viện.");
    } catch {
      Alert.alert("Lỗi", "Không thể lưu ảnh/video.");
    }
  };

  const toggleFriend = (id: string) => {
    if (friendPickerMode === "include") {
      setIncludedFriendIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    setExcludedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePost = async () => {
    if (!assetUri && activeMode !== "text") {
      Alert.alert("Thiếu nội dung", "Vui lòng chụp/chọn ảnh hoặc video trước khi đăng.");
      return;
    }

    try {
      setPosting(true);
      const formData = new FormData();
      formData.append("privacyMode", privacyMode);
      formData.append("includeUserIds", JSON.stringify(Array.from(includedFriendIds)));
      formData.append("excludeUserIds", JSON.stringify(Array.from(excludedFriendIds)));

      if (selectedMusic) {
        formData.append(
          "music",
          JSON.stringify({
            title: selectedMusic.title,
            artist: selectedMusic.artist,
            previewUrl: selectedMusic.previewUrl,
            thumbnail: selectedMusic.thumbnail,
          }),
        );
      }

      if (activeMode === "text") {
        formData.append("text", textStory || "Khoảnh khắc mới");
      }

      if (assetUri) {
        const name = assetUri.split("/").pop() || `story-${Date.now()}.jpg`;
        const lower = name.toLowerCase();
        const isVideo =
          activeMode === "video" ||
          lower.endsWith(".mp4") ||
          lower.endsWith(".mov") ||
          lower.endsWith(".mkv");

        formData.append("files", {
          uri: assetUri,
          name,
          type: isVideo ? "video/mp4" : "image/jpeg",
        } as any);
      }

      await createStory(formData);
      Alert.alert("Thành công", "Đăng story thành công.");
      router.back();
    } catch (error: any) {
      Alert.alert("Lỗi", error?.response?.data?.message || "Không thể đăng story.");
    } finally {
      setPosting(false);
    }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: "black" }} />;
  if (!permission.granted) {
    return (
      <Container className="bg-black" edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-4 text-center text-[16px] text-white">Cần quyền camera để tạo story</Text>
          <Pressable onPress={requestPermission} className="rounded-full bg-[#0ea5e9] px-5 py-3">
            <Text className="font-semibold text-white">Cấp quyền camera</Text>
          </Pressable>
        </View>
      </Container>
    );
  }

  return (
    <Container className="bg-black" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-black">
        {activeMode === "text" ? (
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8" }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : assetUri ? (
          <Image source={{ uri: assetUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <CameraView ref={cameraRef} facing={facing} style={{ width: "100%", height: "100%" }} />
        )}

        <View className="absolute inset-0 bg-black/10" />

        <View className="absolute left-5 right-5 top-14 flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={36} color="white" />
          </Pressable>
          <View className="h-3 w-3 rounded-full bg-[#22c55e]" />
        </View>

        <Pressable
          onPress={() => setShowMusicSheet(true)}
          className="absolute top-24 self-center rounded-full bg-black/60 px-5 py-2.5"
        >
          <View className="flex-row items-center">
            <Ionicons name="musical-notes-outline" size={18} color="white" />
            <Text className="ml-2 text-[16px] text-white">
              {selectedMusic?.title ? selectedMusic.title : "Thêm nhạc"}
            </Text>
          </View>
        </Pressable>

        <View className="absolute right-4 top-24">
          <Pressable
            className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-black/45"
            onPress={() => setShowTools((v) => !v)}
          >
            <Text className="text-[28px] font-bold text-white">Aa</Text>
          </Pressable>
          {showTools ? (
            <>
              {["Sticker", "Cắt ảnh", "Hiệu ứng", "Hình vẽ", "Vị trí"].map((label) => (
                <View key={label} className="mb-2 flex-row items-center justify-end">
                  <Text className="mr-3 text-[20px] text-white">{label}</Text>
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-black/45">
                    <Ionicons name="ellipse-outline" size={20} color="white" />
                  </View>
                </View>
              ))}
              <Pressable
                className="self-end h-14 w-14 items-center justify-center rounded-full bg-black/45"
                onPress={() => setShowTools(false)}
              >
                <Ionicons name="chevron-up" size={28} color="white" />
              </Pressable>
            </>
          ) : null}
        </View>

        {activeMode === "text" ? (
          <View className="absolute inset-x-0 top-[300px] items-center px-10">
            <TextInput
              placeholder="Bạn đang nghĩ gì?"
              placeholderTextColor="#d4d4d4"
              value={textStory}
              onChangeText={setTextStory}
              className="w-full text-center text-[32px] text-white"
            />
          </View>
        ) : (
          <View className="absolute bottom-44 left-0 right-0">
            <View className="mb-3 items-center">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-black/55">
                <Ionicons name="chevron-down" size={28} color="white" />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14 }}>
              {SAMPLE_THUMBS.map((uri, idx) => (
                <Pressable key={`${uri}-${idx}`} onPress={() => setAssetUri(uri)} className="mr-2">
                  <Image
                    source={{ uri }}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 10,
                      borderWidth: assetUri === uri ? 2 : 0,
                      borderColor: "#fff",
                    }}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="absolute bottom-20 left-0 right-0 px-8">
          <View className="flex-row items-center justify-between">
            <View className="items-center">
              <Pressable onPress={() => setShowPrivacySheet(true)} className="h-14 w-14 items-center justify-center rounded-xl bg-white/75">
                <Ionicons name="people-outline" size={24} color="#1f2937" />
              </Pressable>
              <Text className="mt-1 text-[13px] text-white">Quyền xem</Text>
            </View>

            <Pressable
              onPress={activeMode === "text" ? handlePost : capturePhoto}
              className={`h-28 w-28 items-center justify-center rounded-full border-[6px] border-white/90 ${activeMode === "loop" ? "bg-pink-500/80" : ""}`}
            >
              <View className={`h-[84px] w-[84px] items-center justify-center rounded-full ${activeMode === "loop" ? "bg-pink-500" : "bg-white/95"}`}>
                {activeMode === "loop" ? <Ionicons name="infinite" size={42} color="white" /> : null}
              </View>
            </Pressable>

            <View className="items-center">
              <Pressable onPress={() => setFacing((prev) => (prev === "back" ? "front" : "back"))} className="h-14 w-14 items-center justify-center rounded-2xl bg-white/80">
                <Ionicons name="camera-reverse-outline" size={28} color="#334155" />
              </Pressable>
              <Pressable disabled={posting} onPress={handlePost} className="mt-2 rounded-full bg-[#0f82ff] px-5 py-2">
                <Text className="text-[18px] font-semibold text-white">{posting ? "Đang đăng..." : "Đăng"}</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-3 flex-row items-center">
            <Pressable onPress={saveToDevice} className="mr-5 flex-row items-center">
              <MaterialIcons name="download" size={20} color="white" />
              <Text className="ml-1 text-white">Tải về</Text>
            </Pressable>
            <Pressable onPress={() => pickMedia("image")} className="flex-row items-center">
              <Ionicons name="images-outline" size={20} color="white" />
              <Text className="ml-1 text-white">Thư viện</Text>
            </Pressable>
          </View>
        </View>

        <View className="absolute bottom-6 left-0 right-0 items-center">
          <View className="flex-row items-center">
            {[
              { key: "text", label: "CHỮ" },
              { key: "image", label: "ẢNH" },
              { key: "video", label: "VIDEO" },
              { key: "loop", label: "LOOP" },
            ].map((m) => (
              <Pressable
                key={m.key}
                onPress={() => {
                  if (m.key === "video") {
                    pickMedia("video");
                    setActiveMode("video");
                  } else {
                    setActiveMode(m.key as StoryMode);
                  }
                }}
                className="mx-5"
              >
                <Text className={`text-[16px] ${activeMode === m.key ? "font-semibold text-white" : "text-white/50"}`}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Modal visible={showPrivacySheet} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View
              className="max-h-[82%] rounded-t-3xl bg-white p-5"
              style={{ paddingBottom: 32 + insets.bottom }}
            >
              <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-[#d1d5db]" />
              <Text className="mb-4 text-[24px] font-semibold">Ai được xem khoảnh khắc này?</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable onPress={() => setPrivacyMode("friends")} className="border-b border-[#f3f4f6] py-4">
                  <Text className="text-[20px]">Bạn bè Zalo</Text>
                  <Text className="text-[16px] text-[#6b7280]">Trừ bạn bè đã bị chặn xem</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPrivacyMode("include");
                    setFriendPickerMode("include");
                    setShowFriendPicker(true);
                  }}
                  className="flex-row items-center justify-between border-b border-[#f3f4f6] py-4"
                >
                  <View>
                    <Text className="text-[20px]">Một số bạn bè</Text>
                    <Text className="text-[16px] text-[#6b7280]">
                      {includedFriendIds.size > 0 ? `Đã chọn ${includedFriendIds.size} bạn` : "Chọn bạn bè được xem"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPrivacyMode("exclude");
                    setFriendPickerMode("exclude");
                    setShowFriendPicker(true);
                  }}
                  className="flex-row items-center justify-between border-b border-[#f3f4f6] py-4"
                >
                  <View>
                    <Text className="text-[20px]">Bạn bè ngoại trừ...</Text>
                    <Text className="text-[16px] text-[#6b7280]">
                      {excludedFriendIds.size > 0 ? `Đã loại trừ ${excludedFriendIds.size} bạn` : "Chọn bạn bè không được xem"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </Pressable>
                <Pressable onPress={() => setPrivacyMode("private")} className="border-b border-[#f3f4f6] py-4">
                  <Text className="text-[20px]">Chỉ mình tôi</Text>
                  <Text className="text-[16px] text-[#6b7280]">Chỉ bạn mới xem được tin này</Text>
                </Pressable>
              </ScrollView>
              <Pressable onPress={() => setShowPrivacySheet(false)} className="mt-4 items-center rounded-full bg-[#0f82ff] py-3">
                <Text className="text-[18px] font-semibold text-white">Xong</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showFriendPicker} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View
              className="h-[75%] rounded-t-3xl bg-white px-4 pt-4"
              style={{ paddingBottom: 16 + insets.bottom }}
            >
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[20px] font-semibold">
                  {friendPickerMode === "include" ? "Chọn bạn bè được xem" : "Chọn bạn bè không được xem"}
                </Text>
                <Pressable onPress={() => setShowFriendPicker(false)}>
                  <Ionicons name="close" size={26} color="#111827" />
                </Pressable>
              </View>
              <View className="mb-3 rounded-full bg-[#f3f4f6] px-4 py-2">
                <TextInput placeholder="Tìm bạn bè..." value={friendQuery} onChangeText={setFriendQuery} />
              </View>
              <ScrollView>
                {filteredFriends.map((f) => {
                  const checked = friendPickerMode === "include" ? includedFriendIds.has(f.id) : excludedFriendIds.has(f.id);
                  return (
                    <Pressable key={f.id} onPress={() => toggleFriend(f.id)} className="flex-row items-center border-b border-[#f3f4f6] py-3">
                      <Image
                        source={{ uri: f.avatar || "https://images.unsplash.com/photo-1544005313-94ddf0286df2" }}
                        style={{ width: 38, height: 38, borderRadius: 19 }}
                      />
                      <Text className="ml-3 flex-1 text-[17px]">{f.name}</Text>
                      <View className={`h-6 w-6 rounded-full border ${checked ? "border-[#0f82ff] bg-[#0f82ff]" : "border-[#cbd5e1]"}`} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable onPress={() => setShowFriendPicker(false)} className="mt-3 items-center rounded-full bg-[#0f82ff] py-3">
                <Text className="text-[18px] font-semibold text-white">Lưu lựa chọn</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showMusicSheet} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View
              className="h-[75%] rounded-t-3xl bg-white px-4 pt-4"
              style={{ paddingBottom: 16 + insets.bottom }}
            >
              <View className="mb-3 h-1.5 w-14 self-center rounded-full bg-[#d1d5db]" />
              <View className="mb-3 rounded-full bg-[#f3f4f6] px-4 py-2">
                <TextInput placeholder="Tìm bài hát hoặc nghệ sĩ" value={musicKeyword} onChangeText={setMusicKeyword} />
              </View>
              <ScrollView>
                {musicList.map((m) => (
                  <View key={m.id} className="flex-row items-center border-b border-[#f3f4f6] py-3">
                    <Image source={{ uri: m.thumbnail }} style={{ width: 48, height: 48, borderRadius: 10 }} />
                    <View className="ml-3 flex-1">
                      <Text className="text-[18px]" numberOfLines={1}>{m.title}</Text>
                      <Text className="text-[14px] text-[#6b7280]" numberOfLines={1}>{m.artist}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setSelectedMusic(m);
                        setShowMusicSheet(false);
                      }}
                      className="rounded-full bg-[#e0f2fe] px-4 py-2"
                    >
                      <Text className="font-semibold text-[#0ea5e9]">CHỌN</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <Pressable onPress={() => setShowMusicSheet(false)} className="mt-3 items-center rounded-full bg-[#0f82ff] py-3">
                <Text className="text-[18px] font-semibold text-white">Đóng</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Container>
  );
}
