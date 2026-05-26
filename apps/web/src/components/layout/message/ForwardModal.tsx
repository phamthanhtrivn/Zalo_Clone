import { useState } from "react";
import { X } from "lucide-react";
import { TbMessageUp } from "react-icons/tb";
import AppAvatar from "@/components/common/AppAvatar";

type Conversation = {
  conversationId: string;
  name: string;
  avatar?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  selectedMessageIds: string[];
  onSubmit: (conversationIds: string[]) => void;
  loadingForward: boolean;
};

const ForwardModal = ({
  open,
  onClose,
  conversations,
  selectedMessageIds,
  onSubmit,
  loadingForward,
}: Props) => {
  const [selectedConversations, setSelectedConversations] = useState<string[]>(
    [],
  );
  const [search, setSearch] = useState("");

  if (!open) return null;

  const toggleSelect = (id: string) => {
    setSelectedConversations((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="w-120 bg-white rounded-xl shadow-xl flex flex-col">
        {/* HEADER */}
        <div className="flex justify-between items-center px-4 py-3 border-b ">
          <h2 className="font-semibold text-lg">Chia sẻ</h2>
          <button onClick={onClose} className="cursor-pointer">
            <X />
          </button>
        </div>

        {/* SEARCH */}
        <div className="p-3 border-b">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full px-3 py-2 border rounded-lg outline-none"
          />
        </div>

        {/* LIST */}
        <div className="flex-1 max-h-87.5 overflow-y-auto">
          {filtered.map((conv) => (
            <div
              key={conv.conversationId}
              onClick={() => toggleSelect(conv.conversationId)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedConversations.includes(conv.conversationId)}
                onChange={() => toggleSelect(conv.conversationId)}
                onClick={(e) => e.stopPropagation()}
              />

              <AppAvatar
                src={conv.avatar}
                name={conv.name}
                className="w-9 h-9"
              />

              <span className="text-sm">{conv.name}</span>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="border-t p-3">
          <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
            <TbMessageUp className=" text-blue-500 text-xl" />{" "}
            <div>
              Chia sẻ{" "}
              <span className="px-2 py-1 bg-[#E5F1FF] rounded font-medium text-[#104EAD] mr-1">
                {selectedMessageIds.length}
              </span>{" "}
              tin nhắn
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100 cursor-pointer hover:bg-gray-200 transition">
              Hủy
            </button>

            <button
              onClick={() => onSubmit(selectedConversations)}
              disabled={selectedConversations.length === 0 || loadingForward}
              className={`px-4 py-2 rounded bg-blue-500 text-white disabled:opacity-50 ${selectedConversations.length > 0 && !loadingForward ? "hover:bg-blue-600 cursor-pointer" : "cursor-not-allowed"}`}
            >
              {loadingForward ? "Đang chia sẻ..." : "Chia sẻ"}
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default ForwardModal;
