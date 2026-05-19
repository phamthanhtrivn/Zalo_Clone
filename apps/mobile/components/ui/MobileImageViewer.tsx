import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView, FlatList } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";

const { width, height } = Dimensions.get("window");

// High-performance animated wrapper around Expo's cached Image component
const AnimatedImage = Animated.createAnimatedComponent(Image);

export interface MediaViewerItem {
  fileKey: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  fileName?: string;
  mimeType?: string;
}

interface MobileImageViewerProps {
  visible: boolean;
  onClose: () => void;
  mediaList: MediaViewerItem[];
  initialIndex?: number;
}

/* ==========================================
   ZoomableImage: High-performance Reanimated & RNGH gesture image
   ========================================== */
interface ZoomableImageProps {
  uri: string;
  onZoomStart: () => void;
  onZoomEnd: () => void;
}

/* ==========================================
   ZoomableImage: High-performance Reanimated & RNGH gesture image
   (ĐÃ TỐI ƯU MƯỢT MÀ 100%)
   ========================================== */
const ZoomableImage = ({ uri, onZoomStart, onZoomEnd }: ZoomableImageProps) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // 🌟 Cờ kiểm soát: Đảm bảo chỉ gọi JS Bridge đúng 1 lần
  const isZooming = useSharedValue(false);

  const resetTransforms = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;

    // Khi ảnh về size gốc, mở khóa vuốt ngang cho FlatList
    if (isZooming.value) {
      isZooming.value = false;
      onZoomEnd();
    }
  };

  // 1. Pinch to Zoom Gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.max(1, Math.min(newScale, 4.5));

      // 🌟 CHỈ GỌI JS 1 LẦN KHI BẮT ĐẦU VƯỢT MỐC ZOOM
      if (scale.value > 1.05 && !isZooming.value) {
        isZooming.value = true;
        runOnJS(onZoomStart)();
      }
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        runOnJS(resetTransforms)();
      } else {
        savedScale.value = scale.value;
      }
    });

  // 2. Pan to Drag zoomed image
  const panGesture = Gesture.Pan()
    .manualActivation(true) // 🌟 BẬT CƠ CHẾ ĐÀM PHÁN THỦ CÔNG
    .onTouchesMove((e, state) => {
      // 🌟 QUAN TRỌNG: Nếu ảnh chưa zoom, đánh rớt (fail) thao tác này ngay!
      // Việc này trả lại sự kiện vuốt ngang (Swipe) cho FlatList để chuyển ảnh
      if (scale.value <= 1.05) {
        state.fail();
      } else {
        // Nếu đã zoom lớn, giành quyền để kéo ảnh đi xung quanh
        state.activate();
      }
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // 3. Double tap
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1.05) {
        runOnJS(resetTransforms)();
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;

        if (!isZooming.value) {
          isZooming.value = true;
          runOnJS(onZoomStart)();
        }
      }
    });

  const combinedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        // 🌟 Mẹo UI: Đưa Translate lên trước Scale để ngón tay di chuyển chuẩn xác theo ảnh
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <View style={{ width, height: height * 0.7 }} className="justify-center items-center">
      <GestureDetector gesture={combinedGesture}>
        <AnimatedImage
          source={{ uri }}
          style={[{ width: "100%", height: "90%" }, animatedStyle]}
          contentFit="contain"
        />
      </GestureDetector>
    </View>
  );
};

/* ==========================================
   MobileImageViewer: Main Root Gallery Component
   ========================================== */
