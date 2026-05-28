import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import { userService } from "@/services/user.service";
import { useAppSelector } from "@/store/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import QRCode from "react-native-qrcode-svg";
import {
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";

export default function SearchScreen() {
  const [phone, setPhone] = useState("");
  const userId = useSelector((state: any) => state.auth.user.userId);
  const { userInfo } = useAppSelector((state) => state.userInfo);

  const router = useRouter();

  const handleSearchByPhone = async () => {
    try {
      const data = await userService.searchFriendByPhone(userId, phone);

      if (!data) {
        ToastAndroid.show("Không tìm thấy người dùng", ToastAndroid.SHORT);
        return;
      }

      router.push({
        pathname: "/private/search-profile",
        params: {
          phone: phone,
          friendId: data.friendId || "",
          name: data.name || "",
          avatarUrl: data.avatarUrl || "",
          status: data.status || "NONE",
        },
      });
    } catch (err) {
      ToastAndroid.show(
        (err as any)?.response?.data?.message ||
        "Không thể tìm kiếm người dùng",
        ToastAndroid.SHORT,
      );
      console.error("Error searching friend by phone:", err);
    }
  };

  return (
    <Container className="bg-[#f3f4f6]">
      <View className="bg-white">
        <Header
          back
          centerChild={
            <Text className="text-sm font-semibold text-black">
              Thêm bạn
            </Text>
          }
        />
        <View className="px-4 pb-6 pt-2 items-center rounded-md">
          <LinearGradient
            colors={["#3f5f87", "#35567f"]}
            className="w-full max-w-[300px] px-6 py-6 items-center"
          >
            {/* Tên người dùng. Nếu có biến name từ Redux thì thay "Tri" bằng {name} */}
            <Text className="text-white text-lg font-semibold">
              {userInfo?.profile?.name || ""}
            </Text>

            <View className="w-40 h-40 bg-white rounded-2xl items-center justify-center mt-4 overflow-hidden">
              {/* Thay thế Ionicons bằng QRCode */}
              <QRCode
                value={userInfo?.phone || ""}
                size={120}
                color="#111827"
                backgroundColor="white"
              />
            </View>

            <Text className="text-white/80 text-xs text-center mt-4">
              Quét mã để thêm bạn với tôi
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center">
          <View className="flex-1 h-12 rounded-2xl border border-gray-300 bg-white overflow-hidden flex-row items-center">
            <TouchableOpacity className="h-full px-4 border-r border-gray-200 flex-row items-center gap-x-1">
              <Text className="text-black text-sm">+84</Text>
              <Ionicons name="chevron-down" size={18} color="#111827" />
            </TouchableOpacity>

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Nhập số điện thoại"
              keyboardType="phone-pad"
              className="flex-1 px-4 text-sm text-black"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity
            disabled={!phone.trim()}
            onPress={handleSearchByPhone}
            className={`ml-3 w-12 h-12 rounded-full items-center justify-center ${phone.trim() ? "bg-[#0091ff]" : "bg-[#d1d5db]"
              }`}
          >
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white">
        <TouchableOpacity
          className="h-16 px-4 flex-row items-center border-b border-gray-100"
          onPress={() => router.push("/private/qr-scanner")}
        >
          <View className="w-9 h-9 rounded-lg items-center justify-center bg-[#eef5ff]">
            <Ionicons name="qr-code-outline" size={20} color="#0055ff" />
          </View>
          <Text className="ml-4 text-sm text-black">Quét mã QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="h-16 px-4 flex-row items-center"
          onPress={() => router.push("/private/suggest-friends")}
        >
          <View className="w-9 h-9 rounded-lg items-center justify-center bg-[#eef5ff]">
            <Ionicons name="people-outline" size={20} color="#0055ff" />
          </View>
          <Text className="ml-4 text-sm text-black">
            Bạn bè có thể quen
          </Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 pt-8">
        <Text className="text-xs text-center text-gray-500">
          Xem lời mời kết bạn đã gửi tại trang Danh bạ Zalo
        </Text>
      </View>
    </Container>
  );
}
