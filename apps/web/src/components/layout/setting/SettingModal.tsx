import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Shield, Lock } from "lucide-react";
import AccountSetting from "./AccountSetting";
import PrivacySetting from "./PrivacySetting";

// Định nghĩa danh sách các tab để dễ dàng map ra UI
const SETTING_TABS = [
  { id: "account", label: "Tài khoản và bảo mật", icon: Shield },
  { id: "privacy", label: "Quyền riêng tư", icon: Lock },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("account");

  if (!isOpen) return null;

  return createPortal(
    // Overlay: Lớp phủ mờ đen
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex w-250 h-[85%] bg-[#f4f5f7] rounded-lg overflow-hidden shadow-2xl relative">
        {/* Nút Close (Đặt absolute ở góc trên bên phải) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-500 hover:bg-gray-200 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* CỘT TRÁI: Sidebar */}
        <div className="w-55 bg-white flex flex-col h-full shrink-0">
          <div className="p-5">
            <h2 className="text-lg font-semibold text-gray-800">Cài đặt</h2>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <nav className="flex flex-col pb-4">
              {SETTING_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-3 py-3 mx-2 rounded-md transition-colors hover:cursor-pointer ${isActive
                      ? "bg-[#e5efff] text-[#0f6bf5]"
                      : "text-gray-700 hover:bg-gray-100"
                      }`}
                  >
                    <Icon
                      size={18}
                      className={`mr-3 ${isActive ? "text-[#005ae0]" : "text-gray-500"}`}
                    />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* CỘT PHẢI: Content Area */}
        <div className="flex-1 overflow-y-auto px-5 py-7 relative custom-scrollbar">
          {activeTab === "account" && <AccountSetting />}
          {activeTab === "privacy" && <PrivacySetting />}
        </div>
      </div>
    </div>,
    document.body,
  );
};
