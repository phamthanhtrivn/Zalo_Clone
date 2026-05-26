interface FriendRequestBarProps {
  isGroup: boolean;
  isFriend: boolean | null;
  friendStatus: string | null;
  onAccept: () => void;
  onSend: () => void;
  onUnblock: () => void;
}

export const FriendRequestBar = ({
  isGroup,
  isFriend,
  friendStatus,
  onAccept,
  onSend,
  onUnblock,
}: FriendRequestBarProps) => {
  if (isGroup || isFriend !== false) return null;

  const isBlocked =
    friendStatus === "BLOCKED" || friendStatus === "BLOCKED_BY_OTHER";

  return (
    <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-3 text-sm shrink-0 select-none">
      {/* Icon */}
      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-[#0091ff]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </div>

      {/* Text */}
      <span className="flex-1 text-gray-600 text-[13px]">
        {isBlocked
          ? friendStatus === "BLOCKED"
            ? "Bạn đã chặn người này"
            : "Người này đã chặn bạn"
          : friendStatus === "REQUESTED"
            ? "Người này đã gửi lời mời kết bạn cho bạn"
            : friendStatus === "PENDING"
              ? "Đã gửi lời mời kết bạn"
              : "Gửi yêu cầu kết bạn tới người này"
        }
      </span >

      {/* Action button */}
      {isBlocked ? (
        <button
          onClick={onUnblock}
          disabled={friendStatus === "BLOCKED_BY_OTHER"}
          className={`shrink-0 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors shadow-sm ${friendStatus === "BLOCKED_BY_OTHER" ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200" : "bg-[#0091ff] text-white hover:bg-[#0075dd]"}`}
        >
          {friendStatus === "BLOCKED_BY_OTHER" ? "Đã bị chặn" : "Gỡ chặn"}
        </button>
      ) : friendStatus === "REQUESTED" || friendStatus === "REJECTED" ? (
        <button
          onClick={onAccept}
          className="shrink-0 px-4 py-1.5 bg-[#0091ff] text-white text-[13px] font-medium rounded-md hover:bg-[#0075dd] transition-colors shadow-sm"
        >
          Chấp nhận
        </button>
      ) : friendStatus === "PENDING" ? (
        <span className="shrink-0 px-4 py-1.5 text-gray-400 text-[13px] border border-gray-200 rounded-md bg-gray-50">
          Đã gửi
        </span>
      ) : (
        <button
          onClick={onSend}
          className="shrink-0 px-4 py-1.5 bg-[#0091ff] text-white text-[13px] font-medium rounded-md hover:bg-[#0075dd] transition-colors shadow-sm"
        >
          Gửi kết bạn
        </button>
      )
      }
    </div >
  );
};
