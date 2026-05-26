import React, { useState, useEffect, useRef } from "react";
import { Text, View, StyleSheet, TouchableOpacity, ToastAndroid } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { userService } from "@/services/user.service";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function ScanQRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const isScanningRef = useRef(false);

  const userId = useSelector((state: any) => state.auth.user.userId);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Hàm xử lý khi camera bắt được mã QR
  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (isScanningRef.current || scanned) return;
    isScanningRef.current = true;
    setScanned(true); // Tạm khóa quét để không gọi API liên tục nhiều lần

    try {
      // Dữ liệu từ mã QR (chính là số điện thoại mà ta đã truyền vào value của thẻ QRCode)
      const phoneFromQR = data.trim();

      ToastAndroid.show("Đang tìm kiếm...", ToastAndroid.SHORT);

      // Gọi API tìm kiếm bạn bè
      const friendData = await userService.searchFriendByPhone(userId, phoneFromQR);

      if (!friendData) {
        ToastAndroid.show("Không tìm thấy người dùng", ToastAndroid.SHORT);
        // Đợi 2 giây sau đó cho phép quét lại nếu không tìm thấy
        setTimeout(() => {
          isScanningRef.current = false;
          setScanned(false);
        }, 2000);
        return;
      }

      // Dùng router.replace thay vì push để khi user bấm Back ở màn hình profile, 
      // nó sẽ quay về màn hình Search gốc thay vì quay lại màn hình Camera
      router.replace({
        pathname: "/private/search-profile",
        params: {
          phone: phoneFromQR,
          friendId: friendData.friendId || "",
          name: friendData.name || "",
          avatarUrl: friendData.avatarUrl || "",
          status: friendData.status || "NONE",
        },
      });

    } catch (err) {
      ToastAndroid.show(
        (err as any)?.response?.data?.message || "Mã QR không hợp lệ hoặc lỗi kết nối",
        ToastAndroid.SHORT
      );
      console.error("Error scanning QR:", err);
      // Đợi 2 giây sau đó cho phép quét lại nếu lỗi
      setTimeout(() => {
        isScanningRef.current = false;
        setScanned(false);
      }, 2000);
    }
  };

  // UI khi đang check quyền
  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  // UI khi người dùng chưa cấp quyền Camera
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-4">
        <Text className="text-white text-center mb-4 text-[16px]">
          Zalo cần quyền truy cập Camera để quét mã QR
        </Text>
        <TouchableOpacity
          className="bg-[#0091ff] px-8 py-3 rounded-full"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold text-[16px]">Cấp quyền Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // UI Camera chính
  return (
    <View className="flex-1 bg-black">
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"], // Chỉ quét mã QR
        }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Nút Back ở góc trái trên */}
      <TouchableOpacity
        className="absolute top-12 left-4 w-10 h-10 bg-black/50 rounded-full items-center justify-center z-10"
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      {/* Khung ngắm QR (chỉ để làm đẹp và hướng dẫn user) */}
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        <View className="w-64 h-64 border-2 border-white/50 rounded-2xl bg-transparent" />
        <Text className="text-white mt-8 text-[15px] bg-black/50 px-4 py-2 rounded-lg overflow-hidden">
          Di chuyển camera tới mã QR để quét
        </Text>
      </View>
    </View>
  );
}