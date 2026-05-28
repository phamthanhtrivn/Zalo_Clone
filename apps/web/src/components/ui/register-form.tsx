import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { signUp, verifyOtp, completeSignUp } from "@/store/auth/authThunk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gender } from "@/types/enums/gender";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { OtpInput } from "./otp-input";

export function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { loading, tmp_token } = useAppSelector((state) => state.auth);

  // Wizard state: 1 = Phone input, 2 = OTP verification, 3 = Profile info
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [password, setPassword] = useState("");
  const [repassword, setRepassword] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showRepassword, setShowRepassword] = useState(false);

  // Validation errors
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [nameError, setNameError] = useState("");
  const [birthDayError, setBirthDayError] = useState("");
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

  const validateName = (n: string) => {
    // Matches: Each first letter of words must be capitalized
    const nameRegex = /^[A-ZÀ-Ỹ][a-zà-ỹ]*(\s[A-ZÀ-Ỹ][a-zà-ỹ]*)*$/;
    if (!n.trim()) {
      setNameError("Vui lòng nhập họ và tên của bạn");
      return false;
    }
    if (!nameRegex.test(n.trim())) {
      setNameError("Mỗi chữ cái đầu của từng từ phải viết hoa (ví dụ: Nguyen Van A)");
      return false;
    }
    setNameError("");
    return true;
  };

  const validateBirthDay = (d: string) => {
    if (!d) {
      setBirthDayError("Vui lòng chọn ngày sinh");
      return false;
    }
    const today = new Date();
    const birthDate = new Date(d);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 14) {
      setBirthDayError("Bạn phải đủ 14 tuổi trở lên để đăng ký");
      return false;
    }
    setBirthDayError("");
    return true;
  };

  const validatePassword = (pass: string) => {
    // Minimum 8 characters, at least 1 uppercase, 1 number, 1 special character
    const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!pass) {
      setPasswordError("Vui lòng nhập mật khẩu");
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

  // Step 1: Submit Phone Number
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(phone)) return;

    try {
      // Dispatch standard signUp thunk which posts to /api/auth/sign-up
      const result = await dispatch(signUp(phone)).unwrap();
      toast.success(result?.message || "Mã OTP đã được gửi đến thiết bị của bạn!");
      setOtp("");
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message || "Yêu cầu mã OTP thất bại. Số điện thoại có thể đã tồn tại.");
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
        purpose: "sign_up"
      };
      const result = await dispatch(verifyOtp(payload)).unwrap();
      toast.success(result?.message || "Xác thực OTP thành công!");
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message || "Mã OTP không đúng hoặc đã hết hạn.");
    }
  };

  // Step 3: Complete register
  const handleCompleteRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateName(name);
    const isBirthdayValid = validateBirthDay(birthDay);
    const isPasswordValid = validatePassword(password);

    if (password !== repassword) {
      setRepasswordError("Mật khẩu xác nhận không khớp");
      return;
    } else {
      setRepasswordError("");
    }

    if (!isNameValid || !isBirthdayValid || !isPasswordValid) return;

    try {
      const payload = {
        data: {
          name: name.trim(),
          birthDay: new Date(birthDay),
          gender,
          password,
          repassword
        },
        tempToken: tmp_token
      };

      await dispatch(completeSignUp(payload)).unwrap();
      toast.success("Đăng ký tài khoản thành công!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Lỗi hoàn tất đăng ký.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 items-center", className)} {...props}>
      <Card className="w-100">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === 1 && "Đăng ký tài khoản"}
            {step === 2 && "Xác thực số điện thoại"}
            {step === 3 && "Tạo hồ sơ cá nhân"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Nhập số điện thoại để bắt đầu"}
            {step === 2 && `Mã xác thực đã được gửi tới: ${phone}`}
            {step === 3 && "Hoàn thành hồ sơ cá nhân của bạn"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="grid gap-6">
              {/* Sleek Breadcrumb step progress */}
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
                  3. Tạo hồ sơ
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
                      placeholder="Nhập số điện thoại"
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
                      "Tiếp tục nhận OTP"
                    )}
                  </Button>

                  <div className="text-center text-sm">
                    Đã có tài khoản?{" "}
                    <Link to="/login" className="underline underline-offset-4 text-blue-600 hover:text-blue-800">
                      Đăng nhập ngay
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

                    {/* Nhớ import OtpInput ở trên đầu file nhé */}
                    <OtpInput
                      value={otp}
                      onChange={setOtp}
                      error={otpError}
                      disabled={loading}
                      autoFocus={step === 2}
                    />

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

              {/* STEP 3: Complete register */}
              {step === 3 && (
                <form onSubmit={handleCompleteRegister} className="grid gap-4">
                  {/* Phone number read-only */}
                  <div className="grid gap-1">
                    <Label className="text-left text-xs font-semibold text-muted-foreground">Số điện thoại</Label>
                    <div className="bg-muted text-muted-foreground text-sm font-medium py-1.5 px-3 rounded border text-left">
                      {phone}
                    </div>
                  </div>

                  {/* Họ và tên */}
                  <div className="grid gap-1">
                    <Label htmlFor="name" className="text-left">Họ và tên</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (nameError) validateName(e.target.value);
                      }}
                      className={cn(nameError && "border-red-500 focus-visible:ring-red-500")}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground text-left mt-0.5 leading-normal">
                      Lưu ý: Mỗi từ phải bắt đầu bằng chữ viết hoa (ví dụ: Trần Văn Hoàng)
                    </p>
                    {nameError && (
                      <p className="text-xs text-red-500 text-left font-medium">{nameError}</p>
                    )}
                  </div>

                  {/* Ngày sinh */}
                  <div className="grid gap-1">
                    <Label htmlFor="birthday" className="text-left">Ngày sinh</Label>
                    <Input
                      id="birthday"
                      type="date"
                      value={birthDay}
                      onChange={(e) => {
                        setBirthDay(e.target.value);
                        if (birthDayError) validateBirthDay(e.target.value);
                      }}
                      className={cn(birthDayError && "border-red-500 focus-visible:ring-red-500")}
                      required
                    />
                    {birthDayError && (
                      <p className="text-xs text-red-500 text-left font-medium">{birthDayError}</p>
                    )}
                  </div>

                  {/* Giới tính */}
                  <div className="grid gap-1">
                    <Label className="text-left">Giới tính</Label>
                    <div className="flex gap-4 mt-1">
                      <label className="flex-1 flex items-center justify-center gap-2 border rounded-md py-2 px-3 cursor-pointer hover:bg-muted font-medium transition-colors text-sm">
                        <input
                          type="radio"
                          name="gender"
                          value={Gender.MALE}
                          checked={gender === Gender.MALE}
                          onChange={() => setGender(Gender.MALE)}
                          className="accent-blue-600"
                        />
                        Nam
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 border rounded-md py-2 px-3 cursor-pointer hover:bg-muted font-medium transition-colors text-sm">
                        <input
                          type="radio"
                          name="gender"
                          value={Gender.FEMALE}
                          checked={gender === Gender.FEMALE}
                          onChange={() => setGender(Gender.FEMALE)}
                          className="accent-blue-600"
                        />
                        Nữ
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 border rounded-md py-2 px-3 cursor-pointer hover:bg-muted font-medium transition-colors text-sm">
                        <input
                          type="radio"
                          name="gender"
                          value={Gender.OTHER}
                          checked={gender === Gender.OTHER}
                          onChange={() => setGender(Gender.OTHER)}
                          className="accent-blue-600"
                        />
                        Khác
                      </label>
                    </div>
                  </div>

                  {/* Mật khẩu */}
                  <div className="grid gap-1">
                    <Label htmlFor="pass" className="text-left">Mật khẩu</Label>
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

                  {/* Nhập lại mật khẩu */}
                  <div className="grid gap-1">
                    <Label htmlFor="repass" className="text-left">Xác nhận mật khẩu</Label>
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
                        Đang hoàn tất...
                      </>
                    ) : (
                      "Hoàn tất đăng ký"
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
  )
};