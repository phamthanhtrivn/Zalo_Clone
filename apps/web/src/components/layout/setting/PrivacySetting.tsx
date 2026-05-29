import SettingChooseItem from "@/components/common/setting/SettingChooseItem";
import SettingSection from "@/components/common/setting/SettingSection";
import { useEffect, useState } from "react";
import { NestedViewLayout } from "./NestedViewLayout";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/user.service";
import { useAppSelector, useAppDispatch } from "@/store";
import { updatePrivacy } from "@/store/auth/authSlice";
import { Switch } from "@/components/ui/switch";
import { Ban, Loader2, UserMinus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { conversationService } from "@/services/conversation.service";

export default function PrivacySetting() {
  const [currentView, setCurrentView] = useState<"main" | "blocked">("main");
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const hideActiveStatus = user?.privacy?.hideActiveStatus || false;
  const isShowActiveStatus = !hideActiveStatus;

  const handleToggleActiveStatus = async (checked: boolean) => {
    const newHideValue = !checked;

    // Optimistic Update
    dispatch(updatePrivacy({ hideActiveStatus: newHideValue }));

    try {
      const res = await userService.updatePrivacySettings({ hideActiveStatus: newHideValue });

      if (res?.success) {
        toast.success(
          checked
            ? "Đã bật hiển thị trạng thái truy cập"
            : "Đã ẩn trạng thái truy cập"
        );
      } else {
        throw new Error("Không thể cập nhật cấu hình riêng tư");
      }
    } catch (error: any) {
      // Rollback on error
      dispatch(updatePrivacy({ hideActiveStatus: !newHideValue }));
      console.error("Lỗi khi cập nhật trạng thái riêng tư:", error);
      toast.error(error?.response?.data?.message || error?.message || "Lỗi cập nhật cấu hình !");
    }
  };

  // Fetch blocked list to show count on main tab
  const { data: blockedData, refetch } = useQuery({
    queryKey: ["blockedFriends"],
    queryFn: () => userService.getBlockedFriends(),
  });

  useEffect(() => {
    const handleFriendBlocked = () => {
      queryClient.invalidateQueries({ queryKey: ["blockedFriends"] });
      refetch();
    };
    window.addEventListener("friendBlocked", handleFriendBlocked);
    return () => {
      window.removeEventListener("friendBlocked", handleFriendBlocked);
    };
  }, [queryClient, refetch]);

  const blockedCount = blockedData?.data?.users?.length || 0;

  if (currentView === "blocked") {
    return <BlockedFriendsView onBack={() => setCurrentView("main")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Quyền riêng tư">
        <SettingChooseItem onClick={() => setCurrentView("blocked")}>
          <div className="flex justify-between items-center w-full">
            <div>
              <p className="text-sm text-gray-800">Danh sách chặn</p>
            </div>
            {blockedCount > 0 ? (
              <span className="bg-red-50 text-red-600 border border-red-100 text-[11px] font-semibold rounded-full px-2 py-0.5">
                Đang chặn {blockedCount}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Trống</span>
            )}
          </div>
        </SettingChooseItem>

        <SettingChooseItem
          onClick={() => handleToggleActiveStatus(!isShowActiveStatus)}
          className="text-left"
          rightSection={
            <Switch
              checked={isShowActiveStatus}
              onCheckedChange={handleToggleActiveStatus}
              onClick={(e) => e.stopPropagation()}
            />
          }
        >
          <div className="flex flex-col gap-1 text-left">
            <p className="text-sm text-gray-800 font-medium">Hiện trạng thái truy cập</p>
            <p className="text-xs text-gray-400 max-w-[400px]">
              Khi tắt, bạn bè sẽ không thấy bạn hoạt động và bạn cũng không thấy trạng thái hoạt động của họ.
            </p>
          </div>
        </SettingChooseItem>
      </SettingSection>
    </div>
  );
}

function BlockedFriendsView({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  // Fetch blocked list using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ["blockedFriends"],
    queryFn: () => userService.getBlockedFriends(),
  });

  // Mutation for unblocking a friend
  const unblockMutation = useMutation({
    mutationFn: ({ friendId }: { friendId: string }) => {
      if (!user?.userId) return Promise.reject("User not logged in");
      return userService.cancelFriend(friendId, user.userId);
    },
    onSuccess: (_, variables) => {
      toast.success("Bỏ chặn thành công");
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["blockedFriends"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Không thể bỏ chặn người dùng này");
    },
  });

  const blockedUsers = data?.data?.users || [];

  return (
    <NestedViewLayout title="Danh sách chặn" onBack={onBack}>
      <div className="flex flex-col gap-4">
        <SettingSection
          title={`Người dùng đã chặn (${blockedUsers.length})`}
          className="p-3"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#005ae0]" />
              <p className="text-xs text-gray-500">Đang tải danh sách chặn...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-sm text-red-500">
              Có lỗi xảy ra khi tải dữ liệu.
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ban className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-500">
                Danh sách chặn trống
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-[240px]">
                Những người bạn đã chặn tin nhắn hoặc cuộc gọi sẽ hiển thị ở đây.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 max-h-[350px] overflow-y-auto custom-scrollbar">
              {blockedUsers.map((blocked: any) => (
                <div
                  key={blocked.friendId}
                  className="flex items-center justify-between py-3 px-1 transition-colors hover:bg-gray-50/50"
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={async () => {
                      try {
                        const response = await conversationService.getOrCreateDirect(blocked.friendId);
                        const conversationId = response?.data?._id || response?.data?.conversationId || response?._id;
                        if (conversationId) {
                          navigate(`/conversation/${conversationId}`, {
                            state: {
                              conversation: {
                                conversationId,
                                type: "DIRECT",
                                name: blocked.name,
                                avatar: blocked.avatarUrl,
                                otherMemberId: blocked.friendId,
                              }
                            }
                          });
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  >
                    <img
                      src={blocked.avatarUrl || "/default-avatar.png"}
                      alt={blocked.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/default-avatar.png";
                      }}
                      className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm shrink-0"
                    />
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-gray-800">
                        {blocked.name}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      unblockMutation.mutate({ friendId: blocked.friendId });
                    }}
                    disabled={unblockMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold cursor-pointer shrink-0"
                  >
                    {unblockMutation.isPending &&
                      unblockMutation.variables?.friendId === blocked.friendId ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Đang gỡ...
                      </>
                    ) : (
                      <>
                        <UserMinus className="w-3.5 h-3.5 mr-1" />
                        Bỏ chặn
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SettingSection>
      </div>
    </NestedViewLayout>
  );
}
