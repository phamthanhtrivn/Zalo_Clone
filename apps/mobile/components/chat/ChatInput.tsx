import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Alert,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import EmojiPicker from "rn-emoji-keyboard";
import { Audio } from "expo-av";
import { COLORS } from "@/constants/colors";
import CreatePollModal from "./CreatePollModal";
import { moderateScale } from "@/utils/responsive";
import MentionSuggestions from "./MentionSuggestions";
import { useAppSelector } from "@/store/store";

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
  isSelectMode?: boolean;
  selectedMessages?: string[];
  onOpenForwardModal?: () => void;
  onCancelSelect?: () => void;
  isGroup?: boolean;
  conversationId?: string;
  members?: any[];
}

type VoiceMode = "audio";

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
  isSelectMode = false,
  selectedMessages = [],
  onOpenForwardModal,
  onCancelSelect,
  isGroup = false,
  conversationId = "",
  members = [],
}) => {
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
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voiceMode] = useState<VoiceMode>("audio");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordedVoice, setRecordedVoice] = useState<RecordedVoice | null>(
    null,
  );
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const handleSend = () => {
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
      setShowEmoji(false);
      setVoiceModalVisible(false);
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

  const handleEmojiSelect = (emoji: any) => {
    setText((prev) => prev + emoji.emoji);
  };

  const toggleEmoji = () => {
    Keyboard.dismiss();
    setVoiceModalVisible(false);
    setShowEmoji(true);
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

  const openVoiceModal = () => {
    Keyboard.dismiss();
    setShowEmoji(false);
    setVoiceModalVisible(true);
  };

  const closeVoiceModal = () => {
    if (isRecording) return;
    setVoiceModalVisible(false);
    setRecordedVoice(null);
    setRecordingDurationMs(0);
  };

  const startRecording = async () => {
    try {
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
      setVoiceModalVisible(false);
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

      {/* Giao diện popover danh sách tag nổi lên */}
      <MentionSuggestions
        visible={showMentionList}
        candidates={filteredCandidates}
        onSelect={handleSelectMention}
        onClose={() => setShowMentionList(false)}
      />

      <View
        className="flex-row items-center p-2 border-t border-[#e5e7eb]"
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
              multiline
              onFocus={() => {
                setShowEmoji(false);
                setVoiceModalVisible(false);
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
            <TouchableOpacity onPress={pickImages} className="p-1.5">
              <MaterialIcons name="image" size={moderateScale(25)} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity onPress={pickDocuments} className="p-1.5">
              <Ionicons name="attach-outline" size={moderateScale(25)} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity onPress={openVoiceModal} className="p-1.5">
              <Ionicons name="mic-outline" size={moderateScale(25)} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Poll (Group only) */}
            {isGroup && (
              <TouchableOpacity
                onPress={() => setShowPollModal(true)}
                className="p-1.5"
              >
                <Ionicons name="bar-chart-outline" size={moderateScale(25)} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="h-[40px] justify-center">
            <TouchableOpacity
              onPress={handleSend}
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
      </View>

      <EmojiPicker
        open={showEmoji}
        onClose={() => setShowEmoji(false)}
        onEmojiSelected={handleEmojiSelect}
      />

      <Modal
        visible={voiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeVoiceModal}
      >
        <Pressable
          onPress={closeVoiceModal}
          className="flex-1 bg-black/20 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-t-[24px] px-6 pt-6 pb-9 min-h-[360px]"
          >
            <View
              className="flex-row justify-between items-center"
            >
              <Text className="text-lg font-bold text-[#111]">
                Gửi bản ghi âm
              </Text>
              <TouchableOpacity
                onPress={closeVoiceModal}
                disabled={isRecording}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text
              className="text-center text-[#4b5563] mt-7 text-base"
            >
              {isRecording
                ? "Đang ghi âm..."
                : recordedVoice
                  ? `Đã ghi xong ${formatVoiceDuration(recordedVoice.durationMs)}`
                  : "Bấm hoặc bấm giữ để ghi âm"}
            </Text>

            <View className="items-center mt-7">
              <TouchableOpacity
                onPress={toggleRecording}
                className={`w-[120px] h-[120px] rounded-[60px] items-center justify-center ${isRecording ? "bg-[#ef4444]" : "bg-[#0055ff]"
                  }`}
              >
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={42}
                  color="white"
                />
              </TouchableOpacity>
            </View>

            <Text
              className="text-center text-[28px] font-bold text-[#111827] mt-6"
            >
              {formatVoiceDuration(
                recordedVoice?.durationMs || recordingDurationMs,
              )}
            </Text>

            <View
              className="flex-row mt-[30px] gap-3"
            >
              <TouchableOpacity
                disabled={isRecording || isSubmittingVoice}
                onPress={() => {
                  setRecordedVoice(null);
                  setRecordingDurationMs(0);
                }}
                className={`flex-1 rounded-[18px] py-3.5 items-center bg-[#f3f4f6] ${!recordedVoice || isSubmittingVoice ? "opacity-50" : "opacity-100"
                  }`}
              >
                <Text className="font-semibold text-[#374151]">
                  Ghi lại
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!recordedVoice || isRecording || isSubmittingVoice}
                onPress={handleSendVoice}
                className={`flex-1 rounded-[18px] py-3.5 items-center bg-[#0055ff] ${!recordedVoice || isRecording || isSubmittingVoice
                  ? "opacity-50"
                  : "opacity-100"
                  }`}
              >
                <Text className="font-bold text-white">
                  {isSubmittingVoice ? "Đang gửi..." : "Gửi bản ghi âm"}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              className="mt-[18px] py-3 rounded-[18px] bg-[#f8fafc] items-center"
            >
              <Text className="text-[#6b7280] font-semibold">
                Chế độ hiện tại: {voiceMode === "audio" ? "Gửi audio" : ""}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
