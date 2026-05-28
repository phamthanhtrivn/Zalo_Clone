import React, { useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { Search, Clock, Settings, Plus, Maximize2 } from "lucide-react";
import { STICKER_PACKS, type StickerPack } from "@/constants/stickers";

type TabType = "STICKER" | "EMOJI";

interface Props {
  onSelectEmoji: (emoji: EmojiClickData) => void;
  onSelectSticker: (url: string) => void;
  onClose?: () => void;
}

const StickerPickerPanel = ({ onSelectEmoji, onSelectSticker, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<TabType>("STICKER");
  const [selectedPackId, setSelectedPackId] = useState<string>(STICKER_PACKS[0].id);
  const [searchQuery, setSearchQuery] = useState("");

  const currentPack = STICKER_PACKS.find(p => p.id === selectedPackId) || STICKER_PACKS[0];

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-gray-200 overflow-hidden w-[360px] h-[450px]">
      {/* Header Tabs */}
      <div className="flex items-center px-4 pt-2 border-b">
        <div className="flex flex-1 gap-6">
          <button
            onClick={() => setActiveTab("STICKER")}
            className={`pb-2 text-sm font-semibold transition-colors ${activeTab === "STICKER"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            STICKER
          </button>
          <button
            onClick={() => setActiveTab("EMOJI")}
            className={`pb-2 text-sm font-semibold transition-colors ${activeTab === "EMOJI"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            EMOJI
          </button>
        </div>
        <button
          onClick={onClose}
          className="pb-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "EMOJI" && (
          <div className="w-full h-full">
            <EmojiPicker
              onEmojiClick={onSelectEmoji}
              previewConfig={{ showPreview: false }}
              width="100%"
              height="100%"
              skinTonesDisabled
            />
          </div>
        )}

        {activeTab === "STICKER" && (
          <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-3 border-b">
              <div className="relative flex items-center">
                <Search
                  size={16}
                  className="absolute left-3 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm sticker"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 text-sm rounded-full py-1.5 pl-9 pr-4 outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 transition-all"
                />
              </div>
            </div>

            {/* Sticker Grid */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Stickers</h3>
              <div className="grid grid-cols-4 gap-3">
                {currentPack.stickers.map((url, index) => (
                  <div
                    key={index}
                    onClick={() => onSelectSticker(url)}
                    className="aspect-square flex items-center justify-center p-1 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <img
                      src={url}
                      alt={`sticker-${index}`}
                      className="w-full h-full object-contain pointer-events-none select-none"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="border-t px-2 py-2 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 mr-2">
                <button className="p-1.5 rounded-md bg-white border border-gray-200 text-blue-500 shrink-0 hover:bg-gray-100">
                  <Clock size={18} />
                </button>
                {/* Dynamic Pack Icons */}
                {STICKER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`w-8 h-8 rounded-md shrink-0 p-1 transition-colors cursor-pointer ${selectedPackId === pack.id ? 'bg-gray-300' : 'hover:bg-gray-200'
                      }`}
                  >
                    <img src={pack.packIcon} className="w-full h-full object-contain" alt={pack.id} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0 border-l pl-2">
                <button className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                  <Settings size={18} />
                </button>
                <button className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPickerPanel;
