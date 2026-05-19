import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { forgotPassword, verifyOtp, resetPassword } from "@/store/auth/authThunk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { loading, tmp_token } = useAppSelector((state) => state.auth);

  // Wizard state: 1 = Phone input, 2 = OTP verification, 3 = Reset password
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [phone, setPhone] = useState("");
  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(""));
  const otp = otpArray.join("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
    }
  }, [step]);

  const handleOtpChange = (value: string, index: number) => {
    const cleanValue = value.replace(/[^0-9]/g, "");
    if (!cleanValue) {
      const newOtp = [...otpArray];
      newOtp[index] = "";
      setOtpArray(newOtp);
      return;
    }

    const char = cleanValue[cleanValue.length - 1];
    const newOtp = [...otpArray];
    newOtp[index] = char;
    setOtpArray(newOtp);

    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otpArray[index] && index > 0) {
        const newOtp = [...otpArray];
        newOtp[index - 1] = "";
        setOtpArray(newOtp);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otpArray];
        newOtp[index] = "";
        setOtpArray(newOtp);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/[^0-9]/g, "").slice(0, 6);

    if (digits.length > 0) {
      const newOtp = [...otpArray];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || "";
      }
      setOtpArray(newOtp);

      const focusIndex = Math.min(digits.length, 5);
      otpRefs.current[focusIndex]?.focus();
    }
  };

  const [password, setPassword] = useState("");
  const [repassword, setRepassword] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showRepassword, setShowRepassword] = useState(false);

  // Validation errors
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [repasswordError, setRepasswordError] = useState("");

  // Validation helpers
  const validatePhone = (p: string) => {
    const phoneRegex = /^(0|84)[3|5|7|8|9][0-9]{8}$/;
    if (!p) {
      setPhoneError("Vui lòng nhập số điện thoại");
      return false;
    }
    if (!phoneRegex.test(p)) {
      setPhoneError("Số điện thoại không hợp lệ (ví dụ: 0912345678)");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validatePassword = (pass: string) => {
    const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!pass) {
      setPasswordError("Vui lòng nhập mật khẩu mới");
      return false;
    }
    if (!passRegex.test(pass)) {
      setPasswordError(
        "Mật khẩu phải có ít nhất 8 ký tự, 1 chữ in hoa, 1 số và 1 ký tự đặc biệt"
      );
      return false;
    }
    setPasswordError("");
    return true;
  };

  // ----- Step Actions -----

  // Step 1: Submit Phone Number for Forgot Password
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(phone)) return;

    try {
      const result = await dispatch(forgotPassword(phone)).unwrap();
      toast.success(result?.message || "Mã OTP đã được gửi đến thiết bị của bạn!");
      setOtpArray(Array(6).fill(""));
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message || "Số điện thoại chưa đăng ký hoặc có lỗi xảy ra.");
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setOtpError("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }
    setOtpError("");

    try {
      const payload = {
        phone,
        otp,
        purpose: "forgot_password"
      };
      const result = await dispatch(verifyOtp(payload)).unwrap();
      toast.success(result?.message || "Xác thực OTP thành công!");
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message || "Mã OTP không đúng hoặc đã hết hạn.");
    }
  };

  // Step 3: Complete Reset Password
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const isPasswordValid = validatePassword(password);

    if (password !== repassword) {
      setRepasswordError("Mật khẩu xác nhận không khớp");
      return;
    } else {
      setRepasswordError("");
    }

    if (!isPasswordValid) return;

    try {
      const payload = {
        data: {
          newPassword: password,
          confirmPassword: repassword
        },
        tempToken: tmp_token
      };

      await dispatch(resetPassword(payload)).unwrap();
      toast.success("Đặt lại mật khẩu thành công!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Lỗi đặt lại mật khẩu.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 items-center", className)} {...props}>
      <Card className="w-100">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === 1 && "Quên mật khẩu"}
            {step === 2 && "Xác thực số điện thoại"}
            {step === 3 && "Đặt lại mật khẩu mới"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Nhập số điện thoại để lấy lại mật khẩu"}
            {step === 2 && `Mã xác thực đã được gửi tới: ${phone}`}
            {step === 3 && "Thiết lập mật khẩu mới cho tài khoản của bạn"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="grid gap-6">
              {/* Step Progress Tracker */}
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/50 py-1.5 px-3 rounded-lg select-none mb-1">
                <span className={cn(step === 1 ? "text-blue-600 font-bold" : step > 1 ? "text-green-600" : "")}>
                  1. Số điện thoại
                </span>
                <span className="text-muted-foreground/30">/</span>
                <span className={cn(step === 2 ? "text-blue-600 font-bold" : step > 2 ? "text-green-600" : "")}>
                  2. Xác thực OTP
                </span>
                <span className="text-muted-foreground/30">/</span>
                <span className={cn(step === 3 ? "text-blue-600 font-bold" : "")}>
                  3. Đổi mật khẩu
                </span>
              </div>

              {/* STEP 1: Phone input */}
              {step === 1 && (
                <form onSubmit={handleRequestOtp} className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-left">Số điện thoại</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Nhập số điện thoại của bạn"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneError) validatePhone(e.target.value);
                      }}
                      className={cn(phoneError && "border-red-500 focus-visible:ring-red-500")}
                      required
                    />
                    {phoneError && (
                      <p className="text-xs text-red-500 text-left mt-0.5 font-medium">{phoneError}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Đang gửi OTP...
                      </>
                    ) : (
                      "Tiếp tục"
                    )}
                  </Button>

                  <div className="text-center text-sm">
                    Quay lại{" "}
                    <Link to="/login" className="underline underline-offset-4 text-blue-600 hover:text-blue-800">
                      Đăng nhập
                    </Link>
                  </div>
                </form>
              )}

              {/* STEP 2: OTP verification */}
              {step === 2 && (
                <form onSubmit={handleVerifyOtp} className="grid gap-6">
                  <div className="grid gap-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="otp-0" className="text-left font-medium">Mã OTP</Label>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Đổi số điện thoại
                      </button>
                    </div>

                    <div className="flex justify-between gap-2">
                      {otpArray.map((digit, idx) => (
                        <Input
                          key={idx}
                          id={`otp-${idx}`}
                          ref={(el) => { otpRefs.current[idx] = el; }}
                          type="text"
                          maxLength={1}
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) => handleOtpChange(e.target.value, idx)}
                          onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                          onPaste={handleOtpPaste}
                          className={cn(
                            "w-12 h-12 text-center text-xl font-bold rounded-md border border-input focus-visible:ring-2 focus-visible:ring-blue-600 transition-all",
                            otpError ? "border-red-500 focus-visible:ring-red-500" : "border-input"
                          )}
                          required
                        />
                      ))}
                    </div>

                    {otpError && (
                      <p className="text-xs text-red-500 text-left mt-0.5 font-medium">{otpError}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Đang xác thực...
                      </>
                    ) : (
                      "Xác minh"
                    )}
                  </Button>

                  <div className="text-center text-sm">
                    Không nhận được mã?{" "}
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-blue-600 hover:underline font-semibold"
                      disabled={loading}
                    >
                      Gửi lại OTP
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Reset password */}
              {step === 3 && (
                <form onSubmit={handleCompleteReset} className="grid gap-4">
                  <div className="grid gap-1">
                    <Label className="text-left text-xs font-semibold text-muted-foreground">Số điện thoại</Label>
                    <div className="bg-muted text-muted-foreground text-sm font-medium py-1.5 px-3 rounded border text-left">
                      {phone}
                    </div>
                  </div>

                  {/* Mật khẩu mới */}
                  <div className="grid gap-1">
                    <Label htmlFor="pass" className="text-left">Mật khẩu mới</Label>
                    <div className="relative">
                      <Input
                        id="pass"
                        type={showPassword ? "text" : "password"}
                        placeholder="Tối thiểu 8 ký tự..."
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) validatePassword(e.target.value);
                        }}
                        className={cn("pr-10", passwordError && "border-red-500 focus-visible:ring-red-500")}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-xs text-red-500 text-left font-medium">{passwordError}</p>
                    )}
                  </div>

                  {/* Xác nhận mật khẩu mới */}
                  <div className="grid gap-1">
                    <Label htmlFor="repass" className="text-left">Xác nhận mật khẩu mới</Label>
                    <div className="relative">
                      <Input
                        id="repass"
                        type={showRepassword ? "text" : "password"}
                        placeholder="Nhập lại mật khẩu để xác nhận"
                        value={repassword}
                        onChange={(e) => {
                          setRepassword(e.target.value);
                          if (repasswordError) setRepasswordError("");
                        }}
                        className={cn("pr-10", repasswordError && "border-red-500 focus-visible:ring-red-500")}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRepassword(!showRepassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRepassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {repasswordError && (
                      <p className="text-xs text-red-500 text-left font-medium">{repasswordError}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Đang đặt lại...
                      </>
                    ) : (
                      "Đặt lại mật khẩu"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        Bằng cách nhấn tiếp tục, bạn đồng ý với <a href="#">Điều khoản sử dụng</a>{" "}
        và <a href="#">Chính sách bảo mật</a> của chúng tôi.
      </div>
    </div>
  );
}