export const MobileImageViewer = ({
  visible,
  onClose,
  mediaList = [],
  initialIndex = 0,
}: MobileImageViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const isSwipingEnabledRef = useRef(true);

  const pagingListRef = useRef<FlatList>(null);
  const thumbnailsListRef = useRef<FlatList>(null);

  // Synchronize start index on open
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setScrollEnabled(true);

      // Delay to allow FlatList mount before initial snapping
      setTimeout(() => {
        try {
          pagingListRef.current?.scrollToIndex({
            index: initialIndex,
            animated: false,
          });
        } catch (e) {
          console.log("Paging scrollToIndex safe skip:", e);
        }
      }, 50);
    }
  }, [visible, initialIndex]);

  // Center active thumbnail inside bottom bar
  useEffect(() => {
    if (visible && thumbnailsListRef.current && mediaList.length > 0 && currentIndex >= 0 && currentIndex < mediaList.length) {
      const timer = setTimeout(() => {
        try {
          thumbnailsListRef.current?.scrollToIndex({
            index: currentIndex,
            animated: true,
            viewPosition: 0.5,
          });
        } catch (err) {
          console.log("Thumbnails scrollToIndex safe skip:", err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, visible, mediaList.length]);

  if (mediaList.length === 0) return null;

  const currentMedia = mediaList[currentIndex];
  if (!currentMedia) return null;

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const fileKey = currentMedia.fileKey;
      const rawFileName = currentMedia.fileName || "media_file";
      const safeFileName = decodeURIComponent(rawFileName);
      const downloadUrl = encodeURI(fileKey);
      const fileUri = FileSystem.documentDirectory + safeFileName;

      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: currentMedia.mimeType || "application/octet-stream",
          dialogTitle: safeFileName,
        });
      } else {
        Toast.show({ type: "success", text1: "Tải xuống thành công", text2: safeFileName });
      }
    } catch (err) {
      console.error("Expo download error:", err);
      Toast.show({ type: "error", text1: "Lỗi tải xuống", text2: "Không thể tải hoặc chia sẻ tệp này." });
    } finally {
      setDownloading(false);
    }
  };

  const handleThumbnailSelect = (index: number) => {
    if (index !== currentIndex) {
      setCurrentIndex(index);
      setScrollEnabled(true);
      try {
        pagingListRef.current?.scrollToIndex({
          index,
          animated: true,
        });
      } catch (e) {
        console.log("Paging transition safe skip:", e);
      }
    }
  };

  return (
    <Modal
      transparent={true} // Safe context bridge overlay
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
        <View style={{ flex: 1, backgroundColor: "#000000" }} className="items-center justify-between py-12 relative">

          {/* Sleek Header Bar */}
          <View className="w-full flex-row justify-between items-center px-5 py-3 bg-black/80 border-b border-white/5 z-50">
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>

            <View className="items-center">
              <Text className="text-white text-xs font-bold uppercase tracking-widest text-white/50">
                Đang xem
              </Text>
              <Text className="text-white text-sm font-black mt-0.5">
                {currentIndex + 1} / {mediaList.length}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleDownload}
              disabled={downloading}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              {downloading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="download-outline" size={22} color="white" />
              )}
            </TouchableOpacity>
          </View>

          {/* Horizontal Swiping Carousel Viewport */}
          <View className="w-full flex-1 justify-center items-center">
            <FlatList
              ref={pagingListRef}
              data={mediaList}
              horizontal
              pagingEnabled
              // Chỉ đọc từ Ref một chiều
              scrollEnabled={scrollEnabled}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
              removeClippedSubviews={true}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                if (newIndex >= 0 && newIndex < mediaList.length) {
                  setCurrentIndex(newIndex);
                }
              }}
              // 🌟 TỐI ƯU CỰC MẠNH: Truyền thêm trạng thái Active
              renderItem={({ item, index }) => {
                const isItemVideo = item.type === "VIDEO";
                const isActive = index === currentIndex; // Kiểm tra xem item này có đang nằm trên màn hình không

                if (isItemVideo) {
                  return (
                    <View style={{ width, height: height * 0.7 }} className="justify-center items-center px-2">
                      <Video
                        source={{ uri: item.fileKey }}
                        useNativeControls
                        resizeMode="contain"
                        className="w-full aspect-video rounded-2xl bg-black shadow-2xl"
                        // 🌟 SỬA LỖI CRASH: Chỉ phát (Play) nếu Video này đang hiện trên màn hình
                        shouldPlay={visible && isActive}
                      />
                    </View>
                  );
                }

                // 🌟 TỐI ƯU GESTURE: Nếu không phải ảnh đang xem, chỉ render ảnh tĩnh nhẹ nhàng
                if (!isActive) {
                  return (
                    <View style={{ width, height: height * 0.7 }} className="justify-center items-center">
                      <Image source={{ uri: item.fileKey }} style={{ width: "100%", height: "90%" }} contentFit="contain" />
                    </View>
                  )
                }

                // Nếu đang xem, mới nhúng component ZoomableImage nặng nề vào
                return (
                  <ZoomableImage
                    uri={item.fileKey}
                    onZoomStart={() => {
                      // Không dùng setState làm re-render, đổi ref cấm vuốt ngay lập tức
                      if (isSwipingEnabledRef.current) {
                        isSwipingEnabledRef.current = false;
                        setScrollEnabled(false);
                      }
                    }}
                    onZoomEnd={() => {
                      isSwipingEnabledRef.current = true;
                      setScrollEnabled(true);
                    }}
                  />
                );
              }}
            />
          </View>

          {/* Bottom Navigation & Thumbnails */}
          <View className="w-full items-center bg-black/80 pt-4 pb-2 z-50">

            {/* Active Zoom Alert Indicator */}
            {!scrollEnabled && (
              <View className="bg-blue-600/90 px-4 py-1.5 rounded-full mb-3 flex-row items-center gap-1.5">
                <Ionicons name="lock-closed" size={12} color="white" />
                <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                  Zoom Đang Khóa Vuốt Trang
                </Text>
              </View>
            )}

            {/* Solid Thumbnail Slider */}
            <View className="w-full px-4 h-16">
              <FlatList
                ref={thumbnailsListRef}
                data={mediaList}
                keyExtractor={(_, i) => String(i)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, alignItems: "center" }}
                renderItem={({ item, index }) => {
                  const isActive = index === currentIndex;
                  const isItemVideo = item.type === "VIDEO";
                  return (
                    <TouchableOpacity
                      onPress={() => handleThumbnailSelect(index)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        overflow: "hidden",
                        backgroundColor: "#111827",
                        position: "relative",
                        borderWidth: isActive ? 2 : 0,
                        borderColor: "#0068ff",
                        opacity: isActive ? 1.0 : 0.4,
                        transform: [{ scale: isActive ? 1.05 : 1.0 }],
                      }}
                    >
                      <Image
                        source={{ uri: item.fileKey }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                      {isItemVideo && (
                        <View className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Ionicons name="play-circle" size={20} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

          </View>

        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};
