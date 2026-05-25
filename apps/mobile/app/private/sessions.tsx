import Tips from "@/components/auth/Tips";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import { useAppDispatch } from "@/store/store";
import { getSessions, logOutDevice, logOutOther } from "@/store/auth/authThunk";
import { Session } from "@/constants/types";
import { getDeviceId } from "@/utils/device.util";
import { formatMessageTime } from "@/utils/format-message-time.util";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { showToast } from "@/utils/toast";

export default function SessionsScreen() {
  const dispatch = useAppDispatch();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await dispatch(getSessions()).unwrap();
      const deviceId = await getDeviceId();
      setCurrentDeviceId(deviceId);
      setSessions(res);
    } catch (err: any) {
      showToast(err.message || "Không thể lấy danh sách phiên đăng nhập");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleLogoutDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Đăng xuất thiết bị",
      `Bạn có chắc chắn muốn đăng xuất khỏi ${deviceName}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(logOutDevice(deviceId)).unwrap();
              setSessions((prev) => prev.filter((s) => s.deviceId !== deviceId));
              showToast("Đã đăng xuất thiết bị thành công");
            } catch (err: any) {
              showToast(err.message || "Đăng xuất thất bại");
            }
          },
        },
      ],
    );
  };

  const handleLogoutOtherDevices = () => {
    Alert.alert(
      "Đăng xuất tất cả thiết bị khác",
      "Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị khác không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất tất cả",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await dispatch(logOutOther()).unwrap();
              setSessions((prev) => prev.filter((s) => s.deviceId === currentDeviceId));
              showToast("Đã đăng xuất tất cả thiết bị khác thành công");
            } catch (err: any) {
              showToast(err.message || "Đăng xuất thất bại");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const otherSessions = sessions.filter((s) => s.deviceId !== currentDeviceId);

  const renderItem = ({ item }: { item: Session }) => {
    const isThisDevice = item.deviceId === currentDeviceId;

    return (
      <View className="flex-row items-center p-4 border-b border-gray-100 bg-white">
        <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
          {item.deviceType === "browser" ? (
            <Feather name="globe" size={24} color="#6b7280" />
          ) : item.deviceType === "tablet" ? (
            <Feather name="tablet" size={24} color="#6b7280" />
          ) : (
            <Feather name="smartphone" size={24} color="#6b7280" />
          )}
        </View>

        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text className="text-[15px] font-bold text-gray-900" numberOfLines={1}>
              {item.deviceName}
            </Text>
            {isThisDevice && (
              <View className="ml-2 bg-blue-100 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-blue-600">Thiết bị này</Text>
              </View>
            )}
          </View>

          <Text className="text-[12px] text-gray-500 mt-0.5">
            Đăng nhập: {formatMessageTime(item.createdAt.toString())}
          </Text>
          <Text className="text-[12px] text-gray-500" numberOfLines={1}>
            Vị trí: {item.location || "Không xác định"} (IP: {item.ip})
          </Text>
        </View>

        {!isThisDevice && (
          <TouchableOpacity
            onPress={() => handleLogoutDevice(item.deviceId, item.deviceName)}
            className="p-2"
          >
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Container edges={["top", "left", "right", "bottom"]}>
      <Header
        back
        gradient
        centerChild={
          <Text className="text-white text-sm font-semibold">Quản lý thiết bị</Text>
        }
      />

      <Tips text="Bạn có thể đăng xuất khỏi các thiết bị không nhận ra hoặc không còn sử dụng." />

      {otherSessions.length > 0 && !loading && (
        <View className="px-4 py-3 bg-red-50 border-b border-gray-100 flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-[13px] font-semibold text-red-700">
              Đang có {otherSessions.length} thiết bị khác đăng nhập
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLogoutOtherDevices}
            className="bg-red-500 px-3 py-2 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-[12px] font-bold text-white">Đăng xuất tất cả</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0068ff" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={(item) => item.deviceId}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <MaterialCommunityIcons name="block-helper" size={60} color="#d1d5db" />
              <Text className="text-gray-400 mt-4">Không tìm thấy phiên đăng nhập nào</Text>
            </View>
          }
        />
      )}
    </Container>
  );
}
