import Tips from "@/components/auth/Tips";
import Button from "@/components/common/Button";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import Input from "@/components/common/TextInput";
import OtpInput from "@/components/auth/OtpInput";
import { isVietnamPhone } from "@/utils/data-check";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Text, ToastAndroid, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { formatTime } from "@/utils/formater";
import { authService } from "@/services/auth.service";

export default function UnlockAccount() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState<string>("");
  const [validPhone, setValidPhone] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleOnChangePhone = (val: string) => {
    setPhone(val);
    setValidPhone(isVietnamPhone(val));
  };

  const clearPhone = () => {
    setPhone("");
    setValidPhone(false);
  };

  const handleRequestOtp = async () => {
    if (!validPhone) {
      ToastAndroid.show("Số điện thoại không hợp lệ!", ToastAndroid.SHORT);
      return;
    }

    try {
      setLoading(true);
      const res = await authService.requestUnlockAccount(phone);
      ToastAndroid.show(res.message || "Mã OTP đã được gửi!", ToastAndroid.SHORT);
      setTimeLeft(Number(res.expiresIn) || 120);
      setStep(2);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Không thể yêu cầu mã OTP";
      ToastAndroid.show(msg, ToastAndroid.LONG);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUnlock = async () => {
    if (otp.length !== 6) {
      ToastAndroid.show("Vui lòng nhập đầy đủ mã OTP 6 số!", ToastAndroid.SHORT);
      return;
    }

    try {
      setLoading(true);
      const res = await authService.verifyUnlockAccount(phone, otp);
      ToastAndroid.show(res.message || "Mở khóa tài khoản thành công!", ToastAndroid.LONG);
      router.replace("/(auth)/login");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Xác thực OTP thất bại";
      ToastAndroid.show(msg, ToastAndroid.LONG);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Header
        back
        gradient
        centerChild={
          <Text className="text-white text-sm font-semibold">Mở khóa tài khoản</Text>
        }
      />

      {step === 1 ? (
        <>
          <Tips text="Nhập số điện thoại đăng ký để nhận mã OTP mở khóa tài khoản" />
          <View className="px-screen-edge gap-5 mt-2">
            <Input
              placeholder="Số điện thoại"
              icon="close-outline"
              value={phone}
              onChangeText={handleOnChangePhone}
              onPressOnIcon={clearPhone}
            />
            <Button
              className={`${validPhone && !loading ? "bg-primary" : "bg-secondary"} py-3 w-56`}
              onPress={handleRequestOtp}
              disabled={!validPhone || loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-sm">Gửi mã OTP</Text>
              )}
            </Button>
          </View>
        </>
      ) : (
        <>
          <Tips text="Nhập mã xác thực gửi đến điện thoại để mở khóa tài khoản" />
          <View className="flex px-screen-edge mt-5 mx-auto items-center gap-5 w-full">
            <View className="items-center">
              <Text className="text-sm font-semibold">
                Mã xác thực đã được gửi đến số <Text className="text-xl text-primary">{phone}</Text>
              </Text>
              <Text className="text-xs text-gray-500 mt-1">Hãy nhập mã xác thực gồm 6 chữ số</Text>
            </View>

            <OtpInput onChange={(code) => setOtp(code)} />

            <View className="mt-2">
              {timeLeft > 0 ? (
                <Text className="text-gray-500">
                  Gửi lại mã trong:{" "}
                  <Text className="font-semibold text-primary">{formatTime(timeLeft)}</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleRequestOtp} disabled={loading}>
                  <Text className="text-primary font-semibold underline">Gửi lại mã OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button
              onPress={handleConfirmUnlock}
              className={`${otp.length === 6 && !loading ? "bg-primary" : "bg-secondary"} py-3 w-56 mt-4`}
              disabled={otp.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-sm">Mở khóa tài khoản</Text>
              )}
            </Button>
          </View>
        </>
      )}
    </Container>
  );
}
