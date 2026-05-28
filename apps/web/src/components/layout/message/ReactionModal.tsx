import { useMemo, useState } from "react";
import { X } from "lucide-react";
import AppAvatar from "@/components/common/AppAvatar";
import { EMOJI_MAP, EmojiType } from "@/constants/emoji.constant";
import type { ReactionType } from "@/types/messages.type";

interface Props {
  reactions: ReactionType[];
  onClose: () => void;
}

export const ReactionModal = ({ reactions, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<"all" | EmojiType>("all");

  const { emojiCounts, totalReactions } = useMemo(() => {
    const counts = {} as Record<EmojiType, number>;

    let total = 0;

    reactions.forEach((r) => {
      r.emoji.forEach((e) => {
        const name = e.name as EmojiType;
        counts[name] = (counts[name] || 0) + e.quantity;
        total += e.quantity;
      });
    });

    return { emojiCounts: counts, totalReactions: total };
  }, [reactions]);


  const sortedEmojiCounts = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]);

  const sortedReactions = useMemo(() => {
    const filtered =
      activeTab === "all"
        ? reactions
        : reactions.filter((r) =>
          r.emoji.some((e) => e.name === activeTab)
        );

    return [...filtered].sort((a, b) => {
      const getScore = (r: ReactionType) => {
        if (activeTab !== "all") {
          return r.emoji
            .filter((e) => e.name === activeTab)
            .reduce((sum, e) => sum + e.quantity, 0);
        }
        return r.emoji.reduce((sum, e) => sum + e.quantity, 0);
      };

      const scoreA = getScore(a);
      const scoreB = getScore(b);

      if (scoreB !== scoreA) return scoreB - scoreA;

      if (b.emoji.length !== a.emoji.length) {
        return b.emoji.length - a.emoji.length;
      }

      return (
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
      );
    });
  }, [reactions, activeTab]);


  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col h-125 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-[#001A33]">Biểu cảm</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-32 bg-[#F7F8F9] border-r flex flex-col overflow-y-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`p-3 text-sm flex items-center justify-between border-l-4 transition-colors ${activeTab === "all"
                ? "bg-white border-blue-500 text-blue-600 font-medium"
                : "border-transparent text-gray-600 hover:bg-gray-100"
                }`}
            >
              <span>Tất cả</span>
              <span className="text-xs text-gray-500">{totalReactions}</span>
            </button>
            {sortedEmojiCounts.map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => setActiveTab(emoji as EmojiType)}
                className={`p-3 flex items-center justify-between border-l-4 transition-colors cursor-pointer ${activeTab === emoji
                  ? "bg-white border-blue-500"
                  : "border-transparent hover:bg-gray-100"
                  }`}
              >
                <span className="text-xl">{EMOJI_MAP[emoji as EmojiType]}</span>
                <span className="text-sm text-gray-500">{count}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sortedReactions.map((reaction, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <AppAvatar
                      src={reaction.userId.profile?.avatarUrl}
                      name={reaction.userId.profile?.name || ""}
                      className="w-10 h-10 border border-gray-200"
                    />
                  </div>
                  <span className="font-medium text-[#001A33]">
                    {reaction.userId.profile?.name}
                  </span>
                </div>
                <div className="flex items-center">
                  {activeTab === "all"
                    ? reaction.emoji.map((e, j) => (
                      <div key={j} className="flex items-center">
                        <span className="text-lg">
                          {EMOJI_MAP[e.name as EmojiType]}
                        </span>
                      </div>
                    ))
                    : reaction.emoji
                      .filter((e) => e.name === activeTab)
                      .map((e, j) => (
                        <div key={j} className="flex items-center gap-1">
                          <span className="text-lg">
                            {EMOJI_MAP[e.name as EmojiType]}
                          </span>
                          <span className="text-sm text-gray-500 font-medium">
                            {e.quantity}
                          </span>
                        </div>
                      ))}
                  {activeTab == 'all' && (
                    <span className="ml-1 text-sm text-gray-500 font-medium">
                      {reaction.emoji.reduce((acc, e) => acc + e.quantity, 0)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
