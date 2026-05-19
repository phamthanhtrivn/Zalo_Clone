import Button from "@/components/common/Button";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import Input from "@/components/common/TextInput";
import Tips from "@/components/auth/Tips";
import { changePassword } from "@/store/auth/authThunk";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { showToast } from "@/utils/toast";

export default function ChangePassword() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [oldPassword, setOldPassword] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [isHiddenPass, setHiddenPass] = useState<boolean>(true);
  const [isHiddenPass1, setHiddenPass1] = useState<boolean>(true);
  const [isHiddenPass2, setHiddenPass2] = useState<boolean>(true);

  const handleOnUpdate = async () => {
    try {
      setFieldErrors({});
      await dispatch(
        changePassword({
          newPassword: password,
          confirmPassword: confirmPassword,
          oldPassword: oldPassword,
        }),
      ).unwrap();

      showToast("Đổi mật khẩu thành công");
      router.back();
    } catch (err: any) {
      if (err && err.errors && Array.isArray(err.errors)) {
        const errorsObj: Record<string, string> = {};
        err.errors.forEach((item: any) => {
          if (item.field) {
            errorsObj[item.field] = item.error;
          }
        });
        setFieldErrors(errorsObj);
      }
      showToast(err.message || "Đổi mật khẩu thất bại !");
    }
  };

  return (
    <Container>
      <Header
        back
        gradient
        centerChild={
          <Text className="text-white text-sm font-semibold">Đổi mật khẩu</Text>
        }
      />
      <Tips text="Hãy chọn mật khẩu đủ mạnh để bảo vệ tài khoản" />
      <View className="px-screen-edge mt-2 gap-3">
        <Input
          placeholder="Mật khẩu cũ"
          security={isHiddenPass2}
          onPressOnIcon={() => setHiddenPass2(!isHiddenPass2)}
          icon={isHiddenPass2 ? `eye-off-outline` : `eye-outline`}
          value={oldPassword}
          onChangeText={(value) => setOldPassword(value)}
        />
        {fieldErrors.oldPassword && (
          <Text className="text-red-600 text-xs mt-1 ml-1">
            {fieldErrors.oldPassword}
          </Text>
        )}
        <Input
          placeholder="Mật khẩu mới"
          security={isHiddenPass}
          onPressOnIcon={() => setHiddenPass(!isHiddenPass)}
          icon={isHiddenPass ? `eye-off-outline` : `eye-outline`}
          value={password}
          onChangeText={(value) => setPassword(value)}
        />
        {fieldErrors.newPassword && (
          <Text className="text-red-600 text-xs mt-1 ml-1">
            {fieldErrors.newPassword}
          </Text>
        )}
        <Input
          placeholder="Nhập lại mật khẩu mới"
          security={isHiddenPass1}
          onPressOnIcon={() => setHiddenPass1(!isHiddenPass1)}
          icon={isHiddenPass1 ? `eye-off-outline` : `eye-outline`}
          value={confirmPassword}
          onChangeText={(value) => setConfirmPassword(value)}
        />
        {fieldErrors.confirmPassword && (
          <Text className="text-red-600 text-xs mt-1 ml-1">
            {fieldErrors.confirmPassword}
          </Text>
        )}

        <Button
          onPress={handleOnUpdate}
          className={`${loading ? "bg-secondary" : "bg-primary"} py-3 mt-4 w-full rounded-xl`}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className={`text-white font-bold text-base`}>
              Cập nhật mật khẩu
            </Text>
          )}
        </Button>
      </View>
    </Container>
  );
}
