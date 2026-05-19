import { useEffect, useMemo, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import { userService } from "@/services/user.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { useSelector } from "react-redux";

type Friend = {
  friendId: string;
  name: string;
  avatarUrl?: string;
};

type FriendGroup = {
  key: string;
  friends: Friend[];
};

export type CreateGroupModalMode = "CREATE_GROUP" | "ADD_MEMBER";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: CreateGroupModalMode;
  /** Bắt buộc khi mode === ADD_MEMBER */
  conversationId?: string;
  /** Ẩn bạn đã có trong nhóm (theo userId) */
  excludeUserIds?: string[];
  onCreated?: () => void;
  onMembersAdded?: () => void;
};

const CreateGroupModal = ({
  open,
  onOpenChange,
  mode = "CREATE_GROUP",
  conversationId,
  excludeUserIds = [],
  onCreated,
  onMembersAdded,
}: Props) => {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = useSelector((item: any) => item.auth.user.userId);


  const excludeSet = useMemo(
    () => new Set(excludeUserIds.filter(Boolean)),
    [excludeUserIds],
  );

  const filteredFriends = useMemo(() => {
    return friends.filter((f) => {
      const isNotExcluded = !excludeSet.has(f.friendId);
      const matchesSearch = f.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return isNotExcluded && matchesSearch;
    });
  }, [friends, excludeSet, searchQuery]);

  useEffect(() => {
    if (!open) return;

    const loadFriends = async () => {
      try {
        setIsLoadingFriends(true);
        const response = await userService.searchFriend("",userId);
        const groups: FriendGroup[] = response?.data?.users || [];
        const flattened = groups.flatMap((group) => group.friends || []);
        setFriends(flattened);
      } catch (error) {
        setFriends([]);
      } finally {
        setIsLoadingFriends(false);
      }
    };

    loadFriends();
  }, [open]);

  const canSubmit = useMemo(() => {
    if (mode === "ADD_MEMBER") {
      return selectedMemberIds.length >= 1;
    }
    return selectedMemberIds.length >= 2;
  }, [mode, selectedMemberIds.length]);

  const toggleMember = (friendId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    if (mode === "ADD_MEMBER") {
      const cid = String(conversationId ?? "").trim();
      const userIds = [...selectedMemberIds]
        .map((id) => String(id).trim())
        .filter(Boolean);
      if (!cid || userIds.length === 0) return;
      try {
        setIsSubmitting(true);
        await conversationService.addMembers(cid, userIds);
        setSelectedMemberIds([]);
        onOpenChange(false);
        onMembersAdded?.();
      } catch (error) {
        console.error(error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await conversationService.createGroup({
        name: groupName.trim(),
        memberIds: selectedMemberIds,
      });

      handleOpenChange(false);
      onCreated?.();
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setGroupName("");
      setSearchQuery("");
      setSelectedMemberIds([]);
    }
  };

  const isAddMember = mode === "ADD_MEMBER";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {isAddMember ? "Thêm thành viên" : "Tạo nhóm mới"}
          </DialogTitle>
          <DialogDescription>
            {isAddMember
              ? "Chọn bạn bè để thêm vào cuộc hội thoại này."
              : "Chọn ít nhất 2 bạn bè để bắt đầu nhóm chat."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isAddMember && (
            <div className="space-y-2">
              <Input
                placeholder="Nhập tên nhóm (không bắt buộc)"
                value={groupName}
                className="h-10 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#0091ff]"
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
          )}

          {/* THANH TÌM KIẾM BẠN BÈ */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm bạn bè..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-gray-50 border-none"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium flex justify-between">
              <span>Danh sách bạn bè</span>
              <span className="text-[#0091ff]">
                Đã chọn: {selectedMemberIds.length}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border p-1 space-y-1">
              {isLoadingFriends ? (
                <p className="p-4 text-center text-sm text-gray-500">
                  Đang tải...
                </p>
              ) : filteredFriends.length === 0 ? (
                <p className="p-4 text-center text-sm text-gray-500">
                  {searchQuery
                    ? "Không tìm thấy kết quả"
                    : "Không có bạn bè nào khả dụng"}
                </p>
              ) : (
                filteredFriends.map((friend) => (
                  <label
                    key={friend.friendId}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded-full border-gray-300 accent-[#0091ff]"
                      checked={selectedMemberIds.includes(friend.friendId)}
                      onChange={() => toggleMember(friend.friendId)}
                    />
                    <img
                      src={friend.avatarUrl || "/default-avatar.png"}
                      alt={friend.name}
                      className="h-9 w-9 rounded-full object-cover border"
                    />
                    <span className="text-sm font-medium">{friend.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="bg-[#0091ff] hover:bg-[#007edb] text-white px-8"
          >
            {isSubmitting ? "Đang xử lý..." : isAddMember ? "Thêm" : "Tạo nhóm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;
  