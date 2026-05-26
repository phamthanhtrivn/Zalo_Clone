import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, MoreHorizontal, UserRound, X } from "lucide-react";
import { Button } from "../ui/button";
import ConversationListItem from "./ConversationListItem";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchConversations,
  updateConversationSetting,
} from "@/store/slices/conversationSlice";
import type {
  ConversationCategory,
  ConversationItemType,
} from "@/types/conversation-item.type";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "@/lib/utils";
import ConversationPinDialog from "./ConversationPinDialog";
import {
  hideConversation,
  unhideConversation,
} from "@/services/conversation-settings.service";
import { toast } from "react-toastify";

type InboxTab = "all" | "unread";
type FilterCategory = Exclude<ConversationCategory, null>;

const CATEGORY_FILTERS: Array<{
  value: FilterCategory;
  label: string;
  color: string;
}> = [
    { value: "customer", label: "Khách hàng", color: "bg-red-500" },
    { value: "family", label: "Gia đình", color: "bg-green-500" },
    { value: "work", label: "Công việc", color: "bg-orange-500" },
    { value: "friends", label: "Bạn bè", color: "bg-purple-500" },
    { value: "later", label: "Trả lời sau", color: "bg-yellow-500" },
    { value: "colleague", label: "Đồng nghiệp", color: "bg-blue-500" },
  ];

