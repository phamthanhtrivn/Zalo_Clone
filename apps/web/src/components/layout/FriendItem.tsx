import { Ban, MoreHorizontal, MessageCircle, Trash2, UserRound } from "lucide-react";
import AppAvatar from "../common/AppAvatar";
import { useEffect, useState } from "react";
import { userService } from "@/services/user.service";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { conversationService } from "@/services/conversation.service";
import { toast } from "react-toastify";
import FriendProfileModal from "./FriendProfileModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const FriendItem = ({ item, setFriends }: any) => {
  const [openId, setOpenId] = useState<string>("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const navigate = useNavigate();
  const userId = useSelector((item: any) => item.auth.user.userId);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId("");
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleStartConversation = async (targetUserId: string) => {
    try {
      const response =
        await conversationService.getOrCreateDirect(targetUserId);
      const conversationId =
        response?.data?._id || response?.data?.conversationId || response?._id;

      if (!conversationId) return;

      setOpenId("");
      navigate(`/conversation/${conversationId}`);
    } catch (error) {
      console.log(error);
    }
  };

  const [blockTargetId, setBlockTargetId] = useState<string | null>(null);

  const confirmBlock = () => {
    if (!blockTargetId) return;
    const blockFriend = async () => {
      try {
        const data = await userService.blockFriend(blockTargetId, userId);
        if (data.data) {
          setFriends((prev: any) =>
            prev
              .map((group: any) => ({
                ...group,
                friends: group.friends.filter(
                  (friend: any) => friend.friendId !== blockTargetId,
                ),
              }))
              .filter((group: any) => group.friends.length > 0),
          );
          toast.success("Chặn bạn thành công !");
        }
      } catch (err) {
        console.log(err);
      } finally {
        setBlockTargetId(null);
      }
    };
    blockFriend();
  };

  const handelDeleteFriend = (id: string) => {
    const deleteFriend = async () => {
      try {
        const data = await userService.cancelFriend(id, userId);
        if (data.data) {
          setFriends((prev: any) =>
            prev
              .map((group: any) => ({
                ...group,
                friends: group.friends.filter(
                  (friend: any) => friend.friendId !== id,
                ),
              }))
              .filter((group: any) => group.friends.length > 0),
          );
          toast.success("Xóa bạn thành công !");
        }
      } catch (err) {
        console.log(err);
      }
    };
    deleteFriend();
  };

  const handleOpenProfile = (friendId: string) => {
    setSelectedFriendId(friendId);
    setIsProfileOpen(true);
    setOpenId("");
  };

  const handleMessageFromProfile = async () => {
    if (!selectedFriendId) return;
    await handleStartConversation(selectedFriendId);
    setIsProfileOpen(false);
  };

  return (
    <div key={item.key}>
      <div>
        <span className="text-[16px] font-semibold text-gray-800">
          {item.key}
        </span>
      </div>
      {item.friends.map((f: any) => (
        <div
          key={f.friendId}
          className="mb-2 flex items-center justify-between rounded-lg px-2 py-3 hover:bg-gray-50"
        >
          <div
            className="flex items-center gap-3"
            onClick={() => handleStartConversation(f.friendId)}
          >
            <AppAvatar
              src={f?.avatarUrl}
              name={f?.name || "User"}
              className="w-12 h-12"
            />
            <p className="font-medium">{f?.name}</p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenId(openId == f.friendId ? "" : f.friendId)}
              className="rounded-full p-1 transition-colors hover:bg-gray-100"
            >
              <MoreHorizontal className="text-gray-500" />
            </button>
            {openId === f.friendId && (
              <>
                <button
                  type="button"
                  aria-label="Đóng menu"
                  className="fixed inset-0 z-40 cursor-default border border-gray-500"
                  onClick={() => setOpenId("")}
                />

                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
                  <div className="px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Tùy chọn
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenProfile(f.friendId)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-[14px] text-gray-800 transition-colors hover:bg-gray-50"
                  >
                    <UserRound size={16} className="text-gray-500" />
                    Xem thông tin
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartConversation(f.friendId)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-[14px] text-gray-800 transition-colors hover:bg-gray-50"
                  >
                    <MessageCircle size={16} className="text-gray-500" />
                    Nhắn tin
                  </button>

                  <button
                    type="button"
                    onClick={() => setBlockTargetId(f.friendId)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-[14px] text-gray-800 transition-colors hover:bg-gray-50"
                  >
                    <Ban size={16} className="text-gray-500" />
                    Chặn người này
                  </button>

                  <div className="border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => handelDeleteFriend(f.friendId)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-[14px] font-medium text-red-500 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Xóa bạn
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      <FriendProfileModal
        open={isProfileOpen}
        profileId={selectedFriendId}
        onClose={() => setIsProfileOpen(false)}
        onMessage={handleMessageFromProfile}
      />

      <AlertDialog
        open={!!blockTargetId}
        onOpenChange={(open) => !open && setBlockTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chặn người dùng này?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Bạn sẽ không nhận được tin nhắn hay cuộc gọi từ người này nữa. Họ cũng sẽ không thể xem nhật ký của bạn.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white min-w-[100px]"
              onClick={confirmBlock}
            >
              Chặn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
