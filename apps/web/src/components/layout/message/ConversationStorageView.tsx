import { useState, useMemo } from "react";
import {
  ChevronLeft,
  Download,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  CheckCircle2,
  Calendar,
  User,
  Loader2,
} from "lucide-react";
import { getFileIcon } from "@/utils/file-icon.util";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { messageService } from "@/services/message.service";
import { useQuery } from "@tanstack/react-query";
import { ImageViewer } from "./ImageViewer";

interface ConversationStorageViewProps {
  onBack: () => void;
  initialTab?: "media" | "files" | "links";
  conversationId: string;
  members: any[];
  currentUserId: string;
}

export const ConversationStorageView = ({
  onBack,
  initialTab = "media",
  conversationId,
  members,
  currentUserId,
}: ConversationStorageViewProps) => {
  const [activeTab, setActiveTab] = useState<"media" | "files" | "links">(initialTab);
  const [senderFilter, setSenderFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Image viewer states
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // React Query for caching and fetching items dynamically
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: [
      "conversationStorage",
      conversationId,
      activeTab,
      senderFilter,
      dateFilter,
      currentUserId,
    ],
    queryFn: async () => {
      // Date boundary parsing
      let fromDate: string | undefined;
      let toDate: string | undefined;
      const today = new Date();

      if (dateFilter === "today") {
        fromDate = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        toDate = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateFilter === "week") {
        fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === "month") {
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      }

      console.log(`[ReactQuery-Storage] Fetching for tab: ${activeTab}, filters: sender=${senderFilter}, date=${dateFilter}`);
      const res = await messageService.getMediasFileType(conversationId, {
        userId: currentUserId,
        type: activeTab === "media" ? "IMAGE" : activeTab === "files" ? "FILE" : "LINK",
        senderId: senderFilter !== "all" ? senderFilter : undefined,
        fromDate,
        toDate,
        limit: 100,
      });

      return Array.isArray(res) ? res : res.data?.messages || res.messages || [];
    },
    enabled: !!conversationId && !!currentUserId,
    staleTime: 1000 * 60 * 5, // Cache entries for 5 minutes
  });

  // Formatter for grouping headers
  const getGroupDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return `Ngày ${d.getDate()} Tháng ${d.getMonth() + 1}`;
  };

  // Get sender name
  const getSenderName = (item: any) => {
    const sender = item.senderId;
    if (!sender) return "Người dùng";
    if (typeof sender === "object") {
      return sender.profile?.name || sender.name || "Người dùng";
    }
    // Lookup in members list if it's just an ID
    const memberObj = members.find(
      (m: any) => String(m.userId?._id || m.userId) === String(sender)
    );
    if (memberObj) {
      if (memberObj.userId && typeof memberObj.userId === "object") {
        return memberObj.userId.profile?.name || memberObj.userId.name || "Người dùng";
      }
      return memberObj.name || "Người dùng";
    }
    return "Người dùng";
  };

  // Download single file helper
  const handleDownload = (file: any) => {
    try {
      saveAs(file.fileKey, file.fileName);
      toast.success("Đang tải file xuống...");
    } catch {
      toast.error("Không thể tải file xuống.");
    }
  };

  // Group active items by date label
  const groupedItems = useMemo(() => {
    const groups: { [label: string]: any[] } = {};
    items.forEach((item) => {
      const label = getGroupDateLabel(item.createdAt);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
    });
    return groups;
  }, [items]);

  // Extract all media items for the ImageViewer gallery
  const mediaViewerItems = useMemo(() => {
    return items
      .filter((item) => item.content?.file?.type === "IMAGE" || item.content?.file?.type === "VIDEO")
      .map((item) => ({
        url: item.content.file.fileKey,
        type: item.content.file.type,
        fileName: item.content.file.fileName,
      }));
  }, [items]);

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDownloadSelected = () => {
    if (selectedItems.length === 0) return;
    items
      .filter((item) => selectedItems.includes(item._id))
      .forEach((item) => {
        const file = item.content?.file;
        if (file) handleDownload(file);
      });
    toast.success(`Đã tải xuống ${selectedItems.length} mục đã chọn`);
    setIsSelectMode(false);
    setSelectedItems([]);
  };

  return (
    <div className="w-full h-full bg-gray-50 flex flex-col animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="h-14 bg-white border-b px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer text-gray-700"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-[15px] font-bold text-gray-800">
            Kho lưu trữ
          </span>
        </div>

        <button
          onClick={() => {
            setIsSelectMode(!isSelectMode);
            setSelectedItems([]);
          }}
          className="text-xs font-semibold text-[#0068ff] hover:text-[#005ae0] cursor-pointer"
        >
          {isSelectMode ? "Hủy" : "Chọn"}
        </button>
      </div>

      {/* Multi-select bar */}
      {isSelectMode && (
        <div className="bg-[#E5F1FF] border-b px-4 py-2 flex items-center justify-between shrink-0 animate-in slide-in-from-top duration-200">
          <span className="text-xs font-semibold text-[#104EAD]">
            Đã chọn {selectedItems.length} mục
          </span>
          <div className="flex gap-2">
            <button
              disabled={selectedItems.length === 0}
              onClick={handleDownloadSelected}
              className="flex items-center gap-1.5 bg-[#0068ff] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#005ae0] transition disabled:opacity-50 cursor-pointer"
            >
              <Download size={12} />
              Tải xuống
            </button>
          </div>
        </div>
      )}

      {/* Tab Selection */}
      <div className="bg-white border-b flex justify-around shrink-0">
        {(
          [
            { id: "media", label: "Ảnh/Video" },
            { id: "files", label: "Files" },
            { id: "links", label: "Links" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedItems([]);
              }}
              className={`py-3 px-2 font-semibold text-[13px] transition-all border-b-2 cursor-pointer ${
                isActive
                  ? "border-[#0068ff] text-[#0068ff]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters Dropdowns */}
      <div className="bg-white px-3 py-2 border-b flex gap-2 shrink-0">
        {/* Sender Filter */}
        <div className="flex-1 relative">
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            className="w-full bg-gray-100/80 border border-gray-200 text-[11px] font-medium rounded-xl px-2 py-1.5 outline-none cursor-pointer hover:bg-gray-100 transition text-gray-700 appearance-none pr-6"
          >
            <option value="all">Người gửi: Tất cả</option>
            {members.map((m: any) => {
              const uid = m.userId?._id || m.userId;
              const name = m.userId?.profile?.name || m.name || "Người dùng";
              return (
                <option key={uid} value={uid}>
                  {name}
                </option>
              );
            })}
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <User size={11} />
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex-1 relative">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-gray-100/80 border border-gray-200 text-[11px] font-medium rounded-xl px-2 py-1.5 outline-none cursor-pointer hover:bg-gray-100 transition text-gray-700 appearance-none pr-6"
          >
            <option value="all">Ngày gửi: Tất cả</option>
            <option value="today">Hôm nay</option>
            <option value="week">1 tuần gần đây</option>
            <option value="month">Tháng này</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <Calendar size={11} />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <Loader2 className="animate-spin text-[#0068ff]" size={22} />
            <span className="text-xs font-medium">Đang tải dữ liệu...</span>
          </div>
        ) : Object.keys(groupedItems).length > 0 ? (
          Object.keys(groupedItems).map((dateLabel) => {
            const groupList = groupedItems[dateLabel];
            return (
              <div key={dateLabel} className="space-y-2">
                {/* Date Header */}
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                  {dateLabel}
                </h3>

                {/* Grid or List based on activeTab */}
                {activeTab === "media" ? (
                  <div className="grid grid-cols-3 gap-1">
                    {groupList.map((item, idx) => {
                      const file = item.content?.file;
                      if (!file) return null;
                      const isVideo = file?.type === "VIDEO";
                      const isSelected = selectedItems.includes(item._id);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelectMode) {
                              toggleSelectItem(item._id);
                            } else {
                              const targetIndex = mediaViewerItems.findIndex(
                                (m) => m.url === file.fileKey
                              );
                              if (targetIndex !== -1) {
                                setViewerIndex(targetIndex);
                                setViewerOpen(true);
                              }
                            }
                          }}
                          className={`aspect-square bg-gray-100 border overflow-hidden relative cursor-pointer rounded-lg transition ${
                            isSelected
                              ? "border-2 border-[#0068ff] scale-[0.96]"
                              : "border-gray-200/60 hover:scale-[0.98]"
                          }`}
                        >
                          {isVideo ? (
                            <div className="w-full h-full relative">
                              <video
                                src={file?.fileKey}
                                className="w-full h-full object-cover"
                                muted
                              />
                              <div className="absolute inset-0 bg-black/15 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
                                  <div className="ml-0.5 border-l-5 border-l-white border-y-3 border-y-transparent" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={file?.fileKey}
                              className="w-full h-full object-cover"
                              alt=""
                            />
                          )}

                          {/* Overlay checkmark or details */}
                          {isSelectMode && (
                            <div className="absolute top-1 right-1">
                              <CheckCircle2
                                size={14}
                                className={
                                  isSelected
                                    ? "text-[#0068ff] fill-white"
                                    : "text-white/60 fill-black/20"
                                }
                              />
                            </div>
                          )}

                          {!isSelectMode && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 hover:opacity-100 transition-opacity flex justify-between items-center">
                              <span className="text-[8px] text-white truncate max-w-[70%]">
                                {getSenderName(item)}
                              </span>
                              <Download
                                size={8}
                                className="text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : activeTab === "files" ? (
                  <div className="space-y-1">
                    {groupList.map((item, idx) => {
                      const file = item.content?.file;
                      if (!file) return null;
                      const isSelected = selectedItems.includes(item._id);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelectMode) {
                              toggleSelectItem(item._id);
                            } else {
                              handleDownload(file);
                            }
                          }}
                          className={`flex items-center gap-2.5 p-2 bg-white border rounded-lg transition cursor-pointer ${
                            isSelected
                              ? "border-[#0068ff] bg-blue-50/10"
                              : "border-gray-200/60 hover:bg-gray-50/50"
                          }`}
                        >
                          {isSelectMode && (
                            <CheckCircle2
                              size={16}
                              className={
                                isSelected ? "text-[#0068ff] fill-white shrink-0" : "text-gray-300 shrink-0"
                              }
                            />
                          )}
                          <div className="shrink-0">
                            {getFileIcon(file.fileName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-gray-800 truncate">
                              {file.fileName}
                            </p>
                            <p className="text-[9px] text-gray-500 font-medium mt-0.5">
                              {(file.fileSize / 1024).toFixed(1)} KB • {getSenderName(item)}
                            </p>
                          </div>
                          {!isSelectMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(file);
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 cursor-pointer shrink-0"
                            >
                              <Download size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {groupList.map((item, idx) => {
                      const url = item.content?.text;
                      const isSelected = selectedItems.includes(item._id);
                      const getDomain = (u: string) => {
                        try {
                          return new URL(u).hostname.replace("www.", "");
                        } catch {
                          return u;
                        }
                      };

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelectMode) {
                              toggleSelectItem(item._id);
                            } else {
                              window.open(url, "_blank", "noopener,noreferrer");
                            }
                          }}
                          className={`flex items-center gap-2.5 p-2 bg-white border rounded-lg transition cursor-pointer ${
                            isSelected
                              ? "border-[#0068ff] bg-blue-50/10"
                              : "border-gray-200/60 hover:bg-gray-50/50"
                          }`}
                        >
                          {isSelectMode && (
                            <CheckCircle2
                              size={16}
                              className={
                                isSelected ? "text-[#0068ff] fill-white shrink-0" : "text-gray-300 shrink-0"
                              }
                            />
                          )}
                          <div className="w-7 h-7 flex items-center justify-center bg-blue-50/50 rounded shrink-0">
                            <LinkIcon size={12} className="text-[#0068ff]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#0068ff] truncate">
                              {url}
                            </p>
                            <p className="text-[9px] text-gray-500 font-medium mt-0.5">
                              {getDomain(url)} • {getSenderName(item)}
                            </p>
                          </div>
                          {!isSelectMode && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 shrink-0"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-2">
              <FileText size={22} />
            </div>
            <p className="text-xs font-semibold text-gray-700">
              Kho lưu trữ trống
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Không tìm thấy dữ liệu phù hợp với bộ lọc
            </p>
          </div>
        )}
      </div>
      <ImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        items={mediaViewerItems}
        initialIndex={viewerIndex}
      />
    </div>
  );
};
