import Button from "@/components/common/Button";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import Input from "@/components/common/TextInput";
import Tips from "@/components/auth/Tips";
import OtpInput from "@/components/auth/OtpInput";
import { authService } from "@/services/auth.service";
import { useAppDispatch } from "@/store/store";
import { logout2 } from "@/store/auth/authThunk";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { showToast } from "@/utils/toast";
import { formatTime } from "@/utils/formater";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { COLORS } from "@/constants/colors";

export default function ChangePhone() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(120);

  useEffect(() => {
    if (step === 2) {
      const timer = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  const handleOnRequestOtp = async () => {
    if (!phone) {
      showToast("Vui lòng nhập số điện thoại mới !");
      return;
    }
    // Hỗ trợ cả định dạng bắt đầu bằng 0 hoặc 84
    const phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      showToast("Số điện thoại không hợp lệ !");
      return;
    }

    try {
      setLoading(true);
      const res = await authService.requestUpdatePhone(phone);
      showToast(res?.message || "Mã OTP đã được gửi tới số điện thoại mới.");
      setTimeLeft(120);
      setStep(2);
    } catch (err: any) {
      showToast(err?.message || "Yêu cầu gửi OTP thất bại !");
    } finally {
      setLoading(false);
    }
  };

  const handleOnResendOtp = async () => {
    if (timeLeft > 0) return;
    try {
      setLoading(true);
      const res = await authService.requestUpdatePhone(phone);
      showToast(res?.message || "Mã OTP đã được gửi lại.");
      setTimeLeft(120);
    } catch (err: any) {
      showToast(err?.message || "Gửi lại OTP thất bại !");
    } finally {
      setLoading(false);
    }
  };

  const handleOnConfirm = async () => {
    if (otp.length !== 6) {
      showToast("Vui lòng nhập đầy đủ mã OTP 6 chữ số !");
      return;
    }

    try {
      setLoading(true);
      const res = await authService.verifyUpdatePhone(phone, otp);

      showToast(res?.message || "Cập nhật số điện thoại thành công !");

      // Xoá token và cưỡng chế đăng xuất khỏi ứng dụng
      await dispatch(logout2()).unwrap();
    } catch (err: any) {
      showToast(err?.message || "Xác thực OTP thất bại !");
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
          <Text className="text-white text-sm font-semibold">
            Cập nhật số điện thoại
          </Text>
        }
      />
      <Tips text="Cập nhật số điện thoại mới sẽ yêu cầu bạn đăng nhập lại trên tất cả thiết bị" />

      {step === 1 ? (
        <View className="px-screen-edge mt-5 gap-4">
          <Text className="text-sm font-medium text-gray-700 ml-1">
            Số điện thoại mới:
          </Text>
          <Input
            placeholder="Nhập số điện thoại mới"
            value={phone}
            onChangeText={(value) => setPhone(value)}
          />

          <Button
            onPress={handleOnRequestOtp}
            className={`${loading ? "bg-secondary" : "bg-primary"} py-3 mt-4 w-full rounded-xl`}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text className="text-white font-bold text-base">Gửi mã OTP</Text>
            )}
          </Button>
        </View>
      ) : (
        <View className="flex px-screen-edge mt-5 mx-auto items-center gap-4 w-full">
          <MaterialIcons name="message" size={70} color={COLORS.primary} />
          <View className="items-center">
            <Text className="text-sm font-semibold text-center">
              Mã xác thực đã được gửi đến số{" "}
              <Text className="text-xl text-primary font-bold">{phone}</Text>
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              Hãy nhập mã xác thực để hoàn tất thay đổi
            </Text>
          </View>
          <OtpInput onChange={(code) => setOtp(code)} />
          <View className="mt-2">
            {timeLeft > 0 ? (
              <Text className="text-gray-500">
                Gửi lại mã trong{" "}
                <Text className="text-primary font-semibold">
                  {formatTime(timeLeft)}
                </Text>
              </Text>
            ) : (
              <Text
                onPress={handleOnResendOtp}
                className="text-primary font-semibold underline"
              >
                Gửi lại mã OTP
              </Text>
            )}
          </View>
          <Button
            onPress={handleOnConfirm}
            className={`${otp.length === 6 && !loading ? "bg-primary" : "bg-secondary"} py-3 mt-4 w-56 rounded-xl`}
            disabled={otp.length !== 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text className="text-white font-semibold text-sm">Xác nhận</Text>
            )}
          </Button>

          <Text
            onPress={() => setStep(1)}
            className="text-gray-400 text-xs mt-4 underline"
          >
            Thay đổi số điện thoại mới
          </Text>
        </View>
      )}
    </Container>
  );
}
