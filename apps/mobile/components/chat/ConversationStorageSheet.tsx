import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { messageService } from "@/services/message.service";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { formatFileSize } from "@/utils/format-file.util";
import { MobileImageViewer } from "../ui/MobileImageViewer";

const { width, height } = Dimensions.get("window");

interface ConversationStorageSheetProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: "media" | "files" | "links";
  conversationId: string;
  members: any[];
  currentUserId: string;
}

export const ConversationStorageSheet = ({
  visible,
  onClose,
  initialTab = "media",
  conversationId,
  members,
  currentUserId,
}: ConversationStorageSheetProps) => {
  const [activeTab, setActiveTab] = useState<"media" | "files" | "links">(initialTab);
  const [senderFilter, setSenderFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Filter selection menu visibility states
  const [showSenderMenu, setShowSenderMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);

  // React Query fetching with cache support
  const { data: items = [], isLoading: loading, refetch } = useQuery({
    queryKey: [
      "conversationStorageMobile",
      conversationId,
      activeTab,
      senderFilter,
      dateFilter,
      currentUserId,
    ],
    queryFn: async () => {
      let fromDate: string | undefined;
      let toDate: string | undefined;
      const today = new Date();

      if (dateFilter === "today") {
        fromDate = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        toDate = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateFilter === "week") {
        fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === "month") {
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      }

      console.log(`[MobileQuery-Storage] Fetching for tab: ${activeTab}`);
      const res = await messageService.getMediasFileType(conversationId, {
        userId: currentUserId,
        type: activeTab === "media" ? "IMAGE" : activeTab === "files" ? "FILE" : "LINK",
        senderId: senderFilter !== "all" ? senderFilter : undefined,
        fromDate,
        toDate,
        limit: 100,
      });

      return Array.isArray(res) ? res : res.data?.messages || res.messages || [];
    },
    enabled: visible && !!conversationId && !!currentUserId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const getGroupDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return `Ngày ${d.getDate()} Tháng ${d.getMonth() + 1}`;
  };

  const getSenderName = (item: any) => {
    const sender = item.senderId;
    if (!sender) return "Người dùng";
    if (typeof sender === "object") {
      return sender.profile?.name || sender.name || "Người dùng";
    }
    const memberObj = members.find(
      (m: any) => String(m.userId?._id || m.userId) === String(sender)
    );
    if (memberObj) {
      if (memberObj.userId && typeof memberObj.userId === "object") {
        return memberObj.userId.profile?.name || memberObj.userId.name || "Người dùng";
      }
      return memberObj.name || "Người dùng";
    }
    return "Người dùng";
  };

  // Download & Share file inside React Native
  const handleDownload = async (file: any) => {
    try {
      setDownloadingId(file.fileKey);
      const safeFileName = decodeURIComponent(file.fileName || "file");
      const downloadUrl = encodeURI(file.fileKey);
      const fileUri = FileSystem.documentDirectory + safeFileName;

      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: file.mimeType || "application/octet-stream",
          dialogTitle: safeFileName,
        });
      } else {
        Alert.alert("Thành công", `Đã tải xuống file: ${safeFileName}`);
      }
    } catch (err) {
      console.error("Expo download error:", err);
      Alert.alert("Lỗi", "Không thể tải file này xuống.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Group items by date label
  const groupedItems = useMemo(() => {
    const groups: { [label: string]: any[] } = {};
    items.forEach((item) => {
      const label = getGroupDateLabel(item.createdAt);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
    });
    return groups;
  }, [items]);

  const activeSenderName = useMemo(() => {
    if (senderFilter === "all") return "Tất cả";
    const found = members.find(
      (m: any) => String(m.userId?._id || m.userId) === String(senderFilter)
    );
    return found?.userId?.profile?.name || found?.name || "Người dùng";
  }, [senderFilter, members]);

  const activeDateLabel = useMemo(() => {
    if (dateFilter === "all") return "Tất cả";
    if (dateFilter === "today") return "Hôm nay";
    if (dateFilter === "week") return "1 tuần gần đây";
    if (dateFilter === "month") return "Tháng này";
    return "Tất cả";
  }, [dateFilter]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#f3f4f6", zIndex: 9999 }]}>

      {/* Header */}
      <View className="bg-white border-b border-[#e5e7eb] px-4 pt-12 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-800">Kho lưu trữ</Text>
        </View>

      </View>

      {/* Segmented Tab Controls */}
      <View className="bg-white border-b border-gray-200 flex-row justify-around">
        {(
          [
            { id: "media", label: "Ảnh/Video" },
            { id: "files", label: "Files" },
            { id: "links", label: "Links" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id);
              }}
              className={`py-3.5 px-4 border-b-2 ${isActive ? "border-[#0068ff]" : "border-transparent"
                }`}
            >
              <Text
                className={`text-xs font-bold ${isActive ? "text-[#0068ff]" : "text-gray-500"
                  }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom Mobile Filter Dropdowns */}
      <View className="bg-white border-b border-gray-100 px-3 py-2 flex-row gap-2">
        {/* Sender Filter Selector */}
        <TouchableOpacity
          onPress={() => setShowSenderMenu(true)}
          className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 flex-row justify-between items-center"
        >
          <Text className="text-[11px] font-semibold text-gray-700 truncate max-w-[80%]">
            Gửi bởi: {activeSenderName}
          </Text>
          <Ionicons name="chevron-down" size={12} color="#9ca3af" />
        </TouchableOpacity>

        {/* Date Filter Selector */}
        <TouchableOpacity
          onPress={() => setShowDateMenu(true)}
          className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 flex-row justify-between items-center"
        >
          <Text className="text-[11px] font-semibold text-gray-700">
            Ngày gửi: {activeDateLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Loader or Content Scroll */}
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#0068ff" />
          <Text className="text-xs text-gray-500 mt-2 font-medium">Đang tải dữ liệu...</Text>
        </View>
      ) : Object.keys(groupedItems).length > 0 ? (
        <ScrollView className="flex-1 px-3 pt-3">
          {Object.keys(groupedItems).map((dateLabel) => {
            const groupList = groupedItems[dateLabel];
            return (
              <View key={dateLabel} className="mb-6">
                {/* Date section header */}
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">
                  {dateLabel}
                </Text>

                {/* Grid or List based on activeTab */}
                {activeTab === "media" ? (
                  <View className="flex-row flex-wrap gap-1">
                    {groupList.map((item, idx) => {
                      const file = item.content?.file;
                      if (!file) return null;
                      const isVideo = file?.type === "VIDEO";

                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => {
                            const idxInRaw = items.findIndex((x) => x._id === item._id);
                            if (idxInRaw !== -1) {
                              setPreviewIndex(idxInRaw);
                            }
                          }}
                          className="bg-gray-200 border border-gray-200 rounded-lg overflow-hidden relative"
                          style={{
                            width: (width - 24 - 8) / 3,
                            aspectRatio: 1,
                          }}
                        >
                          <Image
                            source={{ uri: file.fileKey }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                          {isVideo && (
                            <View className="absolute inset-0 bg-black/25 flex items-center justify-center">
                              <Ionicons name="play-circle" size={28} color="white" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : activeTab === "files" ? (
                  <View className="gap-1.5">
                    {groupList.map((item, idx) => {
                      const file = item.content?.file;
                      if (!file) return null;

                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleDownload(file)}
                          className="bg-white border border-gray-200 rounded-xl p-3 flex-row items-center gap-3"
                        >
                          <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center">
                            <Ionicons name="document-text" size={22} color="#4b5563" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[13px] font-semibold text-gray-800 truncate" numberOfLines={1}>
                              {file.fileName}
                            </Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">
                              {formatFileSize(file.fileSize)} • {getSenderName(item)}
                            </Text>
                          </View>
                          <Ionicons name="download-outline" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View className="gap-1.5">
                    {groupList.map((item, idx) => {
                      const url = item.content?.text;

                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => {
                            Linking.openURL(url).catch(() =>
                              Alert.alert("Lỗi", "Không thể mở đường dẫn này.")
                            );
                          }}
                          className="bg-white border border-gray-200 rounded-xl p-3 flex-row items-center gap-3"
                        >
                          <View className="w-10 h-10 bg-blue-50 items-center justify-center rounded-lg">
                            <Ionicons name="link" size={18} color="#0068ff" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[13px] font-semibold text-[#0068ff] truncate" numberOfLines={1}>
                              {url}
                            </Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">
                              {getSenderName(item)}
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          <View className="h-10" />
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
          <Text className="text-sm font-semibold text-gray-700 mt-3">Kho lưu trữ trống</Text>
          <Text className="text-xs text-gray-400 text-center mt-1">
            Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.
          </Text>
        </View>
      )}

      {/* Sender Picker Overlay */}
      {showSenderMenu && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowSenderMenu(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 10000, paddingHorizontal: 24 }]}
        >
          <View className="bg-white w-full rounded-2xl max-h-[60%] overflow-hidden">
            <View className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-row justify-between items-center">
              <Text className="font-bold text-gray-800">Lọc theo người gửi</Text>
              <TouchableOpacity onPress={() => setShowSenderMenu(false)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                onPress={() => {
                  setSenderFilter("all");
                  setShowSenderMenu(false);
                }}
                className="px-4 py-3.5 border-b border-gray-100 flex-row justify-between items-center"
              >
                <Text className={`text-sm ${senderFilter === "all" ? "text-[#0068ff] font-bold" : "text-gray-700"}`}>
                  Tất cả người gửi
                </Text>
                {senderFilter === "all" && <Ionicons name="checkmark" size={18} color="#0068ff" />}
              </TouchableOpacity>

              {members.map((m: any) => {
                const uid = m.userId?._id || m.userId;
                const name = m.userId?.profile?.name || m.name || "Người dùng";
                const isSel = String(senderFilter) === String(uid);

                return (
                  <TouchableOpacity
                    key={uid}
                    onPress={() => {
                      setSenderFilter(uid);
                      setShowSenderMenu(false);
                    }}
                    className="px-4 py-3.5 border-b border-gray-100 flex-row justify-between items-center"
                  >
                    <Text className={`text-sm ${isSel ? "text-[#0068ff] font-bold" : "text-gray-700"}`} numberOfLines={1}>
                      {name}
                    </Text>
                    {isSel && <Ionicons name="checkmark" size={18} color="#0068ff" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      )}

      {/* Date Picker Overlay */}
      {showDateMenu && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDateMenu(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 10000, paddingHorizontal: 24 }]}
        >
          <View className="bg-white w-full rounded-2xl overflow-hidden">
            <View className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-row justify-between items-center">
              <Text className="font-bold text-gray-800">Lọc theo ngày gửi</Text>
              <TouchableOpacity onPress={() => setShowDateMenu(false)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View>
              {[
                { id: "all", label: "Tất cả thời gian" },
                { id: "today", label: "Hôm nay" },
                { id: "week", label: "1 tuần gần đây" },
                { id: "month", label: "Tháng này" },
              ].map((dOpt) => {
                const isSel = dateFilter === dOpt.id;
                return (
                  <TouchableOpacity
                    key={dOpt.id}
                    onPress={() => {
                      setDateFilter(dOpt.id);
                      setShowDateMenu(false);
                    }}
                    className="px-4 py-3.5 border-b border-gray-100 flex-row justify-between items-center"
                  >
                    <Text className={`text-sm ${isSel ? "text-[#0068ff] font-bold" : "text-gray-700"}`}>
                      {dOpt.label}
                    </Text>
                    {isSel && <Ionicons name="checkmark" size={18} color="#0068ff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      )}

      <MobileImageViewer
        visible={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        initialIndex={previewIndex ?? 0}
        mediaList={items.map((item: any) => ({
          fileKey: item.content?.file?.fileKey || "",
          type: item.content?.file?.type || "IMAGE",
          fileName: item.content?.file?.fileName,
          mimeType: item.content?.file?.mimeType,
        }))}
      />
    </View>
  );
};