const ConversationList = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const conversations = useAppSelector(
    (state) => state.conversation.conversations,
  );
  const isLoading = useAppSelector((state) => state.conversation.isLoading);
  const error = useAppSelector((state) => state.conversation.error);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [selectedCategories, setSelectedCategories] = useState<
    FilterCategory[]
  >([]);
  const [onlyStrangers, setOnlyStrangers] = useState(false);
  const [hideTargetConversation, setHideTargetConversation] =
    useState<ConversationItemType | null>(null);
  const [hidePinLoading, setHidePinLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      );
    });
  }, [conversations]);

  const visibleConversations = useMemo(() => {
    return sortedConversations.filter((conversation) => {
      if (conversation.hidden) return false;
      if (activeTab === "unread" && conversation.unreadCount <= 0) return false;
      if (onlyStrangers && !conversation.isStranger) return false;
      if (selectedCategories.length === 0) return true;

      return (
        conversation.category !== null &&
        conversation.category !== undefined &&
        selectedCategories.includes(conversation.category as FilterCategory)
      );
    });
  }, [activeTab, onlyStrangers, selectedCategories, sortedConversations]);

  const toggleCategoryFilter = (category: FilterCategory) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const handleRequestHideConversation = (conversation: ConversationItemType) => {
    setHideTargetConversation(conversation);
  };

  const handleSubmitHideConversationPin = async (pin: string) => {
    if (!hideTargetConversation || !user?.userId) return;

    const newHidden = !hideTargetConversation.hidden;
    setHidePinLoading(true);

    try {
      const res = newHidden
        ? await hideConversation(
            user.userId,
            hideTargetConversation.conversationId,
            pin,
          )
        : await unhideConversation(
            user.userId,
            hideTargetConversation.conversationId,
            pin,
          );

      if (!res?.success) {
        throw new Error(res?.message || "Hide conversation failed");
      }

      dispatch(
        updateConversationSetting({
          conversationId: hideTargetConversation.conversationId,
          hidden: newHidden,
        }),
      );

      const shouldNavigateHome =
        newHidden && id === hideTargetConversation.conversationId;

      setHideTargetConversation(null);

      if (shouldNavigateHome) {
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("Hide failed:", error);
      toast.error(
        (error as any)?.response?.data?.message ||
          "Không thể cập nhật trạng thái ẩn trò chuyện",
      );
    } finally {
      setHidePinLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConversationPinDialog
        open={!!hideTargetConversation}
        title={
          hideTargetConversation?.hidden
            ? "Nhập mã PIN để gỡ ẩn trò chuyện"
            : "Nhập mã PIN để ẩn trò chuyện"
        }
        description={
          hideTargetConversation?.hidden
            ? "Nhập đúng mã PIN 4 số để xác nhận gỡ ẩn cuộc trò chuyện."
            : "Nếu đây là lần đầu, mã PIN 4 số này sẽ được dùng cho các lần ẩn hoặc gỡ ẩn tiếp theo."
        }
        confirmLabel={hideTargetConversation?.hidden ? "Gỡ ẩn" : "Ẩn"}
        loading={hidePinLoading}
        onClose={() => {
          if (hidePinLoading) return;
          setHideTargetConversation(null);
        }}
        onSubmit={handleSubmitHideConversationPin}
      />

      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "cursor-pointer border-b-2 pb-1 text-[13px] transition-colors",
              activeTab === "all"
                ? "border-[#0091ff] font-semibold text-[#0091ff]"
                : "border-transparent font-medium text-gray-500 hover:text-gray-700",
            )}
          >
            Tất cả
          </button>
          <button
            onClick={() => setActiveTab("unread")}
            className={cn(
              "cursor-pointer border-b-2 pb-1 text-[13px] transition-colors",
              activeTab === "unread"
                ? "border-[#0091ff] font-semibold text-[#0091ff]"
                : "border-transparent font-medium text-gray-500 hover:text-gray-700",
            )}
          >
            Chưa đọc
          </button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] font-medium hover:bg-[#f1f2f4]",
                  selectedCategories.length > 0 || onlyStrangers
                    ? "bg-[#e8f1ff] text-[#0068ff] hover:bg-[#dce9ff]"
                    : "text-gray-500",
                )}
              >
                {selectedCategories.length > 0 ? (
                  <>
                    <span>{selectedCategories.length} thẻ</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#0068ff] text-white"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedCategories([]);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedCategories([]);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </>
                ) : onlyStrangers ? (
                  <>
                    <span>Người lạ</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#0068ff] text-white"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOnlyStrangers(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setOnlyStrangers(false);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </>
                ) : (
                  <>
                    <span>Phân loại</span>
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent  
              align="end"
              className="w-[292px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl"
            >
              <DropdownMenuLabel className="px-3 py-2 text-[13px] font-medium text-gray-700">
                Theo thẻ phân loại
              </DropdownMenuLabel>

              {CATEGORY_FILTERS.map((category) => {
                const checked = selectedCategories.includes(category.value);

                return (
                  <DropdownMenuCheckboxItem
                    key={category.value}
                    checked={checked}
                    onCheckedChange={() => toggleCategoryFilter(category.value)}
                    className={cn(
                      "mb-1 rounded-xl px-3 py-3 pl-10 text-[15px] text-gray-700 outline-none",
                      "focus:bg-[#edf4ff] focus:text-gray-900",
                      checked && "bg-[#edf4ff]",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn("h-4 w-5 rounded-r-md", category.color)} />
                      <span>{category.label}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              })}

              <DropdownMenuCheckboxItem
                checked={onlyStrangers}
                onCheckedChange={() => setOnlyStrangers((current) => !current)}
                className={cn(
                  "mb-1 rounded-xl px-3 py-3 pl-10 text-[15px] text-gray-700 outline-none",
                  "focus:bg-[#edf4ff] focus:text-gray-900",
                  onlyStrangers && "bg-[#edf4ff]",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-4 w-5 items-center justify-center text-[#172b4d]">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span>Tin nhắn từ người lạ</span>
                </span>
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator className="mx-2 my-2 bg-gray-100" />

              <button
                type="button"
                className="w-full rounded-xl px-3 py-3 text-center text-[15px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Quản lý thẻ phân loại
              </button>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500 hover:bg-[#f1f2f4]"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="sidebar-scrollbar flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {isLoading && conversations.length === 0 && (
          <div className="py-6 text-center text-sm italic text-gray-400">
            Đang tải hội thoại...
          </div>
        )}

        {!isLoading && error && (
          <div className="py-6 text-center text-sm text-red-400">{error}</div>
        )}

        {!isLoading && !error && visibleConversations.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">
            Không có cuộc trò chuyện nào
          </div>
        )}

        {visibleConversations.map((conversation) => (
          <ConversationListItem
            key={conversation.conversationId}
            conversation={conversation}
            isActive={id === conversation.conversationId}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            onRequestHideConversation={handleRequestHideConversation}
          />
        ))}
      </div>
    </div>
  );
};

export default ConversationList;
