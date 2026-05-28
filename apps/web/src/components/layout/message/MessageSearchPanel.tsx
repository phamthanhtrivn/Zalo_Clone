import { useState, useEffect, useRef } from "react";
import { X as CloseIcon, Search, Calendar, User, ChevronDown } from "lucide-react";
import { messageService } from "@/services/message.service";
import { conversationService } from "@/services/conversation.service";
import { useAppSelector } from "@/store";
import type { ConversationItemType } from "@/types/conversation-item.type";
import type { MessagesType } from "@/types/messages.type";
import { formatOldDate, formatTime } from "@/utils/format-message-time..util";
import { getFileIcon } from "@/utils/file-icon.util";
import { truncateFileName } from "@/utils/render-file";
import AppAvatar from "@/components/common/AppAvatar";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageSearchPanelProps {
   isOpen: boolean;
   onClose: () => void;
   conversation: ConversationItemType | null;
   onJumpToMessage: (messageId: string) => void;
   availableSenders?: { userId: string; name: string; avatarUrl: string | null }[];
}

const MessageSearchPanel = ({
   isOpen,
   onClose,
   conversation,
   onJumpToMessage,
   availableSenders = [],
}: MessageSearchPanelProps) => {
   const currentUserId = useAppSelector((state) => state.auth.user?.userId || (state.auth.user as any)?._id || "");
   const [keyword, setKeyword] = useState("");
   const [senderId, setSenderId] = useState<string | null>(null);
   const [dateRange, setDateRange] = useState<{ from: string | undefined; to: string | undefined }>({ from: undefined, to: undefined });
   const [results, setResults] = useState<MessagesType[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [fetchedSenders, setFetchedSenders] = useState<{ userId: string; name: string; avatarUrl: string | null }[]>([]);
   const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

   const displaySenders = availableSenders.length > 0 ? availableSenders : fetchedSenders;

   useEffect(() => {
      if (!isOpen || !conversation?.conversationId) return;

      let isMounted = true;
      const loadMembers = async () => {
         try {
            const res = await conversationService.getListMembers(conversation.conversationId);
            if (isMounted && res?.success && Array.isArray(res.data)) {
               setFetchedSenders(
                  res.data.map((m: any) => ({
                     userId: m.userId,
                     name: m.name || m.userId, // fallback
                     avatarUrl: m.avatarUrl || null,
                  }))
               );
            }
         } catch (err) {
            console.error("Lỗi tải danh sách thành viên:", err);
         }
      };
      loadMembers();

      return () => {
         isMounted = false;
      };
   }, [isOpen, conversation?.conversationId]);

   const performSearch = async (overrideKeyword?: string) => {
      if (!conversation?.conversationId || !currentUserId) return;
      const searchKeyword = overrideKeyword !== undefined ? overrideKeyword : keyword;

      // Only search if there is at least one filter
      if (!searchKeyword.trim() && !senderId && !dateRange.from) {
         setResults([]);
         return;
      }

      try {
         setIsLoading(true);
         const res = await messageService.searchMessages(conversation.conversationId, {
            userId: currentUserId,
            keyword: searchKeyword.trim() || undefined,
            senderId: senderId || undefined,
            startDate: dateRange.from ? new Date(dateRange.from).toISOString() : undefined,
            endDate: dateRange.to ? new Date(dateRange.to).toISOString() : undefined,
            limit: 50, // Fetch up to 50 results
         });

         if (res?.data?.messages) {
            setResults(res.data.messages);
         }
      } catch (error) {
         console.error("Search failed:", error);
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
         performSearch();
      }, 500);

      return () => {
         if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      };
   }, [keyword, senderId, dateRange]);

   // Optionally reset on close
   useEffect(() => {
      if (!isOpen) {
         setKeyword("");
         setSenderId(null);
         setDateRange({ from: undefined, to: undefined });
         setResults([]);
      }
   }, [isOpen]);

   const handleResultClick = (messageId: string) => {
      onJumpToMessage(messageId);
      // Optionally close search after jumping
      // onClose();
   };

   if (!isOpen) return <div className="w-0 overflow-hidden" />;

   return (
      <div className="w-[340px] h-full bg-white border-l shadow-[-4px_0_24px_rgba(0,0,0,0.02)] flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
         <div className="h-16 flex items-center justify-between px-4 border-b shrink-0 bg-white">
            <h2 className="text-[16px] font-bold text-gray-800 tracking-tight">Tìm kiếm tin nhắn</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
               <CloseIcon size={20} className="text-gray-500" />
            </button>
         </div>

         <div className="p-4 flex flex-col gap-3 border-b bg-[#f9fafb]">
            {/* Search Input */}
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
               <input
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-[14px] transition-all"
                  placeholder="Nhập từ khóa tìm kiếm"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
               />
               {keyword && (
                  <button
                     onClick={() => setKeyword("")}
                     className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300"
                  >
                     <CloseIcon size={12} />
                  </button>
               )}
            </div>

            {/* Filters row */}
            <div className="flex gap-2">
               {/* Sender Filter */}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button className={`flex items-center gap-1.5 px-3 rounded-lg border h-[34px] text-[13px] font-medium transition-all ${senderId ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        <User size={14} className={senderId ? "text-blue-500" : "text-gray-400"} />
                        <span className="truncate max-w-[80px]">
                           {senderId ? displaySenders.find(s => s.userId === senderId)?.name || 'Người gửi' : 'Người gửi'}
                        </span>
                        <ChevronDown size={14} className="ml-1 opacity-50" />
                     </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[240px]" align="start">
                     <div className="max-h-[300px] overflow-y-auto">
                        <DropdownMenuItem
                           className={`w-full flex items-center px-3 py-2 text-sm cursor-pointer ${!senderId ? 'bg-gray-50 font-semibold' : ''}`}
                           onClick={() => setSenderId(null)}
                        >
                           Tất cả người gửi
                        </DropdownMenuItem>
                        {displaySenders.map(sender => (
                           <DropdownMenuItem
                              key={sender.userId}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${senderId === sender.userId ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                              onClick={() => setSenderId(sender.userId)}
                           >
                              <AppAvatar
                                 src={sender.avatarUrl || ''}
                                 name={sender.name}
                                 className="w-6 h-6 border text-[8px]"
                              />
                              <span className="truncate flex-1">{sender.name}</span>
                           </DropdownMenuItem>
                        ))}
                     </div>
                  </DropdownMenuContent>
               </DropdownMenu>

               {/* Date Range Filter */}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button className={`flex items-center gap-1.5 px-3 rounded-lg border h-[34px] text-[13px] font-medium transition-all ${dateRange.from ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        <Calendar size={14} className={dateRange.from ? "text-blue-500" : "text-gray-400"} />
                        <span>
                           {dateRange.from ? new Date(dateRange.from).toLocaleDateString() : 'Ngày gửi'}
                        </span>
                        <ChevronDown size={14} className="ml-1 opacity-50" />
                     </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[240px] p-2" align="start">
                     <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-medium text-gray-700">Từ ngày:</label>
                        <input
                           type="date"
                           className="border rounded p-1.5 text-sm"
                           value={dateRange.from || ""}
                           onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value || undefined }))}
                        />
                        <label className="text-[13px] font-medium text-gray-700 mt-1">Đến ngày:</label>
                        <input
                           type="date"
                           className="border rounded p-1.5 text-sm"
                           value={dateRange.to || ""}
                           onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value || undefined }))}
                        />
                     </div>
                     <div className="mt-3 pt-2 border-t">
                        <button
                           className="w-full text-center text-sm font-medium text-red-500 hover:bg-red-50 py-1.5 rounded"
                           onClick={() => setDateRange({ from: undefined, to: undefined })}
                        >
                           Xóa lọc ngày
                        </button>
                     </div>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         </div>

         {/* Results List */}
         <div className="flex-1 overflow-y-auto bg-white custom-scrollbar relative">
            {isLoading && results.length === 0 && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
               </div>
            )}

            {!isLoading && (!keyword && !senderId && !dateRange.from) && results.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
                  <Search size={40} className="opacity-20" />
                  <span className="text-sm">Nhập để bắt đầu tìm kiếm</span>
               </div>
            )}

            {!isLoading && (keyword || senderId || dateRange.from) && results.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 p-6 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                     <Search className="text-gray-300" size={24} />
                  </div>
                  <span className="text-[15px] font-medium text-gray-700">Không tìm thấy kết quả</span>
                  <span className="text-[13px] text-gray-400 leading-relaxed">Hãy thử với một từ khóa khác hoặc thay đổi bộ lọc.</span>
               </div>
            )}

            <div className="flex flex-col">
               {results.map((msg) => {
                  const messageDate = new Date(msg.createdAt);
                  const isSameYear = messageDate.getFullYear() === new Date().getFullYear();
                  const dateStr = isSameYear
                     ? `${formatTime(msg.createdAt)} ${messageDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
                     : `${formatTime(msg.createdAt)} ${formatOldDate(msg.createdAt)}`;

                  return (
                     <div
                        key={msg._id}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition-colors group"
                        onClick={() => handleResultClick(msg._id)}
                     >
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex items-center gap-2">
                              <AppAvatar
                                 src={msg.senderId?.profile?.avatarUrl}
                                 name={msg.senderId?.profile?.name || "Người dùng"}
                                 className="w-5 h-5 text-[7px]"
                              />
                              <span className="text-[13px] font-semibold text-gray-800">{msg.senderId?.profile?.name || "Người dùng"}</span>
                           </div>
                           <span className="text-[11px] text-gray-400 group-hover:text-blue-500 transition-colors font-medium">
                              {dateStr}
                           </span>
                        </div>
                        {/* Content area */}
                        {(() => {
                           const documentFiles = msg.content?.files?.filter(
                              (f: any) => f.type === "FILE" || f.type === "VOICE"
                           ) || [];
                           const hasText = !!msg.content?.text;

                           return (
                              <div className="ml-7">
                                 {hasText && (
                                    <div className="text-[14px] text-gray-700 line-clamp-2 leading-relaxed group-hover:text-gray-900 break-words">
                                       {msg.content.text}
                                    </div>
                                 )}
                                 {documentFiles.length > 0 && (
                                    <div className="space-y-1 mt-1">
                                       {documentFiles.map((file: any, idx: number) => (
                                          <div
                                             key={idx}
                                             className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100 group-hover:bg-blue-50/50 transition-colors"
                                          >
                                             <div className="shrink-0">{getFileIcon(file.fileName)}</div>
                                             <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-gray-800 truncate">
                                                   {truncateFileName(file.fileName, 30)}
                                                </p>
                                                <p className="text-[11px] text-gray-400">
                                                   {file.fileSize >= 1024 * 1024
                                                      ? `${(file.fileSize / (1024 * 1024)).toFixed(1)} MB`
                                                      : `${(file.fileSize / 1024).toFixed(1)} KB`}
                                                </p>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                                 {!hasText && documentFiles.length === 0 && msg.content?.files && msg.content.files.length > 0 && (
                                    <div className="text-[14px] text-gray-700 line-clamp-2 leading-relaxed group-hover:text-gray-900 break-words">
                                       {msg.content.files.map((f: any) => f.fileName || f.name).join(", ")}
                                    </div>
                                 )}
                              </div>
                           );
                        })()}
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
   );
};

export default MessageSearchPanel;
