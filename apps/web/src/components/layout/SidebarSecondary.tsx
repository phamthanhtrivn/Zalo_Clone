import { useLocation, useNavigate } from "react-router-dom";
import { SidebarSearch } from "./SidebarSearch";
import { ContactMenu } from "./ContactMenu";
import ConversationList from "./ConversationList";
import { useEffect, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import {
  fetchConversations,
  setConversations,
} from "@/store/slices/conversationSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { MessageSquare, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import AppAvatar from "../common/AppAvatar";

export const SidebarSecondary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isContactsRoute = location.pathname.startsWith("/contacts");
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchScope, setSearchScope] = useState<string>("all");

  useEffect(() => {
    if (!user?.userId) return;
    const fetch = async () => {
      const res = await conversationService.getConversationsFromUserId(
        user?.userId,
      );

      if (res.success) {
        dispatch(setConversations(res.data));
      }
    };

    fetch();
  }, [dispatch, user?.userId]);

  const handleSelectResult = async (
    id: string,
    messageId?: string,
    isNewContact?: boolean,
    otherUserIdFromSearch?: string,
  ) => {
    setSearchKeyword("");
    setIsSearching(false);

    let conversationIdToNavigate = id;
    const finalOtherUserId = otherUserIdFromSearch;

    if (isNewContact) {
      try {
        const response = await conversationService.getOrCreateDirect(id);
        conversationIdToNavigate =
          response?.data?._id || response?.data?.conversationId || response?._id;
        if (!conversationIdToNavigate) {
          console.error("Failed to get or create direct conversation for new contact.");
          return;
        }

        await dispatch(fetchConversations()).unwrap();
      } catch (error) {
        console.error("Error creating direct conversation:", error);
        return;
      }
    }

    const path = `/conversations/${conversationIdToNavigate}${messageId ? `?messageId=${messageId}` : ""}`;
    navigate(path, {
      state: {
        otherUserId: finalOtherUserId,
        isNewContact,
        fromSearch: true,
      },
    });
  };

  return (
    <aside className="z-10 flex w-86 shrink-0 min-h-0 flex-col border-r border-[#e5e7eb] bg-white transition-all duration-300">
      {isContactsRoute ? (
        <div className="flex h-full min-h-0 flex-col">
          <SidebarSearch
            keyword={searchKeyword}
            setKeyword={setSearchKeyword}
            onResultsChange={setSearchResults}
            onSearchStateChange={setIsSearching}
            scope={searchScope}
            setScope={setSearchScope}
          />
          {!isSearching ? (
            <ContactMenu />
          ) : (
            <div className="sidebar-scrollbar custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
              <SearchResultList
                results={searchResults}
                keyword={searchKeyword}
                onSelect={handleSelectResult}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex h-full min-h-0 flex-col">
          <SidebarSearch
            keyword={searchKeyword}
            setKeyword={setSearchKeyword}
            onResultsChange={setSearchResults}
            onSearchStateChange={setIsSearching}
            scope={searchScope}
            setScope={setSearchScope}
          />
          {!isSearching ? (
            <ConversationList />
          ) : (
            <div className="sidebar-scrollbar custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
              <SearchResultList
                results={searchResults}
                keyword={searchKeyword}
                onSelect={handleSelectResult}
              />
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

const SearchResultList = ({
  results,
  keyword,
  onSelect,
}: {
  results: any;
  keyword: string;
  onSelect: (
    id: string,
    msgId?: string,
    isNewContact?: boolean,
    otherUserId?: string,
  ) => void;
}) => {
  const user = useAppSelector((state) => state.auth.user);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  if (!results && keyword.trim()) {
    return <div className="p-4 text-center text-sm text-gray-500">Đang tìm kiếm...</div>;
  }

  if (!results) return null;

  const hasAnyResults =
    results.contacts?.length > 0 ||
    results.groups?.length > 0 ||
    results.messages?.length > 0 ||
    results.files?.length > 0;

  if (!hasAnyResults) {
    return (
      <div className="p-8 text-center">
        <Search size={40} className="mx-auto mb-2 text-gray-200" />
        <p className="text-sm text-gray-500">Không tìm thấy kết quả cho "{keyword}"</p>
      </div>
    );
  }

  const handleAddFriend = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user?.userId || sentRequests.has(targetUserId)) return;
    try {
      await conversationService.sendFriendRequest(user.userId, targetUserId);
      setSentRequests((prev) => new Set(prev).add(targetUserId));
    } catch (error) {
      console.error("Gửi lời mời kết bạn thất bại:", error);
    }
  };

  return (
    <div className="py-2">
      {results.contacts?.length > 0 && (
        <div className="mb-2">
          <div className="px-4 py-1 text-xs font-semibold uppercase text-gray-500">Liên hệ</div>
          {results.contacts.map((item: any) => (
            <div
              key={item.conversationId || item.userId}
              onClick={() =>
                onSelect(
                  item.conversationId || item.userId,
                  undefined,
                  !item.isExistingConversation,
                  item.userId,
                )
              }
              className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100"
            >
              <AppAvatar
                src={item.avatar}
                name={item.name || "Người dùng"}
                className="h-10 w-10"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                {item.phone && (
                  <div className="truncate text-xs text-gray-400">{item.phone}</div>
                )}
              </div>
              {!item.isFriend && (
                <button
                  onClick={(e) => handleAddFriend(e, item.userId)}
                  disabled={sentRequests.has(item.userId)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    sentRequests.has(item.userId)
                      ? "cursor-not-allowed bg-gray-100 text-gray-400"
                      : "bg-[#0091ff] text-white hover:bg-[#0075dd] active:scale-95",
                  )}
                >
                  {sentRequests.has(item.userId) ? "Đã gửi" : "Kết bạn"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {results.groups?.length > 0 && (
        <div className="mb-2 border-t pt-2">
          <div className="px-4 py-1 text-xs font-semibold uppercase text-gray-500">Nhóm</div>
          {results.groups.map((item: any) => (
            <div
              key={item.conversationId}
              onClick={() => onSelect(item.conversationId)}
              className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100"
            >
              <AppAvatar
                src={item.avatar}
                name={item.name || "Nhóm"}
                className="h-10 w-10"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{item.name}</div>
                <div className="text-xs text-gray-400">Nhóm</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.messages?.length > 0 &&
        results.messages.map((item: any) => (
          <div
            key={item.messageId}
            onClick={() => onSelect(item.conversationId, item.messageId)}
            className="flex cursor-pointer items-start gap-3 border-t px-4 py-2 hover:bg-gray-100"
          >
            <div className="mt-1">
              <MessageSquare size={16} className="text-gray-400" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{item.conversationName}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="truncate text-xs text-gray-500">
                <span className="font-semibold">{item.senderName}:</span> {item.text}
              </p>
            </div>
          </div>
        ))}

      {results.files?.length > 0 && (
        <div className="mb-2 border-t pt-2">
          <div className="px-4 py-1 text-xs font-semibold uppercase text-gray-500">
            File / Tài liệu
          </div>
          {results.files.map((item: any, idx: number) => (
            <div
              key={`file-${idx}`}
              onClick={() => onSelect(item.conversationId, item.messageId)}
              className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                <FileText size={20} />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-sm font-medium">{item.file.fileName}</div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="truncate">
                    {item.senderName} • {item.conversationName}
                  </span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
