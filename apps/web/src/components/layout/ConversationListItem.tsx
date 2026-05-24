import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Users } from "lucide-react";
import { MdGroups, MdNotificationsOff } from "react-icons/md";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { PiPushPinFill } from "react-icons/pi";
import { IoCheckmark } from "react-icons/io5";
import { CiImageOn } from "react-icons/ci";
import { RiVideoLine } from "react-icons/ri";
import { LuSticker } from "react-icons/lu";
import { HiMiniLink } from "react-icons/hi2";
import { GoFileSymlinkFile } from "react-icons/go";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/utils/format-message-time..util";
import AppAvatar from "../common/AppAvatar";
import {
  pinConversation,
  unpinConversation,
  hideConversation,
  unhideConversation,
  muteConversation,
  unmuteConversation,
  setCategory,
  deleteConversation,
  expireMessage,
} from "@/services/conversation-settings.service";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  updateConversationSetting,
  setCategoryLocal,
  removeConversation,
  setUnreadCount,
} from "@/store/slices/conversationSlice";
import { IoMicOutline } from "react-icons/io5";
import { useSocket } from "@/contexts/SocketContext";
import type {
  ConversationCategory,
  ConversationItemType,
} from "@/types/conversation-item.type";
import ConversationPinDialog from "./ConversationPinDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  conversation: ConversationItemType;
  isActive: boolean;
  openMenu: string | null;
  setOpenMenu: React.Dispatch<React.SetStateAction<string | null>>;
};

const CATEGORY_STYLE = {
  customer: "bg-red-500 before:bg-red-500",
  family: "bg-green-500 before:bg-green-500",
  work: "bg-orange-500 before:bg-orange-500",
  friends: "bg-purple-500 before:bg-purple-500",
  later: "bg-yellow-500 before:bg-yellow-500",
  colleague: "bg-blue-500 before:bg-blue-500",
} as const;

const CATEGORY_LABEL: Record<Exclude<ConversationCategory, null>, string> = {
  customer: "Khách hàng",
  family: "Gia đình",
  work: "Công việc",
  friends: "Bạn bè",
  later: "Trả lời sau",
  colleague: "Đồng nghiệp",
};

const CATEGORY_SHORT: Record<Exclude<ConversationCategory, null>, string> = {
  customer: "KH",
  family: "GĐ",
  work: "CV",
  friends: "BB",
  later: "Sau",
  colleague: "ĐN",
};

const CATEGORY_DOT: Record<Exclude<ConversationCategory, null>, string> = {
  customer: "bg-red-500",
  family: "bg-green-500",
  work: "bg-orange-500",
  friends: "bg-purple-500",
  later: "bg-yellow-500",
  colleague: "bg-blue-500",
};

const CATEGORY_VALUES: Exclude<ConversationCategory, null>[] = [
  "customer",
  "family",
  "work",
  "friends",
  "later",
  "colleague",
];

const CATEGORY_LABEL_DISPLAY: Record<
  Exclude<ConversationCategory, null>,
  string
> = {
  customer: "Khách hàng",
  family: "Gia đình",
  work: "Công việc",
  friends: "Bạn bè",
  later: "Trả lời sau",
  colleague: "Đồng nghiệp",
};

const CATEGORY_SHORT_DISPLAY: Record<
  Exclude<ConversationCategory, null>,
  string
> = {
  customer: "KH",
  family: "GĐ",
  work: "CV",
  friends: "BB",
  later: "Sau",
  colleague: "ĐN",
};

const getIsExpired = (expired?: boolean, expiredAt?: string | null) => {
  if (expired) return true;
  if (!expiredAt) return false;
  const ms = new Date(expiredAt).getTime();
  if (Number.isNaN(ms)) return Boolean(expired);
  return ms <= Date.now();
};

