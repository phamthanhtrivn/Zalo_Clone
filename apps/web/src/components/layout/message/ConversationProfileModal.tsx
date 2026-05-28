import FriendProfileModal from "@/components/layout/FriendProfileModal";
import { conversationService } from "@/services/conversation.service";
import { useCall } from "@/contexts/VideoCallContext";
import { CallType } from "@/constants/types";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import { userService } from "@/services/user.service";

interface ConversationProfileModalProps {
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;
}

export const ConversationProfileModal = ({
  selectedProfileId,
  setSelectedProfileId,
}: ConversationProfileModalProps) => {
  const navigate = useNavigate();
  const { startDirectCall } = useCall();
  const [friendStatus, setFriendStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProfileId) return;
    (async () => {
      try {
        const res = await userService.checkFriendStatus(selectedProfileId);
        const fd = res?.data?.data ?? res?.data;
        setFriendStatus(fd?.status ?? null);
      } catch (err) {
        setFriendStatus(null);
      }
    })();
  }, [selectedProfileId]);

  if (!selectedProfileId) return null;

  return (
    <FriendProfileModal
      open={!!selectedProfileId}
      profileId={selectedProfileId}
      onClose={() => setSelectedProfileId(null)}
      onMessage={async () => {
        try {
          const res = await conversationService.getOrCreateDirect(selectedProfileId);
          const conversationId =
            res?.data?._id ||
            res?.data?.conversationId ||
            res?.data?.id ||
            res?._id ||
            res?.conversationId;

          if (conversationId) {
            setSelectedProfileId(null);
            navigate(`/conversation/${conversationId}`);
          } else {
            toast.error(`Không thể mở hộp thoại`);
          }
        } catch (error) {
          toast.error(`Đã xảy ra lỗi khi tạo cuộc trò chuyện`);
        }
      }}
      onCall={async () => {
        if (friendStatus === "BLOCKED" || friendStatus === "BLOCKED_BY_OTHER") {
          toast.error("Không thể gọi khi bị chặn.");
          return;
        }
        try {
          const res = await conversationService.getOrCreateDirect(selectedProfileId);
          const conversationId =
            res?.data?._id ||
            res?.data?.conversationId ||
            res?.data?.id ||
            res?._id ||
            res?.conversationId;

          if (conversationId) {
            setSelectedProfileId(null);
            await startDirectCall(
              selectedProfileId,
              conversationId,
              CallType.VIDEO,
              res?.data?.name || res?.data?.profile?.name || "Người dùng",
              res?.data?.avatar || res?.data?.profile?.avatarUrl || ""
            );
          } else {
            toast.error("Không thể khởi tạo cuộc gọi.");
          }
        } catch (error) {
          console.error("Error starting direct call:", error);
          toast.error("Đã xảy ra lỗi khi gọi điện.");
        }
      }}
    />
  );
};
