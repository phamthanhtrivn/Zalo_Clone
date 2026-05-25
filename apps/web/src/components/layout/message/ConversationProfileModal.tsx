import FriendProfileModal from "@/components/layout/FriendProfileModal";
import { conversationService } from "@/services/conversation.service";
import { useCall } from "@/contexts/VideoCallContext";
import { CallType } from "@/constants/types";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

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
            navigate(`/conversations/${conversationId}`);
          } else {
            toast.error(`Không thể mở hộp thoại`);
          }
        } catch (error) {
          toast.error(`Đã xảy ra lỗi khi tạo cuộc trò chuyện`);
        }
      }}
      onCall={async () => {
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
