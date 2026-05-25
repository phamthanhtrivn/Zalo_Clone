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
  onQrLoginSuccess,
  onQrScanned,
  requestQrCode,
} from "@/contexts/auth.socket";

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
                <div className="grid gap-6">
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
                      <Link
                        to="/forgot-password"
                        className="ml-auto text-sm text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline"
                      >
                        Quên mật khẩu ?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleOnLogin}>
                    Đăng nhập
                  </Button>
                </div>
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
