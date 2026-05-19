import { UserPlus } from "lucide-react";
import Mailbox from "@/assets/Mailbox.svg";
import { userService } from "@/services/user.service";
import UserRequestCart from "@/components/layout/UserRequestCard";
import UserSendCart from "@/components/layout/UserSendCart";
import UserSuggestCart from "@/components/layout/UserSuggestCart";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ContactRequest = () => {
  const userId = useSelector((item: any) => item.auth.user.userId);
  const queryClient = useQueryClient();

  // 1. Fetch Lời mời đã nhận
  const { data: receivedUsers = [] } = useQuery({
    queryKey: ["friendRequests", "received", userId],
    queryFn: async () => {
      const res = await userService.receivedFriendRequests();
      return res?.data?.users || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Lời mời đã gửi
  const { data: sendUsers = [] } = useQuery({
    queryKey: ["friendRequests", "sent", userId],
    queryFn: async () => {
      const res = await userService.sentFriendRequests();
      return res?.data?.users || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch Gợi ý bạn bè
  const { data: suggestUsers = [] } = useQuery({
    queryKey: ["friendSuggestions", userId],
    queryFn: async () => {
      const res = await userService.suggestFriend();
      return res?.data || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const handelAccept = (id: string) => {
    const acceptFriend = async () => {
      try {
        const data = await userService.acceptFriend(id, userId);
        if (data.data) {
          queryClient.invalidateQueries({ queryKey: ["friendRequests", "received", userId] });
          queryClient.invalidateQueries({ queryKey: ["friends"] });
          toast.success("Kết bạn thành công");
        }
      } catch (err) {
        console.log(err);
      }
    };
    acceptFriend();
  };

  const handelReject = (id: string) => {
    const rejectFriend = async () => {
      try {
        const data = await userService.rejectFriend(id, userId);
        if (data.data) {
          queryClient.invalidateQueries({ queryKey: ["friendRequests", "received", userId] });
          toast.success("Đã từ chối lời mời");
        }
      } catch (err) {
        console.log(err);
      }
    };
    rejectFriend();
  };
  const handelRecall = (id: string) => {
    const recallFriend = async () => {
      try {
        const data = await userService.cancelFriend(id, userId);
        if (data.data) {
          queryClient.invalidateQueries({ queryKey: ["friendRequests", "sent", userId] });
          toast.success("Thu hồi thành công");
        }
      } catch (err) {
        console.log(err);
      }
    };
    recallFriend();
  };

  const handelAddFriend = (id: string) => {
    const addFriend = async () => {
      try {
        const data = await userService.addFriend(id, userId);
        if (data.data) {
          queryClient.invalidateQueries({ queryKey: ["friendRequests", "sent", userId] });
          queryClient.invalidateQueries({ queryKey: ["friendSuggestions", userId] });
          toast.success("Thêm bạn thành công");
        }
      } catch (err) {
        console.log(err);
      }
    };
    addFriend();
  };

  const handelSkip = (id: string) => {
    queryClient.setQueryData(["friendSuggestions", userId], (old: any) => {
      return (old || []).filter((item: any) => item.friendId !== id);
    });
    toast.success("Bỏ qua thành công");
  };

  console.log("receivedUsers",receivedUsers);

  return (
    <div className="flex-1 overflow-y-auto flex-col bg-white overflow-hidden">
      <header className="h-16 border-b border-[#e5e7eb] flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-gray-600" />
          <h1 className="text-[16px] font-semibold text-gray-800">
            Lời mời kết bạn
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col bg-[#f4f7f9] p-4">
        <div className="flex-1">
          <div className="mb-5">
            <span className="text-[16px] font-semibold text-gray-800">
              Lời mời kết bạn ({receivedUsers.length || 0})
            </span>
          </div>
          <div className="flex justify-content-between">
            {receivedUsers?.length > 0 ? (
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {receivedUsers.map((item: any) => (
                  <UserRequestCart
                    key={item.friendId}
                    item={item}
                    handelAccept={() => handelAccept(item.friendId)}
                    handelReject={handelReject}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <img src={Mailbox} alt="Empty mailbox" className="w-28 h-28 mx-auto mb-4 opacity-50" />
                <p className="text-gray-400 text-sm">Chưa có lời mời kết bạn nào</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-5">
            <span className="text-[16px] font-semibold text-gray-800">
              Lời mời đã gửi ({sendUsers.length || 0})
            </span>
          </div>
          <div className="flex justify-content-between">
            {sendUsers?.length > 0 ? (
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sendUsers.map((item: any) => (
                  <UserSendCart
                    key={item.friendId}
                    item={item}
                    handelRecall={handelRecall}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <img src={Mailbox} alt="Empty mailbox" className="w-28 h-28 mx-auto mb-3 opacity-50" />
                <p className="text-gray-400 text-sm">Chưa có lời mời kết bạn nào đã gửi</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-5">
            <span className="text-[16px] font-semibold text-gray-800">
              Gợi ý kết bạn ({suggestUsers.length || 0})
            </span>
          </div>
          <div className="flex justify-content-between">
            {suggestUsers?.length > 0 ? (
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestUsers.map((item: any) => (
                  <UserSuggestCart
                    key={item.friendId}
                    item={item}
                    handelAddFriend={handelAddFriend}
                    handelSkip={handelSkip}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex-column justify-content-center align-items-center text-center"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactRequest;
