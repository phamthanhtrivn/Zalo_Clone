import { Search, UserPlus, Users, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import CreateGroupModal from "./CreateGroupModal";
import AddFriendModal from "./AddFriendModal";
import { conversationService } from "@/services/conversation.service";
import { useAppSelector } from "@/store";
import { cn } from "@/lib/utils";

interface SidebarSearchProps {
  keyword: string;
  setKeyword: (keyword: string) => void;
  onResultsChange: (results: any) => void;
  onSearchStateChange: (isSearching: boolean) => void;
  scope: string;
  setScope: (scope: string) => void;
}

export const SidebarSearch = ({
  keyword,
  setKeyword,
  onResultsChange,
  onSearchStateChange,
  scope,
  setScope
}: SidebarSearchProps) => {
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isOpenModelAddFriend, setIsOpenAddFriend] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    const isSearching = keyword.trim().length > 0;
    onSearchStateChange(isSearching);

    if (!isSearching) {
      onResultsChange(null);
      return;
    }
    if (!user?.userId || !/^[0-9a-fA-F]{24}$/.test(user.userId)) {
      console.error("Invalid or missing user ID, cannot perform search:", user?.userId);
      onResultsChange(null);
      onSearchStateChange(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await conversationService.search({
          keyword,
          userId: user.userId,
          scope: scope as any,
        });

        if (res && res.success) {
          onResultsChange(res.data);
        } else {
          onResultsChange(res.data || res);
        }
      } catch (error) {
        console.error("Search error:", error);
        onResultsChange(null);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [keyword, scope, user?.userId, onResultsChange, onSearchStateChange]);

  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "contacts", label: "Liên hệ" },
    { id: "messages", label: "Tin nhắn" },
    { id: "files", label: "File" },
  ];

  return (
    <div className="relative" ref={searchRef}>
      <div className="p-4 pb-1">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0091ff] transition-colors" />
            <Input
              type="text"
              placeholder="Tìm kiếm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-8 pl-9 pr-8 bg-[#f1f2f4] shadow-none border-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0091ff]"
            />
            {keyword && (
              <button
                onClick={() => setKeyword("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded-full text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button
            onClick={() => setIsOpenAddFriend(true)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-600 hover:bg-[#f1f2f4] cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-600 hover:bg-[#f1f2f4] cursor-pointer"
            onClick={() => setIsCreateGroupOpen(true)}
            aria-label="Thêm nhóm"
            title="Thêm nhóm"
          >
            <Users className="w-5 h-5" />
          </Button>
        </div>
      </div>
      {isOpenModelAddFriend && (
        <AddFriendModal onClose={() => setIsOpenAddFriend(false)} />
      )}

      {/* Search Filters Tabs */}
      {keyword.trim().length > 0 && (
        <div className="flex items-center px-4 border-b border-gray-100 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setScope(tab.id)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium transition-all relative shrink-0 cursor-pointer",
                scope === tab.id
                  ? "text-[#0091ff]"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
              {scope === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0091ff]" />
              )}
            </button>
          ))}
        </div>
      )}

      <CreateGroupModal
        open={isCreateGroupOpen}
        onOpenChange={setIsCreateGroupOpen}
      />
    </div>
  );
};
