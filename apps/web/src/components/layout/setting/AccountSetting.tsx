import DeviceSettingDropdown from "@/components/common/setting/DeviceSettingDropdown";
import SettingChooseItem from "@/components/common/setting/SettingChooseItem";
import SettingSection from "@/components/common/setting/SettingSection";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  changePassword,
  getSessions,
  logOutDevice,
  logOutOther,
} from "@/store/auth/authThunk";
import type { Session } from "@/types/auth.type";
import { formatDateTime } from "@/utils/dateTimeFormat.util";
import { getDeviceId } from "@/utils/device.util";
import { Globe, Tablet, Smartphone, Ellipsis } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { NestedViewLayout } from "./NestedViewLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { handleFieldErrors } from "@/utils/handleErrors.util";

export default function AccountSetting() {
  const [currentView, setCurrentView] = useState<
    "main" | "devices" | "password"
  >("main");

  if (currentView === "devices") {
    return <DeviceManagementView onBack={() => setCurrentView("main")} />;
  } else if (currentView === "password") {
    return <ChangePassword onBack={() => setCurrentView("main")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Cá nhân">
        <SettingChooseItem>
          <p className="text-sm">Số điện thoại</p>
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
          className="border-none"
        >
          <p className="text-sm">Mật khẩu</p>
        </SettingChooseItem>
      </SettingSection>
    </div>
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
  const { loading } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const [sessions, setSessions] = useState<Session[]>();

  const fetchSessions = async () => {
    const rs = await dispatch(getSessions()).unwrap();
    setSessions(rs);
  };

  const onLogoutDevice = async (deviceId: string) => {
    try {
      await dispatch(logOutDevice(deviceId));
      setSessions(sessions?.filter((session) => session.deviceId != deviceId));
      toast.success("Đăng xuất thành công");
    } catch (err: any) {
      toast.error(err.message || "Đăng xuất không thành công");
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800">
                      {session.deviceName}
                    </p>
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
