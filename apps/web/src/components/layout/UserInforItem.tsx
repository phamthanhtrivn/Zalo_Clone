import { conversationService } from "@/services/conversation.service";
import AppAvatar from "../common/AppAvatar";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

type Props = {
  name: string;
  avartaUrl?: string;
  desc?: string;
  id?: string;
};
export default function UserInfoItem({ name, avartaUrl, desc, id }: Props) {
  const navigate = useNavigate();
  const [isStartingConversation, setIsStartingConversation] = useState(false);

  const handleStartConversation = async (targetUserId: string) => {
    if (isStartingConversation) return;

    setIsStartingConversation(true);
    try {
      const response =
        await conversationService.getOrCreateDirect(targetUserId);
      const conversationId =
        response?.data?._id || response?.data?.conversationId || response?._id;

      if (!conversationId) return;

      navigate(`/conversation/${conversationId}`);
    } catch (error) {
      console.log(error);
    } finally {
      setIsStartingConversation(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 mb-5 ${isStartingConversation ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => !isStartingConversation && id && handleStartConversation(id)}
      aria-busy={isStartingConversation}
    >
      <AppAvatar src={avartaUrl} name={name} className="w-12 h-12" />

      <div className="min-w-0">
        <p className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="truncate">{name}</span>
          {isStartingConversation && (
            <span
              className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
              aria-label="Đang tạo cuộc trò chuyện"
            />
          )}
        </p>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
