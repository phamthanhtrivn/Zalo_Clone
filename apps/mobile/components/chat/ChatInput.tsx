import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Alert,
  ScrollView,
  Pressable,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, useAnimatedKeyboard } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { COLORS } from "@/constants/colors";
import CreatePollModal from "./CreatePollModal";
import { moderateScale, scale } from "@/utils/responsive";
import MentionSuggestions from "./MentionSuggestions";
import { useAppSelector } from "@/store/store";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { StickerPickerPanel } from "./StickerPickerPanel";

interface SelectedFile {
  uri: string;
  name: string;
  type: string;
}

interface RecordedVoice {
  uri: string;
  name: string;
  type: string;
  durationMs: number;
}

interface ChatInputProps {
  chatName?: string;
  onSendMessage: (text: string) => void;
  onSendFiles: (files: SelectedFile[]) => void;
  onSendVoiceAudio: (voice: RecordedVoice) => Promise<void> | void;
  onSendSticker?: (iconUrl: string) => void;
  isSelectMode?: boolean;
  selectedMessages?: string[];
  onOpenForwardModal?: () => void;
  onCancelSelect?: () => void;
  isGroup?: boolean;
  conversationId?: string;
  members?: any[];
  disabled?: boolean;
}

const formatVoiceDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const ChatInput: React.FC<ChatInputProps> = ({
  chatName,
  onSendMessage,
  onSendFiles,
  onSendVoiceAudio,
  onSendSticker,
  isSelectMode = false,
  selectedMessages = [],
  onOpenForwardModal,
  onCancelSelect,
  isGroup = false,
  conversationId = "",
  members = [],
  disabled = false,
}) => {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const panelHeight = useSharedValue(300);
  const slideAnim = useSharedValue(0);
  const animatedHeight = useAnimatedStyle(() => {
    return {
      height: slideAnim.value * panelHeight.value,
    };
  });

  const stickerPanelHeight = useSharedValue(320); // Fixed initial height estimation
  const stickerSlideAnim = useSharedValue(0);
  const stickerAnimatedHeight = useAnimatedStyle(() => {
    return {
      height: stickerSlideAnim.value * stickerPanelHeight.value,
    };
  });
  const [text, setText] = useState("");
  const [showPollModal, setShowPollModal] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const handleTextChange = (val: string) => {
    setText(val);
    const lastAtIndex = val.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = val.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
    setMentionQuery("");
  };

  const handleSelectMention = (name: string) => {
    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const beforeAt = text.slice(0, lastAtIndex);
      const newText = `${beforeAt}@${name} `;
      setText(newText);
    }
    setShowMentionList(false);
    setMentionQuery("");
    inputRef.current?.focus();
  };

  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.userId || "";

  // Tạo danh sách những người có thể tag bao gồm con Zola AI và các thành viên khác
  const memberCandidates = isGroup
    ? (members || [])
      .map((m: any) => {
        if (!m) return null;

        // Nếu m.userId là một đối tượng đã được populate
        if (m.userId && typeof m.userId === "object") {
          const u = m.userId;
          if (currentUserId && String(u._id || m.userId) === String(currentUserId)) return null;
          return {
            _id: u._id || m.userId,
            name: u.profile?.name || u.name || "Người dùng",
            avatarUrl: u.profile?.avatarUrl || u.avatarUrl || "",
            isAi: false,
          };
        }

        // Nếu m.userId là một string (kết quả trực tiếp từ API getListMembers)
        const userIdStr = typeof m.userId === "string" ? m.userId : (m._id || "");
        if (currentUserId && String(userIdStr) === String(currentUserId)) return null;
        return {
          _id: userIdStr,
          name: m.name || "Người dùng",
          avatarUrl: m.avatarUrl || "",
          isAi: false,
        };
      })
      .filter(Boolean) as Array<{ _id: string; name: string; avatarUrl: string; isAi: boolean }>
    : [];

  const allCandidates = [
    { _id: "zola_ai", name: "Zola AI", avatarUrl: "", isAi: true },
    ...memberCandidates,
  ];

  const filteredCandidates = allCandidates.filter((c) =>
    c.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"audio" | "text">("audio");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordedVoice, setRecordedVoice] = useState<RecordedVoice | null>(
    null,
  );
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false);

  const [isRecognizingText, setIsRecognizingText] = useState(false);
  const [initialTextForSpeech, setInitialTextForSpeech] = useState("");

  const inputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  useSpeechRecognitionEvent("start", () => setIsRecognizingText(true));
  useSpeechRecognitionEvent("end", () => setIsRecognizingText(false));
  useSpeechRecognitionEvent("error", (event) => {
    if (event.error !== "no-speech") {
      console.warn("Speech recognition error:", event.error, event.message);
    }
    setIsRecognizingText(false);
  });
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript || "";
    if (transcript) {
      setText(initialTextForSpeech + (initialTextForSpeech ? " " : "") + transcript);
    }
  });

  const toggleTextRecording = async () => {
    if (isRecognizingText) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền", "Cần cấp quyền Microphone & Speech để nhận diện giọng nói.");
      return;
    }
    setInitialTextForSpeech(text);
    ExpoSpeechRecognitionModule.start({
      lang: "vi-VN",
      interimResults: true,
      continuous: true,
    });
  };

  const handleSend = () => {
    if (disabled) return;
    if (text.trim()) {
      onSendMessage(text.trim());
      setText("");
    }
    if (selectedFiles.length > 0) {
      onSendFiles(selectedFiles);
      setSelectedFiles([]);
    }
  };

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      closeStickerPanel();
      setShowVoicePanel(false);
    });

    return () => {
      showSub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const handleEmojiSelect = useCallback((emoji: any) => {
    setText((prev) => prev + emoji.emoji);
  }, []);

  const onSendStickerRef = useRef(onSendSticker);
  useEffect(() => {
    onSendStickerRef.current = onSendSticker;
  }, [onSendSticker]);

  const handleStickerSelect = useCallback((url: string) => {
    onSendStickerRef.current?.(url);
    closeStickerPanel();
  }, []);

  const toggleEmoji = () => {
    Keyboard.dismiss();
    setShowVoicePanel(false);
    if (showEmoji) {
      closeStickerPanel();
    } else {
      setShowEmoji(true);
      requestAnimationFrame(() => {
        stickerSlideAnim.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      });
    }
  };

  const closeStickerPanel = () => {
    stickerSlideAnim.value = withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setShowEmoji)(false);
      }
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const pickImages = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Quyền truy cập",
          "Cần quyền truy cập thư viện ảnh để chọn ảnh.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 15,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const newFiles = result.assets.map((asset, index) => {
          const isVideo = asset.type === "video";
          const mimeType =
            asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

          const extension = isVideo ? "mp4" : "jpg";
          const fileName =
            asset.fileName || `media_${Date.now()}_${index}.${extension}`;

          return {
            uri: asset.uri.startsWith("file://")
              ? asset.uri
              : `file://${asset.uri}`,
            name: encodeURIComponent(fileName),
            type: mimeType,
          };
        });

        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error("Image picking error:", err);
      Alert.alert("Lỗi", "Không thể chọn ảnh. Vui lòng thử lại.");
    }
  };

  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const newFiles = result.assets.map((asset, index) => {
          const fileName = asset.name || `file_${Date.now()}_${index}`;
          const mimeType = asset.mimeType || "application/octet-stream";

          return {
            uri: asset.uri.startsWith("file://")
              ? asset.uri
              : `file://${asset.uri}`,
            name: fileName,
            type: mimeType,
          };
        });

        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error("Document picking error:", err);
      Alert.alert("Lỗi", "Không thể chọn file. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    if (showVoicePanel) {
      slideAnim.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
    } else {
      slideAnim.value = 0;
    }
  }, [showVoicePanel]);

  const stopPreview = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const togglePlayPreview = async () => {
    if (!recordedVoice) return;
    try {
      if (isPlayingPreview && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlayingPreview(false);
      } else {
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: recordedVoice.uri },
            { shouldPlay: true }
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlayingPreview(false);
              soundRef.current?.unloadAsync();
              soundRef.current = null;
            }
          });
          setIsPlayingPreview(true);
        } else {
          await soundRef.current.playAsync();
          setIsPlayingPreview(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openVoicePanel = () => {
    Keyboard.dismiss();
    closeStickerPanel();
    setShowVoicePanel(true);
  };

  const closeVoicePanel = () => {
    if (isRecording || isRecognizingText) return;
    stopPreview();
    slideAnim.value = withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setShowVoicePanel)(false);
        runOnJS(setRecordedVoice)(null);
        runOnJS(setRecordingDurationMs)(0);
      }
    });
  };

  const startRecording = async () => {
    try {
      stopPreview();
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Quyền microphone", "Cần cấp quyền microphone để ghi âm.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      recordingRef.current = recording;

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingDurationMs(status.durationMillis || 0);
        }
      });

      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();
      setRecordedVoice(null);
      setRecordingDurationMs(0);
      setIsRecording(true);
    } catch (error) {
      console.error("Start recording error:", error);
      Alert.alert("Lỗi", "Không thể bắt đầu ghi âm.");
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();

      if (uri) {
        setRecordedVoice({
          uri,
          name: `voice_${Date.now()}.m4a`,
          type: "audio/m4a",
          durationMs: status.durationMillis || recordingDurationMs,
        });
      }
    } catch (error) {
      console.error("Stop recording error:", error);
      Alert.alert("Lỗi", "Không thể dừng ghi âm.");
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }

    await startRecording();
  };

  const handleSendVoice = async () => {
    if (!recordedVoice) return;

    try {
      setIsSubmittingVoice(true);
      await onSendVoiceAudio(recordedVoice);
      setRecordedVoice(null);
      setRecordingDurationMs(0);
      setShowVoicePanel(false);
    } catch (error) {
      console.error("Send voice error:", error);
      Alert.alert("Lỗi", "Không thể gửi bản ghi âm.");
    } finally {
      setIsSubmittingVoice(false);
    }
  };

  const renderFormattedText = (textVal: string) => {
    if (!textVal) return null;

    const validMentionNames = [
      "Zola AI",
      ...memberCandidates.map((c) => c?.name).filter(Boolean)
    ];

    const escapedNames = validMentionNames
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (escapedNames.length === 0) {
      return textVal.split(/(\s+)/).map((part, index) => {
        if (part.startsWith("@") && part.length > 1) {
          return (
            <Text key={index} style={{ color: "#0068ff" }}>
              {part}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      });
    }

    const pattern = new RegExp(`(@(?:${escapedNames.join("|")}))`, "g");
    const parts = textVal.split(pattern);

    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        const namePart = part.substring(1);
        if (validMentionNames.includes(namePart)) {
          return (
            <Text key={index} style={{ color: "#0068ff" }}>
              {part}
            </Text>
          );
        }
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  if (isSelectMode) {
    return (
      <View
        className="bg-white border-t border-[#e5e7eb] px-4 py-3 flex-row items-center justify-around"
      >
        <TouchableOpacity onPress={onCancelSelect} className="p-1">
          <Text className="text-[#ef4444] font-semibold text-[15px]">
            Hủy
          </Text>
        </TouchableOpacity>

        <Text className="font-semibold text-[15px] text-[#1f2937]">
          Đã chọn {selectedMessages.length}
        </Text>

        <TouchableOpacity
          onPress={onOpenForwardModal}
          disabled={selectedMessages.length === 0}
          className={`flex-row items-center gap-1.5 p-1 ${selectedMessages.length === 0 ? "opacity-50" : "opacity-100"}`}
        >
          <Ionicons name="arrow-redo-outline" size={22} color="#0068ff" />
          <Text className="text-[#0068ff] font-semibold text-[15px]">
            Tiếp tục
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="bg-white">
      {selectedFiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-[110px] px-2.5 py-2.5 border-t border-[#e5e7eb]"
          contentContainerClassName="gap-3 pr-5"
        >
          {selectedFiles.map((file, index) => (
            <View
              key={index}
              className="w-20 h-20 relative"
            >
              {file.type.startsWith("image/") ? (
                <Image
                  source={{ uri: file.uri }}
                  className="w-20 h-20 rounded-lg"
                  contentFit="cover"
                />
              ) : (
                <View
                  className="w-20 h-20 rounded-lg bg-[#f3f4f6] justify-center items-center p-1 border border-[#e5e7eb]"
                >
                  <Ionicons
                    name={
                      file.type.startsWith("video/")
                        ? "play-circle"
                        : "document"
                    }
                    size={32}
                    color="#6b7280"
                  />
                  <Text
                    numberOfLines={1}
                    className="text-[9px] text-[#6b7280] mt-1"
                  >
                    {file.name}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => removeFile(index)}
                className="absolute -top-1.5 -right-1.5 bg-black/60 rounded-full w-[22px] h-[22px] justify-center items-center z-10"
              >
                <Ionicons name="close" size={14} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <MentionSuggestions
        visible={showMentionList}
        candidates={filteredCandidates}
        onSelect={handleSelectMention}
        onClose={() => setShowMentionList(false)}
      />

      <Animated.View
        className="flex-row items-center p-2 border-t border-[#e5e7eb]"
        style={useAnimatedStyle(() => {
          if (isSelectMode) {
            return { paddingBottom: 8 };
          }
          const baseBottom = Math.max(8, insets.bottom);
          const keyboardPadding = Math.max(8, baseBottom - keyboard.height.value);

          const maxPanelAnim = Math.max(slideAnim.value, stickerSlideAnim.value);
          const panelPadding = baseBottom - (baseBottom - 8) * maxPanelAnim;

          return { paddingBottom: Math.min(keyboardPadding, panelPadding) };
        })}
      >
        <View className="h-[40px] justify-center">
          <TouchableOpacity onPress={toggleEmoji} className="p-1.5">
            <Ionicons name="happy-outline" size={moderateScale(26)} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 bg-[#f3f4f6] rounded-[20px] px-3.5 py-2 justify-center min-h-[40px] max-h-[100px]">
          {text === "" && (
            <View className="absolute left-3.5 z-10 w-full pointer-events-none">
              <Text
                className="text-[#9ca3af] text-[14px]"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {chatName ? `Nhắn tin tới ${chatName}` : "Tin nhắn"}
              </Text>
            </View>
          )}
          <View className="w-full relative justify-center">
            <TextInput
              ref={inputRef}
              className="text-[13px] p-0 m-0 text-gray-800"
              style={{
                color: text === "" ? "#1f2937" : "transparent",
                paddingVertical: 0,
              }}
              value={text}
              onChangeText={handleTextChange}
              editable={!disabled}
              multiline
              onFocus={() => {
                if (disabled) return;
                closeStickerPanel();
                setShowVoicePanel(false);
              }}
            />
            {text !== "" && (
              <View
                pointerEvents="none"
                className="absolute inset-0 justify-center"
                style={{ paddingVertical: 0 }}
              >
                <Text className="text-[13px] p-0 m-0 text-gray-800">
                  {renderFormattedText(text)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {!(text.trim() || selectedFiles.length > 0) ? (
          <View className="flex-row items-center">
            <TouchableOpacity onPress={pickImages} className="p-1.5" disabled={disabled}>
              <MaterialIcons name="image" size={moderateScale(25)} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity onPress={pickDocuments} className="p-1.5" disabled={disabled}>
              <Ionicons name="attach-outline" size={moderateScale(25)} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity onPress={openVoicePanel} className="p-1.5" disabled={disabled}>
              <Ionicons name="mic-outline" size={moderateScale(25)} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Poll (Group only) */}
            {isGroup && (
              <TouchableOpacity
                onPress={() => setShowPollModal(true)}
                className="p-1.5"
                disabled={disabled}
              >
                <Ionicons name="bar-chart-outline" size={moderateScale(25)} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="h-[40px] justify-center">
            <TouchableOpacity
              onPress={handleSend}
              disabled={disabled}
              className="w-[38px] h-[38px] items-center justify-center"
            >
              <Ionicons
                name="send"
                size={moderateScale(22)}
                color="#0068ff"
              />
            </TouchableOpacity>
          </View>
        )}

        {!(text.trim() || selectedFiles.length > 0) && (
          <View className="h-[40px] justify-center">
            <TouchableOpacity
              disabled
              className="w-[38px] h-[38px] items-center justify-center"
            >
              <Ionicons
                name="send"
                size={moderateScale(20)}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {showEmoji && (
        <Pressable
          style={{
            position: "absolute",
            bottom: "100%",
            left: -1000,
            right: -1000,
            height: 10000,
            backgroundColor: "transparent",
            zIndex: 99,
          }}
          onPress={closeStickerPanel}
        />
      )}

      {showEmoji && (
        <Animated.View
          style={[
            stickerAnimatedHeight,
            {
              overflow: "hidden",
              backgroundColor: "white",
            },
          ]}
        >
          <View
            onLayout={(e) => {
              // Only set once or if it changes significantly to prevent jitter
              stickerPanelHeight.value = Math.max(320, e.nativeEvent.layout.height);
            }}
            style={{ paddingBottom: Math.max(16, insets.bottom), flex: 1, minHeight: 320 }}
          >
            <StickerPickerPanel
              onSelectEmoji={handleEmojiSelect}
              onSelectSticker={handleStickerSelect}
            />
          </View>
        </Animated.View>
      )}

      {showVoicePanel && (
        <Pressable
          style={{
            position: "absolute",
            bottom: "100%",
            left: -1000,
            right: -1000,
            height: 10000,
            backgroundColor: "transparent",
            zIndex: 99,
          }}
          onPress={closeVoicePanel}
        />
      )}

      {showVoicePanel && (
        <Animated.View
          style={[
            animatedHeight,
            {
              overflow: "hidden",
              backgroundColor: "white",
            },
          ]}
        >
          <View
            onLayout={(e) => {
              panelHeight.value = e.nativeEvent.layout.height;
            }}
            className="px-screen-edge pt-6 border-t border-[#e5e7eb]"
            style={{ paddingBottom: Math.max(16, insets.bottom) }}
          >
            <Text className="text-center text-[#4b5563] text-sm">
              {isRecording
                ? "Đang ghi âm..."
                : isRecognizingText
                  ? "Đang lắng nghe..."
                  : voiceMode === "audio" && recordedVoice
                    ? `Đã ghi xong ${formatVoiceDuration(recordedVoice.durationMs)}`
                    : "Bấm hoặc bấm giữ để ghi âm"}
            </Text>

            <View className="flex-row items-center justify-center mt-7 gap-10">
              {voiceMode === "audio" && recordedVoice && !isRecording ? (
                <View className="items-center gap-1.5">
                  <TouchableOpacity
                    onPress={togglePlayPreview}
                    disabled={isSubmittingVoice}
                    className="w-14 h-14 rounded-full bg-[#f3f4f6] items-center justify-center"
                  >
                    <Ionicons name={isPlayingPreview ? "pause" : "play"} size={24} color="#374151" />
                  </TouchableOpacity>
                  <Text className="text-[11px] font-medium text-[#4b5563]">Nghe lại</Text>
                </View>
              ) : (
                <View className="w-14 h-14" />
              )}

              <TouchableOpacity
                onPress={() => {
                  if (voiceMode === "audio") {
                    if (recordedVoice && !isRecording) {
                      setRecordedVoice(null);
                      setRecordingDurationMs(0);
                      stopPreview();
                      toggleRecording();
                    } else {
                      toggleRecording();
                    }
                  } else {
                    toggleTextRecording();
                  }
                }}
                className={`w-24 h-24 rounded-full items-center justify-center relative ${isRecording || isRecognizingText ? "bg-[#ef4444]" : "bg-[#0055ff]"}`}
              >
                <Ionicons
                  name={isRecording || isRecognizingText ? "stop" : "mic"}
                  size={scale(32)}
                  color="white"
                />
                {voiceMode === "text" && !(isRecording || isRecognizingText) && (
                  <View className="absolute bottom-4 right-5 bg-white rounded-full w-[22px] h-[22px] items-center justify-center">
                    <Text className="text-[#0055ff] font-bold text-[11px]">A</Text>
                  </View>
                )}
              </TouchableOpacity>

              {voiceMode === "audio" && recordedVoice && !isRecording ? (
                <View className="items-center gap-1.5">
                  <TouchableOpacity
                    onPress={handleSendVoice}
                    disabled={isSubmittingVoice}
                    className={`w-14 h-14 rounded-full bg-[#0055ff] items-center justify-center ${isSubmittingVoice ? "opacity-50" : "opacity-100"}`}
                  >
                    <Ionicons name="send" size={22} color="white" />
                  </TouchableOpacity>
                  <Text className="text-[11px] font-medium text-[#4b5563]">Gửi</Text>
                </View>
              ) : (
                <View className="w-14 h-14" />
              )}
            </View>

            <View className="h-7 mt-4 justify-center">
              {voiceMode === "audio" && (
                <Text className="text-center text-lg font-bold text-[#111827]">
                  {formatVoiceDuration(
                    recordedVoice?.durationMs || recordingDurationMs,
                  )}
                </Text>
              )}
            </View>

            <View className="flex-row mt-6 mb-2 rounded-full bg-[#f3f4f6] p-1">
              <TouchableOpacity
                disabled={isRecording || isRecognizingText}
                onPress={() => setVoiceMode("audio")}
                className={`flex-1 rounded-full py-2.5 items-center ${voiceMode === "audio" ? "bg-white" : "bg-transparent"
                  }`}
              >
                <Text
                  className={`font-semibold ${voiceMode === "audio" ? "text-[#111]" : "text-[#6b7280]"
                    }`}
                >
                  Gửi bản ghi âm
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isRecording || isRecognizingText}
                onPress={() => setVoiceMode("text")}
                className={`flex-1 rounded-full py-2.5 items-center ${voiceMode === "text" ? "bg-white" : "bg-transparent"
                  }`}
              >
                <Text
                  className={`font-semibold ${voiceMode === "text" ? "text-[#111]" : "text-[#6b7280]"
                    }`}
                >
                  Gửi dạng văn bản
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
      {/* Create Poll Modal */}
      {isGroup && (
        <CreatePollModal
          visible={showPollModal}
          onClose={() => setShowPollModal(false)}
          conversationId={conversationId}
        />
      )}
    </View>
  );
};

export default ChatInput;
