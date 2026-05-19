import React, { useState, useEffect } from "react";
import { X, Users } from "lucide-react";
import { userService } from "@/services/user.service";
import { useSelector } from "react-redux";
import FriendSearchResultItem from "./FriendSearchResultItem";
import { toast } from "react-toastify";

const AddFriendModal = ({ onClose }: any) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const userId = useSelector((item: any) => item.auth.user.userId);

  const [userSearch, setUserSearch] = useState<any>(null);
  const [suggestUsers, setSuggestUsers] = useState<any>([]);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const data = await userService.suggestFriend();
        if (data?.data) {
          setSuggestUsers(data.data);
        }
      } catch (err) {
        console.error("Lỗi lấy gợi ý:", err);
      }
    };
    fetchSuggestions();
  }, []);

  const handelSearchByPhone = async () => {
    if (!phoneNumber.trim()) return;
    try {
      const data = await userService.searchFriendByPhone(userId, phoneNumber);
      if (data.success && data.data != null) {
        setUserSearch(data.data);
      } else toast.error("Không tìm thấy");
    } catch (err) {
      console.log(err);
    }
  };

  return (
    // Lớp nền ngoài cùng vẫn giữ mờ để làm nổi bật Form trắng
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[650px] border border-gray-200">
        {/* Header - Nền trắng */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">Thêm bạn</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:bg-gray-100 p-1 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Input Section - Nền trắng */}
        <div className="p-4 flex items-center gap-3 bg-white">
          <div className="flex items-center gap-1 px-3 py-2 border-b-2 border-gray-300 transition-colors">
            <img
              src="https://flagcdn.com/w20/vn.png"
              alt="VN Flag"
              className="w-5 h-3.5 object-cover"
            />
            <span className="text-gray-700 font-medium">(+84)</span>
          </div>
          <div className="flex-1 border-b-2 border-gray-200 focus-within:border-blue-500 transition-colors">
            <input
              type="text"
              placeholder="Số điện thoại"
              className="w-full py-2 outline-none text-lg bg-white"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handelSearchByPhone()}
            />
          </div>
        </div>

        {/* Body - Nền trắng */}
        <div className="flex-1 overflow-y-auto px-4 py-2 bg-white custom-scrollbar">
          <section className="mb-6 mt-2">
            <h3 className="text-[11px] font-bold text-gray-400 mb-4 uppercase tracking-wider">
              Kết quả tìm kiếm
            </h3>
            <div className="space-y-4">
              {userSearch ? (
                <FriendSearchResultItem
                  user={{ ...userSearch, source: "Từ số điện thoại" }}
                  setSuggestUsers={setSuggestUsers}
                  setUserSearch={setUserSearch}
                />
              ) : (
                <p className="text-center text-gray-400 text-sm py-4 italic font-light">
                  Nhập số điện thoại để tìm bạn bè
                </p>
              )}
            </div>
          </section>

          <section className="mb-4">
            <h3 className="text-[11px] font-bold text-gray-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Users size={14} /> Có thể bạn quen
            </h3>
            <div className="space-y-3">
              {suggestUsers.length > 0 ? (
                <>
                  {suggestUsers.slice(0, showAllSuggestions ? suggestUsers.length : 3).map((user: any) => (
                    <FriendSearchResultItem
                      key={user.friendId}
                      user={{ ...user, source: "Gợi ý kết bạn" }}
                      setSuggestUsers={setSuggestUsers}
                      setUserSearch={setUserSearch}
                    />
                  ))}
                  {suggestUsers.length > 3 && !showAllSuggestions && (
                    <button
                      type="button"
                      onClick={() => setShowAllSuggestions(true)}
                      className="w-full py-2 text-blue-600 text-sm font-semibold hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Xem thêm
                    </button>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-400 text-sm py-2">
                  Không có gợi ý nào
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Footer - Để màu xám rất nhẹ để phân biệt với phần thân trắng */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handelSearchByPhone}
            className="px-6 py-2 bg-[#0068ff] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-md disabled:bg-blue-300"
          >
            Tìm kiếm
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
