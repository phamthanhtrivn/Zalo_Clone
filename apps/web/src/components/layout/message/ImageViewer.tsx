import { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
} from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ url: string; type?: "IMAGE" | "VIDEO"; fileName?: string }>;
  initialIndex?: number;
}

export const ImageViewer = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
}: ImageViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Reset position when scale is reset to <= 1
  useEffect(() => {
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, items]);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const isVideo = currentItem.type === "VIDEO" || currentItem.url.match(/\.(mp4|webm|ogg)/i);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = () => {
    try {
      const fileName = currentItem.fileName || `zalo_media_${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
      saveAs(currentItem.url, fileName);
      toast.success("Đang tải tệp xuống...");
    } catch {
      toast.error("Không thể tải tệp xuống.");
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || isVideo) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1 || isVideo) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (isVideo) return;
    if (scale > 1) {
      setScale(1);
    } else {
      setScale(2);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-between select-none animate-in fade-in duration-200">

      {/* Top Toolbar */}
      <div className="h-16 px-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10">
        {/* Title */}
        <div className="text-white/90 text-sm font-medium">
          Mục {currentIndex + 1} / {items.length}
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-4">
          {!isVideo && (
            <>
              <button
                onClick={handleZoomOut}
                title="Thu nhỏ"
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <ZoomOut size={20} />
              </button>
              <button
                onClick={handleZoomIn}
                title="Phóng to"
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={handleRotate}
                title="Xoay hình ảnh"
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <RotateCw size={19} />
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            title="Tải xuống"
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <Download size={20} />
          </button>

          <div className="h-5 w-[1px] bg-white/20 mx-1" />

          <button
            onClick={onClose}
            title="Đóng (ESC)"
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Main viewport */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative flex items-center justify-center overflow-hidden px-4 ${scale > 1 && !isVideo ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
      >
        {/* Navigation Arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer z-10"
            >
              <ChevronLeft size={36} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer z-10"
            >
              <ChevronRight size={36} />
            </button>
          </>
        )}

        {/* Content Container */}
        <div
          onDoubleClick={handleDoubleClick}
          className={`flex items-center justify-center max-w-full max-h-[80vh] ${isDragging ? "" : "transition-transform duration-200 ease-out"
            }`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
        >
          {isVideo ? (
            <video
              src={currentItem.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
          ) : (
            <img
              src={currentItem.url}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl pointer-events-none"
            />
          )}
        </div>
      </div>

      {/* Bottom Thumbnail Bar (If multiple items) */}
      {items.length > 1 && (
        <div className="h-20 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2 px-6 z-10 overflow-x-auto py-2 custom-scrollbar">
          {items.map((item, index) => {
            const isActive = index === currentIndex;
            const isThumbVideo = item.type === "VIDEO" || item.url.match(/\.(mp4|webm|ogg)/i);

            return (
              <div
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setScale(1);
                  setRotation(0);
                }}
                className={`w-12 h-12 rounded-md overflow-hidden border-2 cursor-pointer transition shrink-0 ${isActive ? "border-[#0068ff] scale-110" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
              >
                {isThumbVideo ? (
                  <div className="w-full h-full bg-gray-900 flex items-center justify-center text-[10px] text-white font-bold">
                    Vid
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
