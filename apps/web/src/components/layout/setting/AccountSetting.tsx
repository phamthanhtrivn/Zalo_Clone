import DeviceSettingDropdown from "@/components/common/setting/DeviceSettingDropdown";
import SettingChooseItem from "@/components/common/setting/SettingChooseItem";
import SettingSection from "@/components/common/setting/SettingSection";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  changePassword,
  getSessions,
  logOutDevice,
  logOutOther,
  requestUpdatePhone,
  verifyUpdatePhone,
  logOut,
} from "@/store/auth/authThunk";
import type { Session } from "@/types/auth.type";
import { formatDateTime } from "@/utils/dateTimeFormat.util";
import { getDeviceId } from "@/utils/device.util";
import { Globe, Tablet, Smartphone, Ellipsis, Ban } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { NestedViewLayout } from "./NestedViewLayout";
import { useSocket } from "@/contexts/SocketContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { handleFieldErrors } from "@/utils/handleErrors.util";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { authService } from "@/services/auth.service";

export default function AccountSetting() {
  const [currentView, setCurrentView] = useState<
    "main" | "devices" | "password" | "phone"
  >("main");
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [lockLoading, setLockLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  if (currentView === "devices") {
    return <DeviceManagementView onBack={() => setCurrentView("main")} />;
  } else if (currentView === "password") {
    return <ChangePassword onBack={() => setCurrentView("main")} />;
  } else if (currentView === "phone") {
    return <ChangePhoneView onBack={() => setCurrentView("main")} />;
  }

  const openLockDialog = () => {
    setLockPassword("");
    setLockDialogOpen(true);
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  const onConfirmLock = async () => {
    if (!lockPassword.trim()) {
      toast.error("Mật khẩu xác nhận không được để trống!");
      return;
    }
    setLockLoading(true);
    try {
      await authService.lockAccount(lockPassword.trim());
      toast.success("Khóa tài khoản thành công!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Không thể khóa tài khoản lúc này.");
    } finally {
      setLockLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <SettingSection title="Cá nhân">
          <SettingChooseItem onClick={() => setCurrentView("phone")}>
            <div className="flex justify-between items-center w-full">
              <p className="text-sm">Số điện thoại</p>
            </div>
          </SettingChooseItem>
          <SettingChooseItem>
            <p className="text-sm">Email</p>
          </SettingChooseItem>
        </SettingSection>
        <SettingSection title="Bảo mật">
          <SettingChooseItem onClick={() => setCurrentView("devices")}>
            <p className="text-sm">Thiết bị đăng nhập</p>
          </SettingChooseItem>
          <SettingChooseItem
            onClick={() => setCurrentView("password")}
            className="border-b-[0.5px] border-gray-100"
          >
            <p className="text-sm">Mật khẩu</p>
          </SettingChooseItem>
          <SettingChooseItem
            onClick={openLockDialog}
            className="border-none text-red-600 hover:bg-red-50"
          >
            <p className="text-sm font-semibold">Khóa tài khoản</p>
          </SettingChooseItem>
        </SettingSection>
      </div>

      {/* Lock Account Confirmation Dialog */}
      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận khóa tài khoản</AlertDialogTitle>
            <AlertDialogDescription>
              Tài khoản của bạn sẽ bị khóa và bạn sẽ bị đăng xuất ngay lập tức.
              Để mở khóa lại, hãy dùng chức năng{" "}
              <span className="font-medium text-gray-700">Mở khóa tài khoản</span>{" "}
              ở màn hình đăng nhập.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-sm font-medium text-gray-700">
              Nhập mật khẩu để xác nhận
            </label>
            <Input
              ref={passwordInputRef}
              type="password"
              placeholder="Mật khẩu của bạn"
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onConfirmLock()}
              className="h-9"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={lockLoading}>Hủy</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={onConfirmLock}
              disabled={lockLoading || !lockPassword.trim()}
              className="rounded-md"
            >
              {lockLoading ? "Đang xử lý..." : "Khóa tài khoản"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DeviceItemSkeleton() {
  return (
    <div className="flex justify-between items-center w-full p-4 border-b-[0.5px] border-gray-100">
      <div className="flex gap-3 items-center w-full">
        <div className="w-8 h-8 bg-gray-200 rounded-md animate-pulse shrink-0"></div>

        <div className="flex flex-col gap-2 w-full">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          <div className="h-3  bg-gray-200 rounded w-1/4 animate-pulse"></div>
        </div>
      </div>

      <div className="w-5 h-2  bg-gray-200 rounded animate-pulse shrink-0"></div>
    </div>
  );
}

function DeviceManagementView({ onBack }: { onBack: () => void }) {
  const { loading, user } = useAppSelector((state) => state.auth);
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const [sessions, setSessions] = useState<Session[]>();
  const [blockedDevices, setBlockedDevices] = useState<any[]>([]);
  const [deviceToBlock, setDeviceToBlock] = useState<string | null>(null);

  const fetchBlockedDevices = async () => {
    try {
      const res = await authService.getBlockedDevices();
      const normalized = res.map((d: any) => typeof d === 'string' ? { deviceId: d, deviceName: 'Thiết bị không xác định', deviceType: 'unknown' } : d);
      setBlockedDevices(normalized);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    const rs = await dispatch(getSessions()).unwrap();
    setSessions(rs);
  };

  useEffect(() => {
    if (!socket || !user?.userId) return;

    const handleDeviceStatusChange = (data: {
      userId: string;
      deviceId: string;
      isOnline: boolean;
    }) => {
      // Chỉ cập nhật trạng thái nếu thiết bị đó thuộc về user hiện tại
      if (data.userId === user.userId) {
        setSessions((prev) =>
          prev?.map((session) =>
            session.deviceId === data.deviceId
              ? { ...session, isOnline: data.isOnline }
              : session
          )
        );
      }
    };

    socket.on("device_status_change", handleDeviceStatusChange);
    return () => {
      socket.off("device_status_change", handleDeviceStatusChange);
    };
  }, [socket, user?.userId]);

  const onLogoutDevice = async (deviceId: string) => {
    try {
      await dispatch(logOutDevice(deviceId));
      setSessions(sessions?.filter((session) => session.deviceId != deviceId));
      toast.success("Đăng xuất thành công");
    } catch (err: any) {
      toast.error(err.message || "Đăng xuất không thành công");
    }
  };

  const onBlockDevice = async () => {
    if (!deviceToBlock) return;
    try {
      const targetSession = sessions?.find(s => s.deviceId === deviceToBlock);
      await authService.blockDevice(deviceToBlock);
      setSessions(sessions?.filter((session) => session.deviceId != deviceToBlock));
      const newBlock = {
        deviceId: deviceToBlock,
        deviceName: targetSession?.deviceName || 'Thiết bị không xác định',
        deviceType: targetSession?.deviceType || 'unknown',
        location: targetSession?.location || 'Không xác định',
        blockedAt: new Date().toISOString()
      };
      setBlockedDevices([...blockedDevices, newBlock]);
      setDeviceToBlock(null);
      toast.success("Đã chặn thiết bị thành công");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Chặn thiết bị không thành công");
    }
  };

  const onUnblockDevice = async (deviceId: string) => {
    try {
      await authService.unblockDevice(deviceId);
      setBlockedDevices(blockedDevices.filter((d) => d.deviceId !== deviceId));
      toast.success("Đã bỏ chặn thiết bị thành công");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Bỏ chặn thiết bị không thành công");
    }
  };

  const onLogoutOtherDevices = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn đăng xuất tất cả các thiết bị khác không?")) return;
    try {
      await dispatch(logOutOther()).unwrap();
      const currentDevId = getDeviceId();
      setSessions(sessions?.filter((session) => session.deviceId === currentDevId));
      toast.success("Đăng xuất tất cả thiết bị khác thành công");
    } catch (err: any) {
      toast.error(err?.message || "Đăng xuất không thành công");
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchBlockedDevices();
  }, []);

  const otherSessionsCount = sessions ? sessions.filter((s) => s.deviceId !== getDeviceId()).length : 0;

  return (
    // Bọc toàn bộ bằng Component mới, truyền title và onBack vào
    <NestedViewLayout title="Quản lý thiết bị đăng nhập" onBack={onBack}>
      {otherSessionsCount > 0 && (
        <div className="flex justify-between items-center px-4 py-3 bg-red-50 border border-red-100 rounded-lg mb-4">
          <span className="text-xs text-red-700 font-medium">
            Đang có {otherSessionsCount} thiết bị khác đăng nhập tài khoản của bạn.
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={onLogoutOtherDevices}
            disabled={loading}
            className="text-xs px-3 py-1.5 h-auto bg-red-600 hover:bg-red-700 text-white rounded-md shrink-0 font-semibold"
          >
            Đăng xuất tất cả thiết bị khác
          </Button>
        </div>
      )}
      <SettingSection>
        {loading ? (
          <>
            <DeviceItemSkeleton />
            <DeviceItemSkeleton />
            <DeviceItemSkeleton />
          </>
        ) : (
          sessions?.map((session, index) => (
            <SettingChooseItem
              key={index}
              rightSection={
                session.deviceId !== getDeviceId() ? (
                  <DeviceSettingDropdown
                    onLougout={() => onLogoutDevice(session.deviceId)}
                    onBlock={() => setDeviceToBlock(session.deviceId)}
                  />
                ) : (
                  <Ellipsis color="gray" />
                )
              }
            >
              <div className="flex gap-3 items-center">
                <div>
                  {session.deviceType === "browser" ? (
                    <Globe size={30} color="gray" />
                  ) : session.deviceType === "tablet" ? (
                    <Tablet color="gray" />
                  ) : (
                    <Smartphone color="gray" />
                  )}
                </div>
                <div className="flex flex-col gap-1 text-sm text-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800">
                      {session.deviceName}
                    </p>
                    {session.isOnline && (
                      <span className="flex items-center gap-1 bg-green-50 text-green-600 border border-green-100 text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Đang hoạt động
                      </span>
                    )}
                    {session.deviceId === getDeviceId() && (
                      <p className="bg-blue-500 text-[11px] font-medium text-white rounded-full py-0.5 px-2">
                        Thiết bị này
                      </p>
                    )}
                  </div>
                  <p className="text-gray-500 text-[13px]">
                    Đăng nhập {formatDateTime(session.createdAt)}
                  </p>
                  <p className="text-gray-500 text-[13px]">
                    {session.location}
                  </p>
                </div>
              </div>
            </SettingChooseItem>
          ))
        )}
      </SettingSection>

      {blockedDevices.length > 0 && (
        <SettingSection title="Thiết bị đã chặn" className="mt-4">
          {blockedDevices.map((device, index) => (
            <SettingChooseItem
              key={index}
              rightSection={
                <Button size="sm" variant="outline" onClick={() => onUnblockDevice(device.deviceId)}>
                  Bỏ chặn
                </Button>
              }
            >
              <div className="flex gap-3 items-center opacity-75">
                <div>
                  {device.deviceType === "browser" ? (
                    <Globe size={30} color="#ef4444" />
                  ) : device.deviceType === "tablet" ? (
                    <Tablet color="#ef4444" />
                  ) : (
                    <Smartphone color="#ef4444" />
                  )}
                </div>
                <div className="flex flex-col gap-1 text-sm text-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800 line-through">
                      {device.deviceName}
                    </p>
                    <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-semibold rounded-full px-2 py-0.5">
                      Đã chặn
                    </span>
                  </div>
                  {device.blockedAt && (
                    <p className="text-[11px] text-gray-500">
                      Thời gian chặn: {formatDateTime(device.blockedAt)}
                    </p>
                  )}
                  {device.location && (
                    <p className="text-[11px] text-gray-500">
                      Vị trí: {device.location}
                    </p>
                  )}
                </div>
              </div>
            </SettingChooseItem>
          ))}
        </SettingSection>
      )}

      <AlertDialog open={!!deviceToBlock} onOpenChange={(open) => !open && setDeviceToBlock(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Chặn thiết bị</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn chặn thiết bị này? Thiết bị sẽ bị đăng xuất và không thể đăng nhập lại vào tài khoản của bạn cho đến khi được bỏ chặn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={onBlockDevice}
            >
              Chặn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NestedViewLayout>
  );
}

function ChangePassword({ onBack }: { onBack: () => void }) {
  const { loading } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [matchConfirmPass, setMatchConfirmPass] = useState<boolean>(true);

  const onChangePassword = async () => {
    try {
      setFieldErrors({});
      setMatchConfirmPass(confirmPassword === newPassword);

      if (confirmPassword !== "" && !matchConfirmPass) {
        return;
      }

      await dispatch(
        changePassword({
          oldPassword: oldPassword,
          confirmPassword: confirmPassword,
          newPassword: newPassword,
        }),
      ).unwrap();

      onBack();
      toast.success("Đổi mật khẩu thành công");
    } catch (err: any) {
      const map = handleFieldErrors(err);
      setFieldErrors(map || {});
      toast.error(err?.message || "Đổi mật khẩu không thành công");
    }
  };

  return (
    <NestedViewLayout title="Đổi mật khẩu" onBack={onBack}>
      <div className="flex flex-col gap-4">
        <SettingSection
          title="Mật khẩu mới"
          className="flex flex-col gap-5 p-3 "
        >
          <p className="text-sm ">
            Mật khẩu phải có ít nhất 8 chữ số bao gồm ít nhất một chữ in hoa, ít
            nhất một ký tự và ít nhất một chữ số
          </p>
          <div>
            <p className="text-sm mb-2">Mật khẩu cũ</p>
            <Input
              type="password"
              placeholder="Mật khẩu cũ"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
            />
            {fieldErrors.oldPassword && (
              <p className="text-red-500 text-sm mt-1">
                {fieldErrors.oldPassword}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm mb-2">Mật khẩu mới</p>
            <Input
              type="password"
              placeholder="Mật khẩu mới"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            {fieldErrors.newPassword && (
              <p className="text-red-500 text-sm mt-1">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm mb-2">Xác nhận mật khẩu mới</p>
            <Input
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {fieldErrors.confirmPassword ? (
              <p className="text-red-500 text-sm mt-1">
                {fieldErrors.confirmPassword}
              </p>
            ) : !matchConfirmPass && confirmPassword !== "" ? (
              <p className="text-red-500 text-sm mt-1">
                Mật khẩu xác nhận không khớp
              </p>
            ) : null}
          </div>
          <Button className="w-44" onClick={onChangePassword}>
            Đổi mật khẩu
          </Button>
        </SettingSection>
      </div>
    </NestedViewLayout>
  );
}

function ChangePhoneView({ onBack }: { onBack: () => void }) {
  const { loading } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (step === 2) {
      const timer = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleOnRequestOtp = async () => {
    if (!phone) {
      toast.error("Vui lòng nhập số điện thoại mới !");
      return;
    }
    const phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("Số điện thoại không hợp lệ !");
      return;
    }

    try {
      setFieldErrors({});
      await dispatch(requestUpdatePhone(phone)).unwrap();
      toast.success("Mã OTP đã được gửi tới số điện thoại mới.");
      setTimeLeft(120);
      setStep(2);
    } catch (err: any) {
      const map = handleFieldErrors(err);
      setFieldErrors(map || {});
      toast.error(err?.message || "Yêu cầu gửi OTP thất bại !");
    }
  };

  const handleOnResendOtp = async () => {
    if (timeLeft > 0) return;
    try {
      await dispatch(requestUpdatePhone(phone)).unwrap();
      toast.success("Mã OTP đã được gửi lại.");
      setTimeLeft(120);
    } catch (err: any) {
      toast.error(err?.message || "Gửi lại OTP thất bại !");
    }
  };

  const handleOnConfirm = async () => {
    if (otp.length !== 6) {
      toast.error("Vui lòng nhập đầy đủ mã OTP 6 chữ số !");
      return;
    }

    try {
      await dispatch(verifyUpdatePhone({ phone, otp })).unwrap();
      toast.success("Cập nhật số điện thoại thành công! Vui lòng đăng nhập lại.");

      // Đăng xuất cưỡng chế
      dispatch(logOut());
    } catch (err: any) {
      toast.error(err?.message || "Xác thực OTP thất bại !");
    }
  };

  return (
    <NestedViewLayout title="Cập nhật số điện thoại" onBack={onBack}>
      <div className="flex flex-col gap-4">
        <SettingSection
          title="Thông tin số điện thoại mới"
          className="flex flex-col gap-5 p-3"
        >
          <p className="text-sm text-gray-500">
            Cập nhật số điện thoại mới sẽ yêu cầu bạn đăng nhập lại trên tất cả các thiết bị.
          </p>

          {step === 1 ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm mb-2 font-medium">Số điện thoại mới</p>
                <Input
                  type="text"
                  placeholder="Nhập số điện thoại mới (ví dụ: 0987654321)"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                {fieldErrors.phone && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.phone}</p>
                )}
              </div>
              <Button className="w-44 mt-2" onClick={handleOnRequestOtp} disabled={loading}>
                {loading ? "Đang xử lý..." : "Gửi mã OTP"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 items-start w-full">
              <div className="w-full">
                <p className="text-sm font-semibold mb-1">
                  Mã xác thực đã được gửi đến số:{" "}
                  <span className="text-blue-600 font-bold">{phone}</span>
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Hãy nhập mã xác thực 6 chữ số để hoàn tất thay đổi
                </p>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="Nhập mã OTP 6 chữ số"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="text-center font-bold tracking-widest text-lg h-12 w-full max-w-[240px]"
                />
              </div>

              <div className="text-sm text-gray-500">
                {timeLeft > 0 ? (
                  <p>
                    Gửi lại mã trong:{" "}
                    <span className="text-blue-600 font-semibold">{formatTime(timeLeft)}</span>
                  </p>
                ) : (
                  <button
                    onClick={handleOnResendOtp}
                    className="text-blue-600 font-semibold underline hover:text-blue-700"
                  >
                    Gửi lại mã OTP
                  </button>
                )}
              </div>

              <div className="flex gap-3 mt-2">
                <Button className="w-44" onClick={handleOnConfirm} disabled={otp.length !== 6 || loading}>
                  {loading ? "Đang xác thực..." : "Xác nhận"}
                </Button>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-400 underline hover:text-gray-500 shrink-0 self-center"
                >
                  Thay đổi số điện thoại mới
                </button>
              </div>
            </div>
          )}
        </SettingSection>
      </div>
    </NestedViewLayout>
  );
}

