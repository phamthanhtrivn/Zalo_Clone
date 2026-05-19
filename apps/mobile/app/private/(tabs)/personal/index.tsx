import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import SearchIcon from "@/components/common/SearchIcon";
import SearchLabel from "@/components/common/SearchLabel";
import GroupAvatar from "@/components/ui/GroupAvatar";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { showToast } from "@/utils/toast";
import { logOut } from "@/store/auth/authThunk";
import OptionItem from "@/components/auth/OptionItem";
import Button from "@/components/common/Button";
import { scale } from "@/utils/responsive";
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
  SimpleLineIcons
} from "@expo/vector-icons";
import { useSocket } from "@/contexts/SocketContext";
import { useEffect, useState } from "react";
import { fetchUserById } from "@/store/auth/userInfoSlice";
import QRCode from "react-native-qrcode-svg";
import { userService } from "@/services/user.service";

export default function Personal() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((state) => state.auth);
  const { userInfo } = useAppSelector((state) => state.userInfo);
  const { profileRefreshKey } = useSocket();
  const [email, setEmail] = useState(userInfo?.email || "");
  const [emailDraft, setEmailDraft] = useState(userInfo?.email || "");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    setEmail(userInfo?.email || "");
    setEmailDraft(userInfo?.email || "");
  }, [userInfo?.email]);

  useEffect(() => {
    if (user?.userId) {
      dispatch(fetchUserById(user.userId));
    }
  }, [dispatch, user?.userId, profileRefreshKey]);

  const handleOnLogout = async () => {
    try {
      await dispatch(logOut()).unwrap();
      showToast("Đăng xuất thành công");
    } catch (error: any) {
      showToast(error || "Lỗi hệ thống !");
    }
  };

  const handleOnPressPassword = () => {
    router.push("/private/change-password");
  };

  const handleOnPressProfile = () => {
    router.push("/private/profile");
  };

  const openEmailEditor = () => {
    setEmailDraft(email || userInfo?.email || "");
    setIsEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    const nextEmail = emailDraft.trim();

    if (savingEmail) {
      return;
    }

    if (!nextEmail) {
      showToast("Vui lòng nhập email");
      return;
    }

    try {
      setSavingEmail(true);
      const formData = new FormData();
      formData.append("email", nextEmail);
      await userService.updateProfile(formData);
      if (user?.userId) {
        await dispatch(fetchUserById(user.userId));
      }
      setEmail(nextEmail);
      setIsEditingEmail(false);
      showToast("Cập nhật email thành công");
    } catch (error: any) {
      showToast(error?.response?.data?.message || error || "Không thể cập nhật email");
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <Container>
      <Header
        gradient
        centerChild={<SearchLabel />}
        leftChild={<SearchIcon />}
      />

      <ScrollView className="flex-1 bg-[#f7f8fa]" showsVerticalScrollIndicator={false}>
        <View className="px-screen-edge pb-10">
          {/* Tiêu đề */}
          <View className="pt-6 pb-2">
            <Text className="text-blue-800 text-xl font-bold">Tài khoản</Text>
          </View>

          {/* Thẻ Thông tin cá nhân */}
          <TouchableOpacity
            onPress={handleOnPressProfile}
            className="mt-2 mb-4 flex-row items-center p-4 border border-gray-100 rounded-md bg-white shadow-sm"
          >
            <GroupAvatar
              uri={userInfo?.profile?.avatarUrl}
              name={userInfo?.profile?.name || "User"}
              size={scale(56)}
            />
            <View className="flex-1 ml-4">
              <Text className="text-gray-500 text-[13px] mb-1">
                Thông tin cá nhân
              </Text>
              <Text className="text-black text-lg font-semibold">
                {userInfo?.profile?.name || "Chưa cập nhật"}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="bg-white rounded-md overflow-hidden border border-gray-100 shadow-sm">
            {/* Số điện thoại */}
            <OptionItem
              onPress={() => router.push("/private/change-phone")}
              className="gap-4 border-b-[0.2px] border-gray-300 py-4 px-4"
              icon="arrow-forward"
            >
              <Feather name="phone" size={scale(20)} color="black" />
              <View className="flex-1">
                <Text className="text-sm text-black">Số điện thoại</Text>
                <Text className="text-gray-500 text-xs mt-1">
                  (+84) {userInfo?.phone || "Chưa cập nhật"}
                </Text>
              </View>
            </OptionItem>

            {/* Email */}
            <OptionItem
              onPress={openEmailEditor}
              className="gap-4 border-b-[0.2px] border-gray-300 py-4 px-4"
              icon="arrow-forward"
            >
              <Feather name="mail" size={scale(20)} color="black" />
              <View className="flex-1 pr-3">
                <Text className="text-sm text-black">Email</Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {userInfo?.email ? userInfo.email : "Chưa liên kết"}
                </Text>
              </View>
            </OptionItem>

            {isEditingEmail && (
              <View className="px-4 pb-4">
                <TextInput
                  value={emailDraft}
                  onChangeText={setEmailDraft}
                  placeholder="Nhập email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  className="mt-3 text-sm text-gray-700 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  placeholderTextColor="#9CA3AF"
                />
                <View className="mt-3 flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleSaveEmail}
                    disabled={savingEmail}
                    className={`${savingEmail ? "bg-blue-400" : "bg-blue-600"} flex-1 rounded-full px-4 py-3`}
                  >
                    <Text className="text-center text-white text-sm font-semibold">
                      {savingEmail ? "Đang lưu..." : "Lưu email"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditingEmail(false)}
                    className="flex-1 rounded-full border border-gray-200 px-4 py-3 bg-white"
                  >
                    <Text className="text-center text-gray-700 text-sm font-semibold">
                      Hủy
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Mã QR của tôi */}
            <TouchableOpacity
              onPress={() => setShowQr((current) => !current)}
              className="border-b-[0.2px] border-gray-300 px-4 py-4"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-4">
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={scale(20)}
                  color="black"
                />
                <View className="flex-1">
                  <Text className="text-sm text-black">Mã QR của tôi</Text>
                  <Text className="text-gray-500 text-xs mt-1">
                    {showQr ? "Chạm để ẩn mã QR" : "Chạm để xem mã QR"}
                  </Text>
                </View>
                <Feather
                  name={showQr ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#9CA3AF"
                />
              </View>

              {showQr && (
                <View className="mt-4 items-center rounded-2xl border border-gray-100 bg-[#f8fbff] p-4">
                  <View className="rounded-2xl bg-white p-4 shadow-sm">
                    <QRCode
                      value={userInfo?.phone || ""}
                      size={160}
                      color="#111827"
                      backgroundColor="white"
                    />
                  </View>
                  <Text className="mt-3 text-center text-xs text-gray-500">
                    {userInfo?.phone
                      ? `(+84) ${userInfo.phone}`
                      : "Chưa có số điện thoại để tạo QR"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Thiết bị đăng nhập */}
            <OptionItem
              onPress={() => router.push("/private/sessions")}
              className="gap-4 border-b-[0.2px] border-gray-300 py-4 px-4"
              icon="arrow-forward"
            >
              <MaterialCommunityIcons
                name="devices"
                size={scale(20)}
                color="black"
              />
              <Text className="text-sm text-black flex-1">Thiết bị đăng nhập</Text>
            </OptionItem>

            {/* Mật khẩu */}
            <OptionItem
              onPress={handleOnPressPassword}
              className="gap-4 py-4 px-4"
              icon="arrow-forward"
            >
              <Ionicons
                name="lock-closed-outline"
                size={scale(20)}
                color="black"
              />
              <Text className="text-sm text-black flex-1">Mật khẩu</Text>
            </OptionItem>
          </View>

          {/* Nút Đăng xuất */}
          <Button
            className={`${loading ? "bg-secondary/60" : "bg-secondary"
              } w-full mt-8 mb-4 py-3.5 gap-3 flex flex-row justify-center rounded-2xl`}
            onPress={handleOnLogout}
            disabled={loading}
          >
            <SimpleLineIcons name="logout" size={20} color="black" />
            <Text className="text-base font-semibold">Đăng xuất</Text>
          </Button>
        </View>
      </ScrollView>
    </Container>
  );
}
