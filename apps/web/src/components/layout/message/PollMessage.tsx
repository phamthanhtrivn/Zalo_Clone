import React, { useState, useEffect, useMemo } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppAvatar from "@/components/common/AppAvatar";
import { toast } from "react-toastify";
import { useAppSelector } from "@/store";
import { pollService } from "@/services/poll.service";
import type { PollOptionType } from "@/types/messages.type";
import { makeSelectMyVotes, makeSelectPollByMessageId } from "@/store/selectors/poll.selector";

interface Props {
  pollId: string;
  conversationId: string;
  initialPoll?: any;
}


const calculatePercentages = (options: PollOptionType[], total: number) => {
  if (total === 0 || !options.length) return options.map(() => 0);

  const exactPercentages = options.map(opt => (opt.voteCount / total) * 100);
  const floored = exactPercentages.map(p => Math.floor(p));
  const sumFloored = floored.reduce((a, b) => a + b, 0);
  const remainders = exactPercentages.map((p, i) => ({
    remainder: p - floored[i],
    index: i
  }));

  remainders.sort((a, b) => b.remainder - a.remainder);

  let diff = 100 - sumFloored;
  for (let i = 0; i < diff; i++) {
    floored[remainders[i].index]++;
  }

  return floored;
};

const PollMessage: React.FC<Props> = ({ pollId, conversationId, initialPoll }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.userId || (currentUser as any)?._id || "";

  const selectPoll = useMemo(() => makeSelectPollByMessageId(conversationId, pollId), [conversationId, pollId]);
  const selectMyVotes = useMemo(() => makeSelectMyVotes(conversationId, pollId, currentUserId), [conversationId, pollId, currentUserId]);

  const reduxPoll = useAppSelector(selectPoll);
  const poll = reduxPoll || initialPoll;
  const reduxMyVotes = useAppSelector(selectMyVotes);

  const myVotes = useMemo(() => {
    if (reduxMyVotes.length > 0) return reduxMyVotes;
    if (initialPoll && initialPoll.options) {
      return initialPoll.options
        .filter((opt: any) => opt.voters?.some((v: any) => v.userId === currentUserId))
        .map((opt: any) => opt._id);
    }
    return [];
  }, [reduxMyVotes, initialPoll, currentUserId]);

  useEffect(() => {
    console.log("🚀 Dữ liệu Poll hiện tại:", poll);
  }, [poll]);

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cachedMyVotes, setCachedMyVotes] = useState<string[]>(() => {
    // Persistent Cache cho bình chọn ẩn danh
    if (poll?.isAnonymous && poll?._id && currentUserId) {
      const STORAGE_KEY = `poll_votes_${poll._id}_${currentUserId}`;
      const saved = localStorage.getItem(STORAGE_KEY);
      try {
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [isLocalChanged, setIsLocalChanged] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  if (!poll) return null;

  const STORAGE_KEY = `poll_votes_${poll._id}_${currentUserId}`;

  const totalParticipants = poll?.totalParticipants || 0;
  const isExpired = poll.expiresAt ? new Date() > new Date(poll.expiresAt) : false;

  // Kiểm tra user đã vote chưa (Dùng cả dữ liệu store và dữ liệu cache ẩn danh)
  const hasVoted = myVotes.length > 0 || cachedMyVotes.length > 0;

  // Hiện kết quả khi: (Không bật ẩn kết quả) HOẶC (Đã vote) HOẶC (Đã hết hạn)
  const showResults = !poll.hideResultsUntilVoted || hasVoted || isExpired;

  const percentages = useMemo(() => {
    if (!poll || !showResults) return poll?.options.map(() => 0) || [];
    return calculatePercentages(poll.options, totalParticipants);
  }, [poll, totalParticipants, showResults]);

  const myVotesStr = myVotes.join(',');
  const cachedMyVotesStr = cachedMyVotes.join(',');
  const selectedOptionIdsStr = selectedOptionIds.join(',');

  useEffect(() => {
    const isMatched = selectedOptionIds.length === myVotes.length &&
      selectedOptionIds.every(id => myVotes.includes(id));

    if (isMatched) {
      setIsLocalChanged(false);
    }

    if (!isLocalChanged) {
      if (poll.isAnonymous && cachedMyVotes.length > 0) {

        setSelectedOptionIds(cachedMyVotes);
      } else {
        setSelectedOptionIds(myVotes);
      }
    }
  }, [myVotesStr, selectedOptionIdsStr, cachedMyVotesStr, isLocalChanged, poll.isAnonymous]);

  const handleOptionClick = (optionId: string) => {
    if (isExpired) return;
    setIsLocalChanged(true);
    if (poll.isMultipleChoice) {
      setSelectedOptionIds(prev =>
        prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
      );
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleVote = async () => {
    if (isExpired) {
      toast.error("Bình chọn này đã kết thúc");
      return;
    }
    if (selectedOptionIds.length === 0) {
      toast.warn("Vui lòng chọn ít nhất một phương án");
      return;
    }
    setIsVoting(true);
    try {
      await pollService.votePoll(conversationId, poll._id, selectedOptionIds);

      if (poll.isAnonymous) {
        setCachedMyVotes(selectedOptionIds);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedOptionIds));
      }

      setIsLocalChanged(false);
      toast.success("Bình chọn thành công");
    } catch (error) {
      toast.error("Có lỗi xảy ra khi bình chọn");
    } finally {
      setIsVoting(false);
    }
  };

  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);

  const handleAddOption = async () => {
    if (isExpired) {
      toast.error("Bình chọn này đã kết thúc");
      return;
    }
    if (!newOptionText.trim()) return;

    setIsSubmittingOption(true);
    try {
      await pollService.addOption(conversationId, poll._id, newOptionText.trim());
      setNewOptionText("");
      setIsAddingOption(false);
      toast.success("Thêm phương án thành công");
    } catch (error) {
      toast.error("Không thể thêm phương án");
    } finally {
      setIsSubmittingOption(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 max-w-[320px] space-y-3">
      <div className="space-y-1">
        <h3 className="font-semibold text-[15px] text-gray-800 leading-tight">{poll.title}</h3>
        <div className="flex items-center gap-2">
          {poll.isAnonymous && (
            <span className="text-[10px] font-bold text-[#0068ff] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider shrink-0">
              Ẩn danh
            </span>
          )}
          <p className="text-[12px] text-gray-500 font-medium">
            {totalParticipants || 0} người đã bình chọn
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {poll.options.map((option, index) => {
          const isSelected = selectedOptionIds.includes(option._id);
          const percent = showResults ? (percentages[index] || 0) : 0;

          return (
            <div key={option._id} className={`relative group ${isExpired ? "cursor-default" : "cursor-pointer"}`} onClick={() => !isExpired && handleOptionClick(option._id)}>
              <div className="flex items-center justify-between mb-1.5 relative z-10 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-[#0068ff] border-[#0068ff]" : "border-gray-300 bg-white"}`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[4px]" />}
                  </div>
                  <span className={`text-[14px] truncate ${isSelected ? "text-[#0068ff] font-medium" : "text-gray-700"}`}>{option.text}</span>
                </div>
                {showResults && (
                  <span className="text-[13px] font-semibold text-gray-600 shrink-0 ml-2">{option.voteCount}</span>
                )}
              </div>

              <div className="h-6 w-full bg-gray-50 rounded-md overflow-hidden relative border border-gray-50">
                {showResults && (
                  <div className={`h-full transition-all duration-500 rounded-r-sm ${isSelected ? "bg-[#0068ff]/15" : "bg-gray-200/50"}`} style={{ width: `${percent}%` }} />
                )}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex -space-x-1.5">
                  {(!poll.isAnonymous && showResults && option.voters) && option.voters.slice(0, 3).map((voter, idx) => (
                    <AppAvatar
                      key={idx}
                      src={voter.avatar}
                      name={voter.name || ""}
                      className="w-4 h-4 border border-white ring-0 text-[5px]"
                    />
                  ))}
                  {(!poll.isAnonymous && showResults && option.voteCount > 3) && (
                    <div className="w-4 h-4 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[7px] text-gray-500 font-bold">+{option.voteCount - 3}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Action Area */}
      <div className="pt-2 border-t mt-2 flex flex-col gap-3">
        {/* Banner hết hạn nếu cần */}
        {isExpired ? (
          <div className="w-full text-center text-red-500 text-[13px] font-bold bg-red-50 py-2 rounded-md border border-red-100 animate-in fade-in slide-in-from-top-1">
            Bình chọn đã kết thúc
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Thêm phương án */}
            {poll.allowAddOptions && (
              <div className="w-full">
                {isAddingOption ? (
                  <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300">
                    <input
                      autoFocus
                      className="w-full px-3 py-1.5 text-sm border border-[#0068ff]/30 rounded-md outline-none focus:border-[#0068ff] bg-white"
                      placeholder="Nhập phương án mới..."
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                      disabled={isSubmittingOption}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setIsAddingOption(false); setNewOptionText(""); }}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1"
                        disabled={isSubmittingOption}
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleAddOption}
                        disabled={isSubmittingOption || !newOptionText.trim()}
                        className={`px-3 py-1 bg-[#0068ff] text-white text-xs rounded-md font-bold shadow-sm transition-opacity ${isSubmittingOption || !newOptionText.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-[#0057d6]"}`}
                      >
                        {isSubmittingOption ? <Loader2 className="w-3 h-3 animate-spin" /> : "Thêm"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingOption(true)}
                    className="flex items-center gap-2 text-[#0068ff] text-[13px] font-medium hover:underline group"
                  >
                    <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Thêm phương án
                  </button>
                )}
              </div>
            )}

            {/* Nút Bình chọn */}
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!isLocalChanged || isVoting}
                onClick={(e) => { e.stopPropagation(); handleVote(); }}
                className={`h-8 px-5 rounded-full text-[13px] font-bold transition-all shadow-sm ${isLocalChanged ? "bg-[#0068ff] hover:bg-[#0057d6] text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                {isVoting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Bình chọn
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollMessage;
