import Button from "@/components/common/Button";
import Container from "@/components/common/Container";
import { confirmLogin } from "@/store/auth/authThunk";
import { useAppDispatch } from "@/store/store";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Image,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
export default function ConfirmLoginScreen() {
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams();
  const qrToken = params.qrToken as string;

  const device = JSON.parse(params.device as string);

  const router = useRouter();

  const onConfirm = async () => {
    try {
      await dispatch(confirmLogin(qrToken));
      router.dismiss(2);
    } catch (err: any) {
      ToastAndroid.show(
        err.response?.data?.message || "QR đã hết hạn",
        ToastAndroid.LONG,
      );
    }
  };

  return (
    <Container edges={["top", "left", "right", "bottom"]} className="flex-1 bg-white items-center justify-between py-12 px-6">
      <View className="items-center w-full px-screen-edge">
        {/* Icon máy tính to ở giữa */}
        <Image
          className="w-72 h-52"
          resizeMethod={"scale"}
          source={require("@/assets/images/qr-code-scanning.jpg")}
        />

        <Text className="text-lg font-bold text-gray-800 mb-2 text-center">
          Đăng nhập bằng mã QR
        </Text>

        <Text className="text-gray-500 text-center mb-8">
          Vui lòng xác nhận để đăng nhập tài khoản Zalo của bạn vào thiết bị này
        </Text>

        {/* Bảng thông tin thiết bị */}
        <View className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-100">
          <View className="flex-row justify-between mb-4">
            <Text className="text-gray-500">Thiết bị:</Text>
            <Text className=" font-medium">{device.deviceName}</Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <Text className="text-gray-500">Vị trí:</Text>
            <Text className="font-medium">{device.location}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500">IP:</Text>
            <Text className="font-medium">{device.ip}</Text>
          </View>
        </View>
      </View>

      {/* 2 Nút hành động */}
      <View className="w-full gap-4 px-screen-edge">
        <Button className="bg-primary w-full py-3" onPress={onConfirm}>
          <Text className="text-white font-bold text-base">Đăng nhập</Text>
        </Button>

        <Button
          className="py-3 bg-secondary w-full"
          onPress={() => router.back()}
        >
          <Text className="text-black font-bold text-base">Từ chối</Text>
        </Button>
      </View>
    </Container>
  );
}
