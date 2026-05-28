import AppAvatar from "@/components/common/AppAvatar";
import { X } from "lucide-react";
import type { MessagesType } from "@/types/messages.type";

interface Props {
  selectedMessage: MessagesType;
  setShowDetailModal: (show: boolean) => void;
}

const ViewDetailMessageModal = ({
  selectedMessage,
  setShowDetailModal,
}: Props) => {
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={() => setShowDetailModal(false)}
    >
      <div
        className="bg-white w-105 rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-800">
            Thông tin tin nhắn
          </h2>

          <button
            onClick={() => setShowDetailModal(false)}
            className="p-1 rounded hover:bg-gray-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 border-t">
          <div className="text-sm font-medium mb-3">
            Đã xem ({selectedMessage.readReceipts?.length || 0})
          </div>

          <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
            {selectedMessage.readReceipts
              ?.filter((r: any) => !!r?.userId)
              .map((r, index) => {
                const user = r.userId;

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center text-center gap-1"
                  >
                    <AppAvatar
                      src={user?.profile?.avatarUrl}
                      name={user?.profile?.name || ""}
                      className="w-10 h-10"
                    />

                    <div className="text-xs text-gray-700 truncate w-full">
                      {user?.profile?.name}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewDetailMessageModal;
