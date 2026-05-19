import { useEffect, useState } from "react";
import { X, Phone, MessageSquare, Users, Ban, User } from "lucide-react";
import AppAvatar from "../common/AppAvatar";
import { userService } from "@/services/user.service";
import { conversationService } from "@/services/conversation.service";
import { formatBirthday } from "@/utils/dateTimeFormat.util";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useCall } from "@/contexts/VideoCallContext";
import { CallType } from "@/constants/types";

type UserProfile = {
  name?: string;
  avatarUrl?: string;
  gender?: string;
  birthday?: string | Date | null;
};

type UserInformation = {
  _id?: string;
  phone?: string;
  email?: string;
  profile?: UserProfile;
};

type FriendProfileModalProps = {
  open: boolean;
  profileId?: string;
  onClose: () => void;
  onMessage?: () => void;
};

const getGenderText = (gender?: string) => {
  if (gender === "MALE") return "Nam";
  if (gender === "FEMALE") return "Nữ";
  if (gender === "OTHER") return "Khác";
  return "Chưa cập nhật";
};

export default function FriendProfileModal({
  open,
  profileId,
  onClose,
  onMessage,
}: FriendProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserInformation | null>(null);
  const [commonGroupsCount, setCommonGroupsCount] = useState(0);
  const userId = useSelector((item: any) => item.auth.user.userId);
  const { startDirectCall } = useCall();


  useEffect(() => {
    if (!open || !profileId) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const [profileRes, commonGroupsRes] = await Promise.all([
          userService.getProfile(profileId),
          conversationService.getCommonGroupsCount(profileId),
        ]);
        console.log("Profile response:", profileRes);
        setProfile(profileRes.data ?? null);
        setCommonGroupsCount(commonGroupsRes?.count ?? 0);
      } catch (error) {
        console.log(error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [open, profileId]);

  if (!open) return null;

  const displayName = profile?.profile?.name || "Người dùng";
  const displayAvatar = profile?.profile?.avatarUrl || "";
  const birthday = profile?.profile?.birthday
    ? formatBirthday(new Date(profile.profile.birthday))
    : "Chưa cập nhật";

  const handleVoiceCall = async () => {
    if (!profileId) {
      toast.error("Không tìm thấy người dùng để gọi");
      return;
    }

    try {
      const res = await conversationService.getOrCreateDirect(profileId);
      const conversationId = res?.data?.conversationId || res?.conversationId || res?.data?._id || res?._id;

      if (!conversationId) {
        toast.error("Không thể mở cuộc gọi");
        return;
      }

      startDirectCall(
        profileId,
        conversationId,
        CallType.VOICE,
        displayName,
        displayAvatar,
      );
    } catch (error) {
      console.error("Failed to start voice call:", error);
      toast.error("Không thể gọi điện lúc này");
    }
  };

    const handelBock = () => {
      const blockFriend = async () => {
        try {
          const data = await userService.blockFriend(profileId!, userId);
          if (data.data) {
            toast.success("Chặn bạn thành công !");
          }
        } catch (err) {
          console.log(err);
        }
      };
      blockFriend();
    };
  
    const handelDeleteFriend = () => {
      const deleteFriend = async () => {
        try {
          const data = await userService.cancelFriend(profileId!, userId);
          if (data.data) {
            toast.success("Xóa bạn thành công !");
          }
        } catch (err) {
          console.log(err);
        }
      };
      deleteFriend();
    };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-[400px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        style={{ maxHeight: "calc(100vh - 40px)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5">
          <h2 className="text-[15px] font-semibold text-gray-800">
            Thông tin tài khoản
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover image */}
          <div className="h-[160px] w-full bg-gray-200">
            <img
              src={displayAvatar || "https://images.unsplash.com/photo-1511203466129-824e631920d7?auto=format&fit=crop&w=800&q=80"}
              alt="cover"
              className="h-full w-full object-cover"
            />
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">
              Đang tải thông tin...
            </div>
          ) : (
            <div className="px-4 pb-3">
              {/* Avatar + Name */}
              <div className="-mt-8 mb-3 flex items-end gap-3">
                <AppAvatar
                  src={displayAvatar}
                  name={displayName}
                  className="h-16 w-16 border-[3px] border-white shadow-sm"
                />
                <h3 className="mb-1 text-[17px] font-semibold leading-tight text-gray-800">
                  {displayName}
                </h3>
              </div>

              {/* Action buttons */}
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleVoiceCall}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 py-[7px] text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <Phone size={15} />
                  Gọi điện
                </button>
                <button
                  onClick={onMessage}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#e5efff] py-[7px] text-[13px] font-semibold text-[#0068ff] transition-colors hover:bg-[#d6e5ff]"
                >
                  <MessageSquare size={15} />
                  Nhắn tin
                </button>
              </div>

              {/* Divider */}
              <div className="-mx-4 h-[6px] bg-[#f0f0f0]" />

              {/* Personal info */}
              <div className="py-3">
                <h4 className="mb-3 text-[14px] font-semibold text-gray-800">
                  Thông tin cá nhân
                </h4>
                <div className="space-y-2.5 text-[13px]">
                  <div className="flex gap-2">
                    <span className="w-[90px] shrink-0 text-gray-500">
                      Giới tính
                    </span>
                    <span className="text-gray-800">
                      {getGenderText(profile?.profile?.gender)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-[90px] shrink-0 text-gray-500">
                      Ngày sinh
                    </span>
                    <span className="text-gray-800">{birthday}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-[90px] shrink-0 text-gray-500">
                      Điện thoại
                    </span>
                    <span className="text-gray-800">
                      {profile?.phone || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="-mx-4 h-[6px] bg-[#f0f0f0]" />


              {/* Footer links */}
              <div className="space-y-1 py-2">
                <button className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-[13px] text-gray-700 transition-colors hover:bg-gray-50">
                  <Users size={18} className="text-gray-500" />
                  Nhóm chung ({commonGroupsCount})
                </button>
                <button onClick={() => handelBock()} className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-[13px] text-gray-700 transition-colors hover:bg-gray-50">
                  <Ban size={18} className="text-gray-500" />
                  Chặn tin nhắn và cuộc gọi
                </button>
                <button onClick={() => handelDeleteFriend()} className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-[13px] text-gray-700 transition-colors hover:bg-gray-50">
                  <User size={18} className="text-gray-500" />
                  Xóa kết bạn
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