const ConversationListItem = ({
  conversation,
  isActive,
  openMenu,
  setOpenMenu,
}: Props) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { socket, markAsRead, markAsUnread } = useSocket();
  const [hoverMenu, setHoverMenu] = useState<string | null>(null);
  const [hidePinOpen, setHidePinOpen] = useState(false);
  const [hidePinLoading, setHidePinLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isLastMessageExpired, setIsLastMessageExpired] = useState(() =>
    getIsExpired(
      conversation.lastMessage?.expired,
      conversation.lastMessage?.expiresAt,
    ),
  );
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const closeSubMenu = () => setHoverMenu(null);
  const isDirect = conversation.type === "DIRECT";

  const handleConversationClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      navigate(`/conversation/${conversation.conversationId}`);

      if (conversation.unreadCount > 0 && user?.userId && socket) {
        dispatch(
          setUnreadCount({
            conversationId: conversation.conversationId,
            unreadCount: 0,
          }),
        );

        try {
          await markAsRead({
            userId: user.userId,
            conversationId: conversation.conversationId,
          });
        } catch (error) {
          console.error("Failed to mark as read:", error);
          dispatch(
            setUnreadCount({
              conversationId: conversation.conversationId,
              unreadCount: conversation.unreadCount,
            }),
          );
        }
      }
    },
    [conversation, dispatch, markAsRead, navigate, socket, user],
  );

  const handleMarkUnread = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);

    if (!user?.userId) return;

    const prevUnreadCount = conversation.unreadCount;
    const isCurrentlyUnread = prevUnreadCount > 0;

    dispatch(
      setUnreadCount({
        conversationId: conversation.conversationId,
        unreadCount: isCurrentlyUnread ? 0 : 1,
      }),
    );

    try {
      if (isCurrentlyUnread) {
        await markAsRead({
          userId: user.userId,
          conversationId: conversation.conversationId,
        });
      } else {
        await markAsUnread({
          userId: user.userId,
          conversationId: conversation.conversationId,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      dispatch(
        setUnreadCount({
          conversationId: conversation.conversationId,
          unreadCount: prevUnreadCount,
        }),
      );
    }
  };

  const { refs, floatingStyles } = useFloating({
    placement: "bottom-end",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { refs: subRefs, floatingStyles: subFloatingStyles } = useFloating({
    placement: "right-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    const lastMessage = conversation.lastMessage;

    if (lastMessage?.expired) {
      setIsLastMessageExpired(true);
      return;
    }

    if (!lastMessage?.expiresAt) {
      setIsLastMessageExpired(false);
      return;
    }

    const expiredAtMs = new Date(lastMessage.expiresAt).getTime();
    if (Number.isNaN(expiredAtMs)) {
      setIsLastMessageExpired(Boolean(lastMessage.expired));
      return;
    }

    const remainingMs = expiredAtMs - Date.now();
    if (remainingMs <= 0) {
      setIsLastMessageExpired(true);
      return;
    }

    setIsLastMessageExpired(false);
    const timeoutId = window.setTimeout(
      () => setIsLastMessageExpired(true),
      remainingMs + 50,
    );

    return () => window.clearTimeout(timeoutId);
  }, [conversation.lastMessage]);

  const previewDisplay = useMemo(() => {
    const lastMsg = conversation.lastMessage;
    const content = lastMsg?.content;

    if (!lastMsg?._id) {
      return {
        showSender: false,
        content: "Chưa có tin nhắn",
      };
    }

    if (lastMsg.recalled) {
      return {
        showSender: true,
        content: "Tin nhắn đã được thu hồi",
      };
    }

    if (isLastMessageExpired) {
      return {
        showSender: true,
        content: "Tin nhắn đã hết hạn",
      };
    }

    if (lastMsg.call?.type) {
      const isVideo = lastMsg.call.type === "VIDEO";
      const isMe = lastMsg.senderName === "Bạn";
      let text = isMe
        ? `Cuộc gọi ${isVideo ? "video" : "thoại"} đi`
        : `Cuộc gọi ${isVideo ? "video" : "thoại"} đến`;

      switch (lastMsg.call.status) {
        case "MISSED":
          text = "Cuộc gọi nhỡ";
          break;
        case "REJECTED":
          text = isMe ? "Cuộc gọi bị từ chối" : "Cuộc gọi nhỡ";
          break;
        case "BUSY":
          text = "Máy bận";
          break;
        case "ENDED":
        case "ACCEPTED":
          text = `Cuộc gọi ${isVideo ? "video" : "thoại"}`;
          break;
        default:
          break;
      }

      return {
        showSender: false,
        content: text,
      };
    }

    if (!content) {
      return {
        showSender: false,
        content: "Tin nhắn mới",
      };
    }

    let icon: React.ReactNode = null;
    let text = "";

    if ((content as any).storyLink?.storyId) {
      return {
        showSender: true,
        content: (
          <span className="flex items-center gap-1 truncate">
            <span className="rounded-full bg-sky-100 px-1.5 py-[1px] text-[10px] font-semibold text-sky-700">
              Story
            </span>
            <span className="truncate">
              {content.text
                ? `Trả lời story: ${content.text}`
                : `Trả lời story: ${(content as any).storyLink.previewText || "Xem lại story"}`}
            </span>
          </span>
        ),
      };
    }

    if (content.text && /https?:\/\//.test(content.text)) {
      icon = <HiMiniLink />;
      text = content.text;
    } else if ((content as any).icon) {
      icon = <LuSticker />;
      text = "Sticker";
    } else if (Array.isArray((content as any).files) && (content as any).files.length > 0) {
      switch ((content as any).files[(content as any).files.length - 1].type) {
        case "IMAGE":
          icon = <CiImageOn />;
          text = "Hình ảnh";
          break;
        case "VIDEO":
          icon = <RiVideoLine />;
          text = "Video";
          break;
        case "FILE":
          icon = <GoFileSymlinkFile />;
          text = (content as any).files[0].fileName;
          break;
        case "VOICE":
          icon = <IoMicOutline />;
          text = "Tin nhắn thoại";
          break;
        default:
          text = "";
      }
    } else if (content.text) {
      text = content.text;
    }

    if (!text) {
      text = "Tin nhắn mới";
    }

    return {
      showSender: true,
      content: (
        <span className="flex items-center gap-1 truncate">
          {icon}
          <span className="truncate">{text}</span>
        </span>
      ),
    };
  }, [conversation.lastMessage, isLastMessageExpired]);

  const previewSenderPrefix = useMemo(() => {
    if (!previewDisplay.showSender) return "";
    if (
      conversation.type === "DIRECT" &&
      conversation.lastMessage?.senderName !== "Bạn"
    ) {
      return "";
    }
    return `${conversation.lastMessage?.senderName ?? ""}: `;
  }, [
    conversation.lastMessage?.senderName,
    conversation.type,
    previewDisplay.showSender,
  ]);

  const previewData = useMemo(() => {
    const lastMsg = conversation.lastMessage;

    if (!lastMsg?._id) {
      return {
        showSender: false,
        content: "Chưa có tin nhắn",
      };
    }

    if (lastMsg.recalled) {
      return {
        showSender: true,
        content: "Tin nhắn đã bị thu hồi",
      };
    }

    if (isLastMessageExpired) {
      return {
        showSender: true,
        content: "Tin nhắn đã hết hạn",
      };
    }

    if (lastMsg.call?.type) {
      const isVideo = lastMsg.call.type === "VIDEO";
      const isMe = lastMsg.senderName === "Bạn";
      let text = isMe
        ? `Cuộc gọi ${isVideo ? "video" : "thoại"} đi`
        : `Cuộc gọi ${isVideo ? "video" : "thoại"} đến`;

      switch (lastMsg.call.status) {
        case "MISSED":
          text = isMe ? "Bạn đã gọi nhỡ" : "Cuộc gọi nhỡ";
          break;
        case "REJECTED":
          text = isMe ? "Cuộc gọi bị từ chối" : "Bạn đã từ chối cuộc gọi";
          break;
        case "BUSY":
          text = "Máy bận";
          break;
        case "ENDED":
        case "ACCEPTED":
          text = `Cuộc gọi ${isVideo ? "video" : "thoại"}`;
          break;
        default:
          break;
      }

      return {
        showSender: false,
        content: text,
      };
    }

    const content = lastMsg.content;
    if (!content) {
      return {
        showSender: false,
        content: "Tin nhắn mới",
      };
    }

    let icon: React.ReactNode = null;
    let text = "";

    if (content.storyLink?.storyId) {
      return {
        showSender: true,
        content: (
          <span className="flex items-center gap-1 truncate">
            <span className="rounded-full bg-sky-100 px-1.5 py-[1px] text-[10px] font-semibold text-sky-700">
              Story
            </span>
            <span className="truncate">
              {content.text
                ? `Trả lời story: ${content.text}`
                : `Trả lời story: ${content.storyLink.previewText || "Xem lại story"}`}
            </span>
          </span>
        ),
      };
    }

    if (content.text && /https?:\/\//.test(content.text)) {
      icon = <HiMiniLink />;
      text = content.text;
    } else if (content.icon) {
      icon = <LuSticker />;
      text = "Sticker";
    } else if (Array.isArray(content.files) && content.files.length > 0) {
      switch (content.files[content.files.length - 1].type) {
        case "IMAGE":
          icon = <CiImageOn />;
          text = "Hình ảnh";
          break;
        case "VIDEO":
          icon = <RiVideoLine />;
          text = "Video";
          break;
        case "FILE":
          icon = <GoFileSymlinkFile />;
          text = content.files[0].fileName;
          break;
        case "VOICE":
          icon = <IoMicOutline />;
          text = "Tin nhắn thoại";
          break;
        default:
          text = "";
      }
    } else if (content.text) {
      text = content.text;
    }

    if (!text) {
      text = "Tin nhắn mới";
    }

    return {
      showSender: true,
      content: (
        <span className="flex items-center gap-1 truncate">
          {icon}
          <span className="truncate">{text}</span>
        </span>
      ),
    };
  }, [conversation.lastMessage, isLastMessageExpired]);

  const handlePinConversation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);
    const newPinned = !conversation.pinned;

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        pinned: newPinned,
      }),
    );

    try {
      newPinned
        ? await pinConversation(user?.userId, conversation.conversationId)
        : await unpinConversation(user?.userId, conversation.conversationId);
    } catch (error) {
      dispatch(
        updateConversationSetting({
          conversationId: conversation.conversationId,
          pinned: !newPinned,
        }),
      );
      console.error("Pin failed:", error);
    }
  };

  const handleHideConversation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);
    setHidePinOpen(true);
  };

  const submitHideConversationPin = async (pin: string) => {
    const newHidden = !conversation.hidden;
    setHidePinLoading(true);

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        hidden: newHidden,
      }),
    );

    try {
      newHidden
        ? await hideConversation(user?.userId, conversation.conversationId, pin)
        : await unhideConversation(user?.userId, conversation.conversationId, pin);
      setHidePinOpen(false);
    } catch (error) {
      dispatch(
        updateConversationSetting({
          conversationId: conversation.conversationId,
          hidden: !newHidden,
        }),
      );
      console.error("Hide failed:", error);
    } finally {
      setHidePinLoading(false);
    }
  };

  const handleMute = async (duration: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setOpenMenu(null);
    const newMuted = duration !== 0;
    const prevMuted = conversation.muted;

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        muted: newMuted,
      }),
    );

    try {
      duration === 0
        ? await unmuteConversation(user?.userId, conversation.conversationId)
        : await muteConversation(
          user?.userId,
          conversation.conversationId,
          duration,
        );
    } catch (error) {
      dispatch(
        updateConversationSetting({
          conversationId: conversation.conversationId,
          muted: prevMuted,
        }),
      );
      console.error("Mute failed:", error);
    }
  };

  const handleCategory = async (
    category: ConversationCategory,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);
    const newCategory = conversation.category === category ? null : category;

    dispatch(
      setCategoryLocal({
        conversationId: conversation.conversationId,
        category: newCategory,
      }),
    );

    try {
      await setCategory(
        user?.userId,
        conversation.conversationId,
        newCategory as any,
      );
    } catch (error) {
      dispatch(
        setCategoryLocal({
          conversationId: conversation.conversationId,
          category: conversation.category ?? null,
        }),
      );
      console.error("Set category failed:", error);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);
    setDeleteDialogOpen(true);
  };

  const handleExpire = async (days: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setOpenMenu(null);
    const duration = days === 0 ? 0 : days * 24 * 60 * 60 * 1000;
    const prevDuration = conversation.expireDuration;

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        expireDuration: duration,
      }),
    );

    try {
      await expireMessage(user?.userId, conversation.conversationId, duration);
    } catch (error) {
      dispatch(
        updateConversationSetting({
          conversationId: conversation.conversationId,
          expireDuration: prevDuration,
        }),
      );
      console.error("Set expire failed:", error);
    }
  };

  const expireDays = conversation.expireDuration
    ? conversation.expireDuration / (24 * 60 * 60 * 1000)
    : 0;

  useEffect(() => {
    if (openMenu !== conversation.conversationId) return;

    const handlePointerDownOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        menuContainerRef.current?.contains(target) ||
        refs.reference.current?.contains(target) ||
        refs.floating.current?.contains(target)
      ) {
        return;
      }

      setOpenMenu(null);
      setHoverMenu(null);
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [conversation.conversationId, openMenu, refs.floating, refs.reference, setOpenMenu]);

  return (
    <>
      <ConversationPinDialog
        open={hidePinOpen}
        title={
          conversation.hidden
            ? "Nhập mã PIN để gỡ ẩn trò chuyện"
            : "Nhập mã PIN để ẩn trò chuyện"
        }
        description={
          conversation.hidden
            ? "Nhập đúng mã PIN 4 số để xác nhận gỡ ẩn cuộc trò chuyện."
            : "Nếu đây là lần đầu, mã PIN 4 số này sẽ được dùng cho các lần ẩn hoặc gỡ ẩn tiếp theo."
        }
        confirmLabel={conversation.hidden ? "Gỡ ẩn" : "Ẩn"}
        loading={hidePinLoading}
        onClose={() => {
          if (hidePinLoading) return;
          setHidePinOpen(false);
        }}
        onSubmit={submitHideConversationPin}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[520px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận</AlertDialogTitle>
            <AlertDialogDescription className="text-[16px] leading-7 text-[#374151]">
              Toàn bộ nội dung trò chuyện sẽ bị xóa vĩnh viễn. Bạn có chắc chắn muốn xóa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteConversation(user?.userId, conversation.conversationId);
                  dispatch(removeConversation(conversation.conversationId));
                  setDeleteDialogOpen(false);
                  if (isActive) {
                    navigate("/", { replace: true });
                  }
                } catch (error) {
                  console.error("Delete failed:", error);
                }
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        onClick={handleConversationClick}
        className={cn(
          "group mx-2 mt-2 flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-colors",
          isActive ? "bg-[#e5efff]" : "hover:bg-[#f3f5f6]",
        )}
      >
        <AppAvatar
          src={conversation.avatar}
          name={conversation.name}
          isAI={conversation.type === "AI"}
          isOnline={conversation.type === "DIRECT" && conversation.isOnline}
          className="h-12 w-12"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-start justify-between gap-2">
            <h4
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 text-sm",
                conversation.unreadCount > 0
                  ? "font-semibold text-black"
                  : "font-normal text-gray-900",
                isActive ? "text-black" : "",
              )}
            >
              {conversation.type === "GROUP" && (
                <MdGroups size={18} color="gray" className="shrink-0" />
              )}
              <span className="min-w-0 truncate">{conversation.name}</span>
              {conversation.pinned && (
                <PiPushPinFill className="ml-1 h-3 w-3 shrink-0 text-blue-500" />
              )}
            </h4>

            <div className="relative flex w-[54px] shrink-0 items-start justify-end">
              {conversation.muted && (
                <MdNotificationsOff className="mr-1 h-5 w-5 shrink-0 text-gray-400" />
              )}

              <div className="flex min-w-0 flex-col items-end">
                <span className="max-w-full break-words text-right text-[11px] leading-3 text-gray-400 transition-opacity group-hover:opacity-0">
                  {formatMessageTime(conversation.lastMessageAt)}
                </span>

                {conversation.unreadCount > 0 && (
                  <span className="mt-1 rounded-full bg-red-500 px-2 py-[1px] text-[10px] text-white">
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </span>
                )}
              </div>

              <div ref={menuContainerRef}>
                <div ref={refs.setReference}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenu(
                      openMenu === conversation.conversationId
                        ? null
                        : conversation.conversationId,
                    );
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-transparent p-1 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
                >
                  <MoreHorizontal size={16} className="text-gray-500" />
                </button>
                </div>

                {openMenu === conversation.conversationId && (
                  <FloatingPortal>
                    <div
                      ref={refs.setFloating}
                      style={floatingStyles}
                      className="z-50 w-56 rounded-xl border bg-white text-sm shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        onMouseEnter={closeSubMenu}
                        className="cursor-pointer p-3 hover:bg-gray-100"
                        onClick={handlePinConversation}
                      >
                        {conversation.pinned
                          ? "Bỏ ghim hội thoại"
                          : "Ghim hội thoại"}
                      </div>

                      <div
                        ref={subRefs.setReference}
                        onMouseEnter={() => setHoverMenu("category")}
                        className="relative flex cursor-pointer justify-between p-3 hover:bg-gray-100"
                      >
                        Phân loại <span>›</span>
                        {hoverMenu === "category" && (
                          <div
                            ref={subRefs.setFloating}
                            style={subFloatingStyles}
                            onMouseEnter={() => setHoverMenu("category")}
                            onMouseLeave={closeSubMenu}
                            className="w-56 rounded-xl border bg-white text-sm shadow-lg"
                          >
                            {CATEGORY_VALUES.map((cat) => (
                              <div
                                key={cat}
                                onClick={(e) => handleCategory(cat, e)}
                                className="flex cursor-pointer items-center justify-between p-3 hover:bg-gray-100"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "h-3 w-3 rounded-sm",
                                      CATEGORY_DOT[cat],
                                    )}
                                  />
                                  {CATEGORY_LABEL_DISPLAY[cat]}
                                </div>
                                {conversation.category === cat && (
                                  <IoCheckmark className="h-4 w-4 text-blue-500" />
                                )}
                              </div>
                            ))}

                            <div className="border-t" />
                            <div className="cursor-pointer p-3 hover:bg-gray-100">
                              Quản lý thẻ phân loại
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        onMouseEnter={closeSubMenu}
                        className="cursor-pointer p-3 hover:bg-gray-100"
                        onClick={handleMarkUnread}
                      >
                        {conversation.unreadCount > 0
                          ? "Đánh dấu đã đọc"
                          : "Đánh dấu chưa đọc"}
                      </div>

                      <div className="my-1 border-t" />

                      {isDirect && (
                        <div
                          onMouseEnter={closeSubMenu}
                          className="cursor-pointer p-3 hover:bg-gray-100"
                        >
                          Thêm vào nhóm
                        </div>
                      )}

                      {!conversation.muted ? (
                        <div
                          onMouseEnter={() => setHoverMenu("mute")}
                          className="relative flex cursor-pointer justify-between p-3 hover:bg-gray-100"
                        >
                          Tắt thông báo <span>›</span>
                          {hoverMenu === "mute" && (
                            <div
                              onMouseEnter={() => setHoverMenu("mute")}
                              onMouseLeave={closeSubMenu}
                              className="absolute left-full top-0 ml-1 w-48 rounded-xl border bg-white shadow-lg"
                            >
                              {[
                                { label: "Trong 1 giờ", duration: 60 },
                                { label: "Trong 4 giờ", duration: 240 },
                                { label: "Cho đến 8:00 AM", duration: -2 },
                                { label: "Cho đến khi mở lại", duration: -1 },
                              ].map((opt) => (
                                <div
                                  key={opt.label}
                                  className="cursor-pointer p-3 hover:bg-gray-100"
                                  onClick={(e) => handleMute(opt.duration, e)}
                                >
                                  {opt.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          onMouseEnter={closeSubMenu}
                          className="cursor-pointer p-3 hover:bg-gray-100"
                          onClick={(e) => handleMute(0, e)}
                        >
                          Bật lại thông báo
                        </div>
                      )}

                      <div
                        onMouseEnter={closeSubMenu}
                        className="cursor-pointer p-3 hover:bg-gray-100"
                        onClick={handleHideConversation}
                      >
                        {conversation.hidden ? "Bỏ ẩn trò chuyện" : "Ẩn trò chuyện"}
                      </div>

                      <div
                        onMouseEnter={() => setHoverMenu("delete")}
                        className="relative flex cursor-pointer justify-between p-3 hover:bg-gray-100"
                      >
                        Tin nhắn tự xóa <span>›</span>
                        {hoverMenu === "delete" && (
                          <div className="absolute left-full top-0 ml-1 w-44 rounded-xl border bg-white shadow-lg">
                            {[
                              { label: "1 ngày", days: 1 },
                              { label: "7 ngày", days: 7 },
                              { label: "Không bao giờ", days: 0 },
                            ].map((opt) => (
                              <div
                                key={opt.label}
                                className="flex cursor-pointer justify-between p-3 hover:bg-gray-100"
                                onClick={(e) => handleExpire(opt.days, e)}
                              >
                                {opt.label}
                                {expireDays === opt.days && (
                                  <IoCheckmark className="h-4 w-4 text-blue-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="my-1 border-t" />

                      <div
                        onMouseEnter={closeSubMenu}
                        className="cursor-pointer p-3 text-red-500 hover:bg-gray-100"
                        onClick={handleDeleteConversation}
                      >
                        Xóa hội thoại
                      </div>

                      <div
                        onMouseEnter={closeSubMenu}
                        className="cursor-pointer p-3 hover:bg-gray-100"
                      >
                        Báo xấu
                      </div>
                    </div>
                  </FloatingPortal>
                )}
              </div>
            </div>
          </div>

          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-gray-500">
            {conversation.category && (
              <span
                className={cn(
                  "relative inline-flex shrink-0 items-center rounded-l-md px-2 py-[2px] text-[10px] font-medium text-white",
                  "before:absolute before:right-[-6px] before:top-0 before:h-full before:w-3 before:skew-x-[-30deg]",
                  CATEGORY_STYLE[conversation.category],
                )}
              >
                {CATEGORY_SHORT_DISPLAY[conversation.category]}
              </span>
            )}
            <span className="flex min-w-0 items-center gap-1 text-[13px] text-gray-500">
              <span className="shrink-0">{previewSenderPrefix}</span>
              <span className="hidden">
                {!previewData.showSender
                  ? ""
                  : conversation.type === "DIRECT" &&
                    conversation.lastMessage?.senderName !== "Bạn"
                    ? ""
                    : `${conversation.lastMessage?.senderName ?? ""}: `}
              </span>

              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate",
                  conversation.unreadCount > 0
                    ? "font-semibold text-gray-900"
                    : "text-gray-500",
                )}
              >
                {previewDisplay.content}
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(ConversationListItem);
