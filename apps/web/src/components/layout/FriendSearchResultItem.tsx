import { userService } from "@/services/user.service";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import AppAvatar from "../common/AppAvatar";
interface UserSearchResultProps {
  setUserSearch: any;
  setSuggestUsers: any;
  user: {
    friendId: string;
    name: string;
    avatarUrl: string;
    status: string;
    source?: string;
  };
}

const FriendSearchResultItem = ({
  user,
  setUserSearch,
  setSuggestUsers,
}: UserSearchResultProps) => {
  const id = useSelector((item: any) => item.auth.user?.userId);

  const getButtonConfig = (status: string | "NONE") => {
    switch (status) {
      case "PENDING":
        return {
          label: "Chấp nhận",
          className: "text-blue-600 border-blue-600 hover:bg-blue-50",
        };
      case "ACCEPTED":
        return {
          label: "Bạn bè",
          className: "text-gray-500 border-gray-300 bg-gray-100 cursor-default",
        };
      case "BLOCKED_BY_OTHER":
        return {
          label: "Gỡ chặn",
          className: "text-gray-500 border-gray-300 bg-gray-100 cursor-default",
        };

      case "BLOCKED":
        return {
          label: "Bị chặn",
          className: "text-gray-500 border-gray-300 bg-gray-100 cursor-default",
        };
      case "REQUESTED":
      case "REJECTED":
        return {
          label: "Thu hồi",
          className: "text-blue-600 border-blue-600 hover:bg-blue-50",
        };
      case "NONE":
      default:
        return {
          label: "Kết bạn",
          className: "text-blue-600 border-blue-600 hover:bg-blue-50",
        };
    }
  };

  const config = getButtonConfig(user.status);

  const handelSubmit = async () => {
    let data;
    switch (user.status) {
      case "PENDING":
        data = await userService.acceptFriend(user.friendId, id);
        console.log(data);
        if (data.data) {
          setUserSearch((prev: any) =>
            prev?.friendId === user.friendId
              ? { ...prev, status: "ACCEPTED" }
              : prev,
          );
          setSuggestUsers((prev: any[]) =>
            prev.map((item) =>
              item.friendId === user.friendId
                ? { ...item, status: "ACCEPTED" }
                : item,
            ),
          );
          toast.success("Đã chấp nhận lời mời");
        }
        break;

      case "ACCEPTED":
        toast.info("Hai bạn đã là bạn bè");
        break;
      case "REQUESTED":
      case "REJECTED":
        data = await userService.cancelFriend(user.friendId, id);
        if (data.data) {
          setUserSearch((prev: any) =>
            prev?.friendId === user.friendId
              ? { ...prev, status: "NONE" }
              : prev,
          );
          setSuggestUsers((prev: any[]) =>
            prev.map((item) =>
              item.friendId === user.friendId
                ? { ...item, status: "NONE" }
                : item,
            ),
          );
          toast.success("Đã thu hồi/hủy yêu cầu");
        }
        break;
      case "BLOCKED_BY_OTHER":
        data = await userService.cancelFriend(user.friendId, id);
        if (data.data) {
          setUserSearch((prev: any) =>
            prev?.friendId === user.friendId
              ? { ...prev, status: "NONE" }
              : prev,
          );
          setSuggestUsers((prev: any[]) =>
            prev.map((item) =>
              item.friendId === user.friendId
                ? { ...item, status: "NONE" }
                : item,
            ),
          );
          toast.success("Đã thu hồi/hủy yêu cầu");
        }
        break;

      case "NONE":
      default:
        data = await userService.addFriend(user.friendId, id);
        if (data.data) {
          setUserSearch((prev: any) =>
            prev?.friendId === user.friendId
              ? { ...prev, status: "REQUESTED" }
              : prev,
          );
          setSuggestUsers((prev: any[]) =>
            prev.map((item) =>
              item.friendId === user.friendId
                ? { ...item, status: "REQUESTED" }
                : item,
            ),
          );
          toast.success("Gửi lời mời thành công");
        }
        break;
    }
  };

  return (
    <div className="relative flex items-center justify-between p-3 bg-[#f3f5f6]/50 hover:bg-[#f3f5f6] rounded-sm transition-colors group">
      {/* Thông tin User */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <AppAvatar
            src={user?.avatarUrl}
            name={user.name}
            className="w-12 h-12"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-[#081c36] leading-tight">
            {user.name}
          </span>
          <span className="text-[13px] text-gray-500 mt-0.5">
            {user.source || "Từ gợi ý kết bạn"}
          </span>
        </div>
      </div>

      {/* Nút hành động */}
      <div className="flex items-center gap-2">
        <button
          onClick={handelSubmit}
          className={`px-4 py-1.5 border rounded-md text-[14px] font-semibold transition-all ${config.className}`}
        >
          {config.label}
        </button>
      </div>
    </div>
  );
};

export default FriendSearchResultItem;