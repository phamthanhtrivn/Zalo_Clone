import Tips from "@/components/auth/Tips";
import Button from "@/components/common/Button";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import Input from "@/components/common/TextInput";
import { signIn } from "@/store/auth/authThunk";
import { useAppDispatch } from "@/store/store";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  // ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";

export default function Login() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, error, message, loading } = useSelector(
    (state: any) => state.auth,
  );
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isHiddenPass, setHiddenPass] = useState<boolean>(true);
  const canLogin = password !== "" && phone !== "";

  const handleOnChangePhone = (phone: string) => {
    setPhone(phone);
  };

  const handleOnChangePassword = (password: string) => {
    setPassword(password);
  };

  const clearPhone = () => {
    setPhone("");
  };

  const changHiddenPass = () => {
    setHiddenPass(!isHiddenPass);
  };

  const handleForgotPassword = () => {
    router.push("/(auth)/forgot-password");
  };

  const handleOnSignIn = async () => {
    try {
      await dispatch(signIn({ phone, password })).unwrap();

      // ToastAndroid.show("Đăng nhập thành công", ToastAndroid.SHORT);
    } catch (err: any) {
      console.log(err);
      // ToastAndroid.show("Đăng nhập thất bại", ToastAndroid.SHORT);
    }
  };

  return (
    <Container>
      <Header
        back
        gradient
        centerChild={
          <Text className="text-white text-sm font-semibolds">Đăng nhập</Text>
        }
      />
      <Tips text="Vui lòng nhập số tài khoản và mật khẩu để đăng nhập" />
      <View className="px-screen-edge gap-5 mt-2">
        <Input
          placeholder="Số điện thoại"
          icon="close-outline"
          value={phone}
          onChangeText={handleOnChangePhone}
          onPressOnIcon={clearPhone}
        />
        <Input
          placeholder="Mật khẩu"
          value={password}
          icon={isHiddenPass ? `eye-off-outline` : `eye-outline`}
          onPressOnIcon={changHiddenPass}
          security={isHiddenPass}
          onChangeText={handleOnChangePassword}
        />

        <Text className="text-red-600">{error.message}</Text>
        <View className="flex-row justify-between items-center w-full pr-4 mt-1">
          <TouchableOpacity onPress={handleForgotPassword}>
            <Text className="text-primary/70 font-semibold">
              Lấy lại mật khẩu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(auth)/unlock-account")}>
            <Text className="text-red-500 font-semibold">
              Mở khóa tài khoản
            </Text>
          </TouchableOpacity>
        </View>
        <Button
          disabled={!canLogin || loading}
          className={`${canLogin || loading ? "bg-primary" : "bg-secondary"} py-3 w-56`}
          onPress={handleOnSignIn}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text className={`text-white font-semibold text-sm`}>
              Đăng nhập
            </Text>
          )}
        </Button>
      </View>
    </Container>
  );
}
