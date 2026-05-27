import Button from "@/components/common/Button";
import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import Input from "@/components/common/TextInput";
import Tips from "@/components/auth/Tips";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { showToast } from "@/utils/toast";
import { useMutation } from "@tanstack/react-query";
// Nhớ import authService từ file service tương ứng của ông
import { authService } from "@/services/auth.service";

export default function LockAccountScreen() {
    const router = useRouter();

    const [password, setPassword] = useState<string>("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isHiddenPass, setHiddenPass] = useState<boolean>(true);

    // Dùng useMutation để tự động hóa trạng thái loading và bắt lỗi
    const { mutate: lockAccountMutate, isPending } = useMutation({
        mutationFn: (pass: string) => authService.lockAccount(pass),
        onSuccess: () => {
            showToast("Khóa tài khoản thành công!");
            // Thường khóa xong thì đá văng nó ra trang đăng nhập luôn
            router.replace("/login");
        },
        onError: (err: any) => {
            // Xử lý lỗi trả về từ server (nếu có mảng errors)
            if (err && err.errors && Array.isArray(err.errors)) {
                const errorsObj: Record<string, string> = {};
                err.errors.forEach((item: any) => {
                    if (item.field) {
                        errorsObj[item.field] = item.error;
                    }
                });
                setFieldErrors(errorsObj);
            } else {
                // Hiển thị lỗi chung (sai mật khẩu, lỗi mạng...)
                showToast(
                    err?.response?.data?.message ||
                    err?.message ||
                    "Không thể khóa tài khoản lúc này."
                );
            }
        }
    });

    const handleConfirmLock = () => {
        // Chỉ cần check lại cho chắc cú, xóa lỗi cũ rồi nã API luôn
        setFieldErrors({});
        lockAccountMutate(password.trim());
    };

    return (
        <Container>
            <Header
                back
                gradient
                centerChild={
                    <Text className="text-white text-sm font-semibold">Khóa tài khoản</Text>
                }
            />
            <Tips text="Nhập mật khẩu để xác nhận khóa tài khoản. Cảnh báo: Bạn sẽ không thể đăng nhập lại cho đến khi mở khóa!" />

            <View className="px-screen-edge mt-2 gap-3">
                <Input
                    placeholder="Mật khẩu của bạn"
                    value={password} // Đã thêm value
                    onChangeText={(text) => { // Đã thêm hàm bắt sự kiện gõ phím
                        setPassword(text);
                        if (fieldErrors.password) setFieldErrors({});
                    }}
                    security={isHiddenPass}
                    onPressOnIcon={() => setHiddenPass(!isHiddenPass)}
                    icon={isHiddenPass ? `eye-off-outline` : `eye-outline`}
                />

                {/* Hiển thị lỗi ngay dưới ô input nếu bị rỗng hoặc sai */}
                {fieldErrors.password && (
                    <Text className="text-red-600 text-xs mt-1 ml-1 font-medium">
                        {fieldErrors.password}
                    </Text>
                )}

                <Button
                    onPress={handleConfirmLock}
                    disabled={isPending || !password.trim()}
                    className={`bg-red-500 py-3 mt-4 w-full rounded-xl ${(isPending || !password.trim()) ? "opacity-50" : "opacity-100"
                        }`}
                >
                    {isPending ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-base">
                            Xác nhận khóa
                        </Text>
                    )}
                </Button>
            </View>
        </Container>
    );
}