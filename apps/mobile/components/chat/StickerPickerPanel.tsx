import React, { useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import { STICKER_PACKS } from "@/constants/stickers";

interface Props {
  onSelectEmoji: (emoji: any) => void;
  onSelectSticker: (url: string) => void;
}

const emojiTheme = { container: "#ffffff" };

export const StickerPickerPanel = React.memo(({
  onSelectEmoji,
  onSelectSticker,
}: Props) => {
  const [activeTab, setActiveTab] = useState<"STICKER" | "EMOJI">("STICKER");
  const [selectedPackId, setSelectedPackId] = useState<string>(STICKER_PACKS[0].id);

  // Ghi nhớ pack hiện tại, tránh tính toán lại khi re-render thừa
  const currentPack = useMemo(() => {
    return STICKER_PACKS.find((p) => p.id === selectedPackId) || STICKER_PACKS[0];
  }, [selectedPackId]);

  // Tách hàm render item ra ngoài để FlatList chạy mượt nhất
  const renderStickerItem = useCallback(({ item }: { item: string }) => (
    <TouchableOpacity
      onPress={() => onSelectSticker(item)}
      className="w-[25%] aspect-square p-2 items-center justify-center"
    >
      <Image
        source={{ uri: item }}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        cachePolicy="disk" // Ép lưu ổ cứng chống tải lại
        recyclingKey={item}
      />
    </TouchableOpacity>
  ), [onSelectSticker]);

  return (
    <View className="flex-1 bg-white flex-col h-full w-full">
      {/* Header Tabs */}
      <View className="flex-row items-center px-4 pt-2 border-b border-[#e5e7eb] bg-white w-full">
        <View className="flex-row gap-6 flex-1">
          <TouchableOpacity onPress={() => setActiveTab("STICKER")} className="pb-2 relative">
            <Text className={`text-xs font-semibold ${activeTab === "STICKER" ? "text-blue-600" : "text-gray-500"}`}>
              STICKER
            </Text>
            {activeTab === "STICKER" && <View className="h-0.5 bg-blue-600 absolute bottom-0 left-0 right-0" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab("EMOJI")} className="pb-2 relative">
            <Text className={`text-xs font-semibold ${activeTab === "EMOJI" ? "text-blue-600" : "text-gray-500"}`}>
              EMOJI
            </Text>
            {activeTab === "EMOJI" && <View className="h-0.5 bg-blue-600 absolute bottom-0 left-0 right-0" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      <View className="flex-1 bg-white w-full h-full">
        {/* 1. TAB EMOJI: Chỉ render THỰC SỰ khi được chọn để tránh giật lag tab khác */}
        {activeTab === "EMOJI" && (
          <View className="flex-1 h-full w-full" style={{ minHeight: 250 }}>
            <EmojiKeyboard
              onEmojiSelected={onSelectEmoji}
              theme={emojiTheme}
              enableSearchBar={false}
              allowMultipleSelections={true}
            />
          </View>
        )}

        {/* 2. TAB STICKER */}
        {activeTab === "STICKER" && (
          <View className="flex-1 flex-col h-full w-full">
            {/* Thay thế Scroll Viw bằng FlatList tối ưu hóa bộ nhớ RAM */}
            <FlatList
              data={currentPack.stickers}
              renderItem={renderStickerItem}
              numColumns={4} // Tự động chia thành lưới 4 cột
              keyExtractor={(item, index) => `${selectedPackId}-${index}`}
              className="flex-1 px-1 pt-2"
              ListHeaderComponent={
                <Text className="text-sm font-semibold text-gray-700 mb-2 px-2">Stickers</Text>
              }
              ListFooterComponent={<View className="h-6" />}

              // 🚨 THẦN CHÚ KHỬ LAG CHO FLATLIST ĐÂY BRO:
              initialNumToRender={12} // Chỉ vẽ trước 12 sticker vừa mắt nhìn
              maxToRenderPerBatch={8}  // Mỗi lượt cuộn chỉ nạp thêm tối đa 8 cái
              windowSize={3}           // Giải phóng hoàn toàn các sticker nằm ngoài vùng nhìn thấy
              removeClippedSubviews={true} // Bật tính năng dọn dẹp view khuất của Android/iOS
            />

            {/* Bottom Toolbar */}
            <View className="border-t border-[#e5e7eb] px-2 py-2 flex-row items-center bg-gray-50">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                <TouchableOpacity className="p-1.5 rounded-md bg-white border border-gray-200 mr-2 items-center justify-center h-8 w-8">
                  <Ionicons name="time-outline" size={18} color="#0068ff" />
                </TouchableOpacity>

                {STICKER_PACKS.map((pack) => (
                  <TouchableOpacity
                    key={pack.id}
                    onPress={() => setSelectedPackId(pack.id)}
                    className={`w-8 h-8 rounded-md items-center justify-center mr-2 ${selectedPackId === pack.id ? 'bg-gray-300' : 'bg-transparent'
                      }`}
                  >
                    <Image
                      source={{ uri: pack.packIcon }}
                      style={{ width: 24, height: 24 }}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View className="flex-row items-center gap-1 border-l border-gray-300 pl-2">
                <TouchableOpacity className="p-1.5">
                  <Ionicons name="settings-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity className="p-1.5">
                  <Ionicons name="add-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});