import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Key } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { useEffect, useState } from "react";
import { exchangeToken, signIn } from "@/store/auth/authThunk";
import { toast } from "react-toastify";
import { QRCodeSVG } from "qrcode.react";
import QRConfirmationView from "../layout/auth/QRConfirmationView";
import {
  onQrGenerated,
  onQrScanned,
  onQrLoginSuccess,
  requestQrCode,
} from "@/contexts/auth.socket";
import { OtpInput } from "@/components/ui/otp-input";
import { authService } from "@/services/auth.service";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loginMethod, setLoginMethod] = useState<"QR" | "PHONE">("QR");

  const [scannedUser, setScannedUser] = useState<{
    name: string;
    avatar: string;
  } | null>(null);
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const { accessToken } = useAppSelector((state) => state.auth);
  const [qrToken, setQrToken] = useState<string>("null");

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockStep, setUnlockStep] = useState<1 | 2>(1);
  const [unlockPhone, setUnlockPhone] = useState("");
  const [unlockOtp, setUnlockOtp] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleRequestUnlock = async () => {
    const trimmedPhone = unlockPhone.trim();
    if (!trimmedPhone) {
      toast.error("Vui lòng nhập số điện thoại");
      return;
    }

    try {
      setUnlockLoading(true);
      const res = await authService.requestUnlockAccount(trimmedPhone);
      toast.success(res.message || "Đã gửi mã OTP thành công");
      setTimeLeft(res.expiresIn || 120);
      setUnlockStep(2);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Yêu cầu gửi OTP thất bại");
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleConfirmUnlock = async () => {
    if (unlockOtp.length !== 6) {
      toast.error("Vui lòng nhập đầy đủ mã OTP 6 chữ số");
      return;
    }

    try {
      setUnlockLoading(true);
      const res = await authService.verifyUnlockAccount(unlockPhone.trim(), unlockOtp.trim());
      toast.success(res.message || "Tài khoản của bạn đã được mở khóa thành công!");
      setIsUnlocking(false);
      setPhone(unlockPhone);
      setUnlockOtp("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Mở khóa thất bại. Vui lòng thử lại");
    } finally {
      setUnlockLoading(false);
    }
  };

  useEffect(() => {
    requestQrCode();

    onQrGenerated((token) => {
      setQrToken(token);
    });

    onQrScanned((user) => {
      setScannedUser(user);
    });

    onQrLoginSuccess(async (ticket) => {
      try {
        await dispatch(exchangeToken(ticket)).unwrap();
        toast.success("Đăng nhập thành công qua QR!");
      } catch (err: any) {
        toast.error("Đổi vé thất bại: " + (err.message || "Lỗi hệ thống"));
        setScannedUser(null);
      }
    });
  }, [dispatch]);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  const handleOnLogin = async () => {
    try {
      await dispatch(signIn({ phone: phone, password: password })).unwrap();
      toast.success("Đăng nhập thành công");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.log(err);
      toast.error(err.message || "Đăng nhập không thành công!");
    }
  };

  if (isUnlocking) {
    return (
      <div className={cn("flex flex-col gap-6 items-center", className)} {...props}>
        <Card className="w-100">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Mở khóa tài khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              {unlockStep === 1 ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRequestUnlock();
                  }}
                  className="grid gap-4"
                >
                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    Nhập số điện thoại đăng ký để nhận mã OTP mở khóa tài khoản
                  </p>
                  <div className="grid gap-2 text-start">
                    <Label htmlFor="unlock-phone">Số điện thoại</Label>
                    <Input
                      id="unlock-phone"
                      type="tel"
                      placeholder="Nhập số điện thoại"
                      required
                      value={unlockPhone}
                      onChange={(e) => setUnlockPhone(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={unlockLoading}>
                    {unlockLoading ? "Đang gửi..." : "Gửi mã OTP"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsUnlocking(false)}
                  >
                    Quay lại đăng nhập
                  </Button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleConfirmUnlock();
                  }}
                  className="grid gap-4"
                >
                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    Nhập mã OTP 6 chữ số vừa được gửi đến số điện thoại <span className="font-semibold text-blue-600">{unlockPhone}</span>
                  </p>
                  <div className="grid gap-2 text-start">
                    <Label htmlFor="unlock-otp">Mã xác thực OTP</Label>
                    <OtpInput
                      value={unlockOtp}
                      onChange={setUnlockOtp}
                      disabled={unlockLoading}
                      autoFocus={unlockStep === 2}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={unlockLoading || unlockOtp.length !== 6}>
                    {unlockLoading ? "Đang mở khóa..." : "Mở khóa tài khoản"}
                  </Button>
                  <div className="text-center text-xs">
                    {timeLeft > 0 ? (
                      <span className="text-gray-400">
                        Gửi lại mã trong: <span className="font-semibold text-blue-600">{timeLeft}s</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestUnlock}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Gửi lại mã OTP
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setUnlockStep(1)}
                  >
                    Thay đổi số điện thoại
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6 items-center", className)} {...props}>
      {loginMethod === "PHONE" ? (
        <Card className="w-100">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Chào mừng trở lại</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="grid gap-6">
                <div className="flex flex-col gap-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setLoginMethod("QR")}
                  >
                    <QrCode />
                    Đăng nhập với QR Code
                  </Button>
                </div>
                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                  <span className="relative z-10 bg-background px-2 text-muted-foreground">
                    hoặc đăng nhập với mật khẩu
                  </span>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleOnLogin();
                  }}
                  className="grid gap-6"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Nhập số điện thoại"
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Mật khẩu</Label>
                      <div className="ml-auto flex gap-2 text-xs">
                        <Link
                          to="/forgot-password"
                          className="text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline"
                        >
                          Quên mật khẩu?
                        </Link>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUnlockStep(1);
                            setUnlockPhone(phone);
                            setIsUnlocking(true);
                          }}
                          className="text-red-500 hover:text-red-700 underline-offset-4 hover:underline font-medium"
                        >
                          Mở khóa tài khoản
                        </button>
                      </div>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Đăng nhập
                  </Button>
                </form>
                <div className="text-center text-sm">
                  Bạn chưa có tài khoản?{" "}
                  <Link to="/register" className="underline underline-offset-4 text-blue-600 hover:text-blue-800">
                    Đăng ký
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-110">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Chào mừng trở lại</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="grid gap-6">
                <div className="flex flex-col gap-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setLoginMethod("PHONE");
                    }}
                  >
                    <Key />
                    Đăng nhập với mật khẩu
                  </Button>
                </div>
                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                  <span className="relative z-10 bg-background px-2 text-muted-foreground">
                    hoặc đăng nhập với QR Code
                  </span>
                </div>
                {scannedUser ? (
                  // HIỆN AVATAR KHI ĐÃ QUÉT
                  <QRConfirmationView user={scannedUser} />
                ) : (
                  <div className="grid gap-6 justify-center">
                    <div className="flex flex-col gap-3 border-2 p-4 rounded-lg justify-center w-60">
                      {qrToken !== "null" ? (
                        <QRCodeSVG value={qrToken} size={200} />
                      ) : (
                        <div className="h-50 w-50 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-4 border-muted border-t-transparent" />
                        </div>
                      )}
                      <p className="text-center text-[15px] font-medium">
                        Dùng <span className="text-blue-600">Zola</span> trên
                        điện thoại đã đăng nhập để quét QR
                      </p>
                    </div>
                    <div className="text-center text-sm">
                      Bạn chưa có tài khoản?{" "}
                      <Link to="/register" className="underline underline-offset-4 text-blue-600 hover:text-blue-800">
                        Đăng ký
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary  ">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
