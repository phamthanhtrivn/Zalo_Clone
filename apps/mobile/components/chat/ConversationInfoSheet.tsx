import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Image as RNImage,
  Linking,
  ActivityIndicator,
  Alert,
  Switch,
  Dimensions,
  TextInput,
  InteractionManager,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import type { ConversationItemType } from "@/types/conversation-item.type";
import { messageService } from "@/services/message.service";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { getDateLabel } from "@/utils/format-message-time.util";
import {
  removeConversation,
  updateConversationSetting,
} from "@/store/slices/conversationSlice";
import {
  unhideConversation,
  muteConversation,
  pinConversation,
  unmuteConversation,
  unpinConversation,
  clearConversation,
} from "@/services/conversation-settings.service";
import { useSocket } from "@/contexts/SocketContext";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { truncateFileName } from "@/utils/render-file";
import { formatFileSize } from "@/utils/format-file.util";
import { conversationService } from "@/services/conversation.service";
import CreateGroupModal from "./CreateGroupModal";
import { useRouter } from "expo-router";
import MemberActionSheet from "../ui/MemberActionSheet";
import GroupAvatar from "../ui/GroupAvatar";
import ShareGroupQRModal from "./ShareGroupQRModal";
import { pollService } from "@/services/poll.service";
import ConversationPinModal from "./ConversationPinModal";
import { ConversationStorageSheet } from "./ConversationStorageSheet";
import { MobileImageViewer } from "../ui/MobileImageViewer";

const { width } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  conversation: ConversationItemType;
  openedFromSearch?: boolean;
  onConversationCleared?: () => void;
}

const SectionHeader = ({
  icon,
  title,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <TouchableOpacity
    onPress={onToggle}
    className="flex-row items-center justify-between px-4 py-3.5"
  >
    <View className="flex-row items-center gap-2.5">
      {icon}
      <Text className="text-sm font-semibold text-[#1f2937]">{title}</Text>
    </View>
    <Ionicons
      name={expanded ? "chevron-down" : "chevron-forward"}
      size={18}
      color="#9ca3af"
    />
  </TouchableOpacity>
);

const ConversationInfoSheet: React.FC<Props> = ({
  visible,
  onClose,
  conversation,
  openedFromSearch = false,
  onConversationCleared,
}) => {
  const router = useRouter();
  const { socket } = useSocket();
  const user = useAppSelector((state) => state.auth.user);
  const [medias, setMedias] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [expandedMedia, setExpandedMedia] = useState(true);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [fullListType, setFullListType] = useState<
    null | "media" | "file" | "link" | "member"
  >(null);
  const [storageSheetVisible, setStorageSheetVisible] = useState(false);
  const [storageInitialTab, setStorageInitialTab] = useState<"media" | "files" | "links">("media");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const currentUserId = user?.userId || (user as any)?._id || "";
  const [members, setMembers] = useState<any[]>([]);
  const [expandedMembers, setExpandedMembers] = useState(true);
  const [isAddMemberVisible, setIsAddMemberVisible] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [expandedRequests, setExpandedRequests] = useState(true);
  const [expandedManagement, setExpandedManagement] = useState(false);
  const [polls, setPolls] = useState<any[]>([]);
  const [expandedPoll, setExpandedPoll] = useState(false);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(conversation?.name || "");
  const isGroup = conversation?.type === "GROUP";
  const currentConversation =
    useAppSelector((state) =>
      state.conversation.conversations?.find(
        (c) => c.conversationId === conversation?.conversationId,
      ),
    ) || conversation;
  const isAI = conversation?.type === "AI" || currentConversation?.type === "AI";
  // --- FIX CỐT LÕI: LOCAL STATE CHO SWITCH ĐỂ TRÁNH BỊ GIẬT ---
  const [localSettings, setLocalSettings] = useState({
    allowMembersInvite: true,
    allowMembersSendMessages: true,
    approvalRequired: false,
  });

  const isPinned = currentConversation?.pinned;

  const isMuted =
    currentConversation?.muted &&
    (!currentConversation?.mutedUntil ||
      new Date(currentConversation.mutedUntil).getTime() > Date.now());

  const [isReady, setIsReady] = useState(false);
  const [isUnhiding, setIsUnhiding] = useState(false);

  useEffect(() => {
    if (!visible) {
      setIsReady(false);
      return;
    }

    const initData = async () => {
      try {
        const [mediaRes] = await Promise.all([
          messageService.getMediasPreview(
            currentUserId!,
            conversation.conversationId,
          ),
          isGroup ? fetchMembers() : Promise.resolve(null),
        ]);

        if (mediaRes && mediaRes.success) {
          setMedias(mediaRes.data.images_videos || []);
          setFiles(mediaRes.data.files || []);
          setLinks(mediaRes.data.links || []);
        }
      } catch (e) {
        console.error("Lỗi khi tải dữ liệu hội thoại:", e);
      } finally {
        setLoading(false);
      }
    };

    // Chạy ngay sau khi hiệu ứng mở Modal hoàn tất
    const interaction = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
      setLoading(true);
      initData();
    });

    return () => interaction.cancel();
  }, [visible, conversation?.conversationId, currentUserId]);

  useEffect(() => {
    if (currentConversation?.group) {
      setLocalSettings({
        allowMembersInvite:
          currentConversation.group.allowMembersInvite !== false,
        allowMembersSendMessages:
          currentConversation.group.allowMembersSendMessages !== false,
        approvalRequired: currentConversation.group.approvalRequired === true,
      });
    }
  }, [currentConversation?.group]);

  useEffect(() => {
    if (!socket || !visible || !conversation?.conversationId) return;

    const conversationId = conversation.conversationId;
    const mediaRooms = [
      `media_${conversationId}_IMAGE_VIDEO`,
      `media_${conversationId}_FILE`,
      `media_${conversationId}_LINK`,
    ];

    mediaRooms.forEach((room) => socket.emit("join_room", room));

    const handleNewMedia = (payload: { type: string; data: any }) => {
      const { type, data } = payload;
      if (type === "IMAGE_VIDEO") {
        setMedias((prev) => [data, ...prev].slice(0, 6));
      }

      if (type === "FILE") {
        setFiles((prev) => [data, ...prev].slice(0, 6));
      }

      if (type === "LINK") {
        setLinks((prev) => [data, ...prev].slice(0, 6));
      }
    };

    socket.on("new_media", handleNewMedia);

    return () => {
      // Leave rooms and cleanup listener
      mediaRooms.forEach((room) => socket.emit("leave_room", room));
      socket.off("new_media", handleNewMedia);
    };
  }, [socket, visible, conversation?.conversationId]);

  const myMemberInfo = members.find((m) => m.userId === currentUserId);
  const isOwner = myMemberInfo?.role === "OWNER";
  const isAdmin = myMemberInfo?.role === "ADMIN";
  const currentUserRole = myMemberInfo?.role || (isGroup ? "MEMBER" : "OWNER");

  const handlePin = () => {
    const newPinned = !conversation.pinned;

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        pinned: newPinned,
      }),
    );

    (async () => {
      try {
        if (newPinned) {
          await pinConversation(currentUserId, conversation.conversationId);
        } else {
          await unpinConversation(currentUserId, conversation.conversationId);
        }
      } catch (err) {
        dispatch(
          updateConversationSetting({
            conversationId: conversation.conversationId,
            pinned: !newPinned,
          }),
        );
        console.error(err);
      }
    })();
  };

  const handleMute = (duration: number) => {
    let mutedUntil: string | null = null;

    if (duration === 0) {
      mutedUntil = null;
    } else if (duration === -1) {
      mutedUntil = "infinite";
    } else if (duration === -2) {
      const now = new Date();
      const next8AM = new Date();
      next8AM.setDate(now.getHours() >= 8 ? now.getDate() + 1 : now.getDate());
      next8AM.setHours(8, 0, 0, 0);
      mutedUntil = next8AM.toISOString();
    } else {
      mutedUntil = new Date(Date.now() + duration * 60 * 1000).toISOString();
    }

    const newMuted = duration !== 0;

    dispatch(
      updateConversationSetting({
        conversationId: conversation.conversationId,
        muted: newMuted,
        mutedUntil,
      }),
    );

    (async () => {
      try {
        if (duration === 0) {
          await unmuteConversation(currentUserId, conversation.conversationId);
        } else {
          await muteConversation(
            currentUserId,
            conversation.conversationId,
            duration,
          );
        }
      } catch (err) {
        dispatch(
          updateConversationSetting({
            conversationId: conversation.conversationId,
            muted: !newMuted,
            mutedUntil: null,
          }),
        );
      }
    })();
  };

  const getFileExt = (name: string) =>
    name.split(".").pop()?.toUpperCase() || "FILE";

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (file: any) => {
    try {
      setDownloadingId(file.fileKey);

      const safeFileName = decodeURIComponent(file.fileName || "file");

      const downloadUrl = encodeURI(file.fileKey);

      const fileUri = FileSystem.documentDirectory + safeFileName;

      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: file.mimeType || "application/octet-stream",
          dialogTitle: safeFileName,
        });
      } else {
        Alert.alert("Thành công", `Đã tải: ${safeFileName}`);
      }
    } catch (err: any) {
      console.error("Download error:", err?.response || err);

      Alert.alert(
        "Lỗi",
        "Không thể tải file. Có thể do link hết hạn hoặc cần đăng nhập.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchMembers = async () => {
    if (!isGroup) return;
    const res: any = await conversationService.getListMembers(
      conversation.conversationId,
    );
    if (res.success) setMembers(res.data);
  };

  const fetchJoinRequests = async () => {
    try {
      const res: any = await conversationService.getJoinRequests(
        currentConversation!.conversationId,
      );
      if (res?.success) {
        const requestsArray = Array.isArray(res.data)
          ? res.data
          : res.data?.data || [];
        setJoinRequests(requestsArray);
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (visible && isGroup && (isOwner || isAdmin)) {
      fetchJoinRequests();
    }
  }, [
    visible,
    currentConversation?.conversationId,
    membersRefreshKey,
    isOwner,
    isAdmin,
  ]);

  useEffect(() => {
    if (!socket || !currentConversation?.conversationId) return;

    const handleNewRequest = (data: any) => {
      if (data.conversationId === currentConversation.conversationId)
        fetchJoinRequests();
    };

    const handleMemberUpdate = (data: any) => {
      if (data?.conversationId === currentConversation.conversationId) {
        setMembersRefreshKey((k) => k + 1);
        fetchMembers();
      }
    };

    socket.on("new_approval_request", handleNewRequest);
    socket.on("member_updated", handleMemberUpdate);
    socket.on("role_updated", handleMemberUpdate);

    return () => {
      socket.off("new_approval_request", handleNewRequest);
      socket.off("member_updated", handleMemberUpdate);
      socket.off("role_updated", handleMemberUpdate);
    };
  }, [socket, currentConversation?.conversationId]);

  const [selectedMemberForAction, setSelectedMemberForAction] = useState<
    any | null
  >(null);

  const handleMemberAction = (target: any) => {
    if (target.userId === currentUserId) return;
    setSelectedMemberForAction(target);
  };

  const confirmTransferOwner = (target: any) => {
    Alert.alert(
      "Xác nhận",
      `Bạn chắc chắn muốn chuyển quyền Trưởng nhóm cho ${target.name}? Sau khi chuyển, bạn sẽ trở thành thành viên thường.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const res: any = await conversationService.transferOwner(
                conversation.conversationId,
                target.userId,
              );
              if (res.success) {
                Alert.alert("Thành công", "Đã chuyển quyền Trưởng nhóm");
                fetchMembers();
              }
            } catch (err: any) {
              Alert.alert(
                "Lỗi",
                err.response?.data?.message || "Không thể chuyển quyền lúc này",
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const updateRole = async (t: any, r: string) => {
    const res: any = await conversationService.updateMembersRole(
      conversation.conversationId,
      [t.userId],
      r,
    );
    if (res.success) fetchMembers();
  };

  const confirmRemoveMember = (t: any) => {
    Alert.alert("Xác nhận", `Mời ${t.name} rời khỏi nhóm?`, [
      { text: "Hủy" },
      {
        text: "Xác nhận",
        style: "destructive",
        onPress: async () => {
          const res: any = await conversationService.removeMember(
            conversation.conversationId,
            t.userId,
          );
          if (res.success) fetchMembers();
        },
      },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Giải tán nhóm",
      "Tất cả thành viên sẽ bị mời ra khỏi nhóm và toàn bộ tin nhắn sẽ bị xóa. Bạn chắc chắn chứ?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Giải tán",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const res: any = await conversationService.deleteGroup(
                conversation.conversationId,
              );
              if (res.success) {
                onClose();
                router.replace("/private/chat");
              }
            } catch (err: any) {
              const errorMsg =
                err.response?.data?.message ||
                "Không thể giải tán nhóm lúc này";
              Alert.alert("Lỗi", errorMsg);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleLeaveGroup = () => {
    const alertTitle = isGroup ? "Rời nhóm" : "Xóa cuộc trò chuyện";
    const alertMsg = isGroup
      ? "Bạn sẽ không còn nhận được tin nhắn từ nhóm này nữa?"
      : "Toàn bộ lịch sử tin nhắn sẽ bị xóa và không thể khôi phục?";

    Alert.alert(alertTitle, alertMsg, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xác nhận",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            if (isGroup) {
              const res: any = await conversationService.leaveGroup(
                conversation.conversationId,
              );

              if (res.success) {
                onClose();
                router.replace("/private/chat");
              }
            } else {
              const res: any = await conversationService.deleteGroup(
                conversation.conversationId,
              );
              if (res.success) {
                onClose();
                dispatch(removeConversation(conversation.conversationId));
                router.replace("/private/chat");
              }
            }
          } catch (err: any) {
            const errorMsg =
              err.response?.data?.message ||
              "Có lỗi xảy ra khi thực hiện thao tác này";
            Alert.alert("Thông báo", errorMsg);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleUpdateSetting = async (
    key: keyof typeof localSettings,
    value: boolean,
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));

    dispatch(
      updateConversationSetting({
        conversationId: currentConversation!.conversationId,
        group: { ...currentConversation!.group, [key]: value },
      }),
    );

    // 3. Gọi API
    try {
      const res: any = await conversationService.updateGroupSettings(
        currentConversation!.conversationId,
        { [key]: value },
      );
      if (!res.success) throw new Error("API thất bại");
    } catch (err) {
      Alert.alert("Lỗi", "Không thể cập nhật cài đặt");
      // Rollback nếu lỗi
      setLocalSettings((prev) => ({ ...prev, [key]: !value }));
      dispatch(
        updateConversationSetting({
          conversationId: currentConversation!.conversationId,
          group: { ...currentConversation!.group, [key]: !value },
        }),
      );
    }
  };

  const onHandleRequest = async (
    reqId: string,
    action: "APPROVED" | "REJECTED",
  ) => {
    try {
      const res: any = await conversationService.handleJoinRequest(
        currentConversation!.conversationId,
        reqId,
        action,
      );

      if (res.success || res.data) {
        setJoinRequests((prev) => prev.filter((r) => r._id !== reqId));

        if (action === "APPROVED") {
          fetchMembers();
          setMembersRefreshKey((k) => k + 1);
        }
      } else {
        Alert.alert("Thông báo", res.message || "Thao tác không thành công");
      }
    } catch (err: any) {
      console.log("Lỗi duyệt/xóa yêu cầu:", err?.response?.data || err.message);
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message ||
        "Không thể thực hiện thao tác này. Vui lòng thử lại.",
      );
    }
  };

  const handleTogglePolls = async () => {
    const willExpand = !expandedPoll;
    setExpandedPoll(willExpand);
    if (willExpand && conversation?.conversationId) {
      setLoadingPolls(true);
      try {
        const res: any = await pollService.getPolls(
          conversation.conversationId,
        );
        if (res) {
          setPolls(res);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách bình chọn:", error);
      } finally {
        setLoadingPolls(false);
      }
    }
  };

  const uploadAvatar = async (selectedFile: ImagePicker.ImagePickerAsset) => {
    try {
      setLoading(true);
      const res: any = await conversationService.updateGroupMetadata(
        currentConversation.conversationId,
        { avatar: selectedFile },
      );
      if (res.success) {
        Alert.alert("Thành công", "Đã cập nhật ảnh nhóm mới");
      }
    } catch (err) {
      Alert.alert("Lỗi", "Không thể tải ảnh lên server");
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Bạn cần cấp quyền Camera để chụp ảnh");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0]);
    }
  };

  const handleChooseLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0]);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert("Ảnh đại diện nhóm", "Chọn phương thức cập nhật ảnh", [
      { text: "Chụp ảnh mới", onPress: handleTakePhoto },
      { text: "Chọn từ thư viện", onPress: handleChooseLibrary },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const handleSaveName = async () => {
    if (!tempName.trim() || tempName === currentConversation?.name) {
      setEditingName(false);
      return;
    }
    try {
      const res: any = await conversationService.updateGroupMetadata(
        currentConversation.conversationId,
        { name: tempName.trim() },
      );
      if (res.success) {
        setEditingName(false);
      }
    } catch (err) {
      Alert.alert("Lỗi", "Không thể đổi tên nhóm");
    }
  };

  const canInvite = localSettings.allowMembersInvite || isOwner || isAdmin;
  const shouldShowUnhideButton =
    openedFromSearch && !isGroup && !!currentConversation?.hidden;

  const visibleMembers = members.slice(0, 15);
  const fullListTitle =
    fullListType === "media"
      ? `Anh, video (${medias.length})`
      : fullListType === "file"
        ? `File (${files.length})`
        : fullListType === "link"
          ? `Link (${links.length})`
          : fullListType === "member"
            ? `Thanh vien (${members.length})`
            : "";

  const handleUnhideConversation = async (pin: string) => {
    if (!currentConversation?.conversationId || !currentUserId || isUnhiding)
      return;

    setIsUnhiding(true);
    setPinLoading(true);
    dispatch(
      updateConversationSetting({
        conversationId: currentConversation.conversationId,
        hidden: false,
      }),
    );

    try {
      const res: any = await unhideConversation(
        currentUserId,
        currentConversation.conversationId,
        pin,
      );
      if (!res?.success) {
        throw new Error(res?.message || "Unhide failed");
      }
      setPinModalVisible(false);
      Alert.alert("Thành công", "Đã gỡ ẩn cuộc trò chuyện");
    } catch (err: any) {
      const errorMessage = String(
        err?.response?.data?.message || err?.message || "",
      ).toLowerCase();
      const alreadyUnhidden =
        errorMessage.includes("not hidden") ||
        errorMessage.includes("already unhidden") ||
        errorMessage.includes("đã bỏ ẩn") ||
        errorMessage.includes("không bị ẩn");

      if (alreadyUnhidden) {
        dispatch(
          updateConversationSetting({
            conversationId: currentConversation.conversationId,
            hidden: false,
          }),
        );
        Alert.alert("Thành công", "Đã gỡ ẩn cuộc trò chuyện");
        return;
      }

      dispatch(
        updateConversationSetting({
          conversationId: currentConversation.conversationId,
          hidden: true,
        }),
      );
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "Không thể gỡ ẩn cuộc trò chuyện",
      );
    } finally {
      setIsUnhiding(false);
      setPinLoading(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Xác nhận",
      "Toàn bộ lịch sử trò chuyện trong hội thoại này sẽ bị xóa khỏi thiết bị của bạn. Bạn có chắc chắn muốn tiếp tục?",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const res: any = await clearConversation(
                currentUserId,
                conversation.conversationId,
              );
              if (!res?.success) {
                throw new Error(res?.message || "Clear failed");
              }
              onConversationCleared?.();
              onClose();
              Alert.alert("Thành công", "Đã xóa lịch sử trò chuyện");
            } catch (err: any) {
              Alert.alert(
                "Lỗi",
                err?.response?.data?.message ||
                "Không thể xóa lịch sử trò chuyện",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="flex-1 bg-[#f7f8fa] mt-[60px] rounded-t-[20px] overflow-hidden"
        >
          <ConversationPinModal
            visible={pinModalVisible}
            title="Nhập mã PIN để gỡ ẩn trò chuyện"
            description="Nhập đúng mã PIN 4 số để xác nhận gỡ ẩn cuộc trò chuyện."
            confirmLabel="Gỡ ẩn"
            loading={pinLoading}
            onClose={() => {
              if (pinLoading) return;
              setPinModalVisible(false);
            }}
            onSubmit={handleUnhideConversation}
          />
          <View className="flex-row items-center justify-between px-4 py-3.5 bg-white border-b border-[#f3f4f6]">
            <Text className="text-base font-semibold text-[#1f2937]">
              Thông tin hội thoại
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="bg-white items-center py-5 mb-2">
              <View className="w-[70px] h-[70px] rounded-full overflow-hidden bg-[#e5e7eb] mb-2.5 relative">
                <GroupAvatar
                  uri={conversation?.avatar}
                  name={conversation?.name || "Group"}
                  size={70}
                />
                {isGroup && (isOwner || isAdmin) && (
                  <TouchableOpacity
                    className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full border border-[#e5e7eb]"
                    style={{
                      elevation: 2,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 1,
                    }}
                    onPress={handleAvatarPress}
                  >
                    <Ionicons name="camera" size={16} color="#4b5563" />
                  </TouchableOpacity>
                )}
              </View>
              <View className="w-full items-center justify-center mt-2.5 px-5">
                {editingName ? (
                  <TextInput
                    className="text-lg font-bold border-b-2 border-[#0068ff] px-2.5 text-center min-w-[150px]"
                    value={tempName}
                    onChangeText={setTempName}
                    autoFocus
                    onBlur={handleSaveName}
                    onSubmitEditing={handleSaveName}
                  />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-[#111827]">
                      {currentConversation?.name}
                    </Text>
                    {isGroup && (isOwner || isAdmin) && (
                      <TouchableOpacity onPress={() => setEditingName(true)}>
                        <Ionicons name="pencil" size={16} color="#9ca3af" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            {!isAI && (
              <View className="bg-white flex-row justify-around py-3.5 mb-2">
                {[
                  {
                    icon: "notifications-outline",
                    label: isMuted ? "Bật thông báo" : "Tắt thông báo",
                    onPress: () =>
                      isMuted ? handleMute(0) : setShowMuteOptions(true),
                    active: isMuted,
                  },
                  {
                    icon: "pin-outline",
                    label: isPinned ? "Bỏ ghim" : "Ghim hội thoại",
                    onPress: handlePin,
                    active: isPinned,
                  },
                  {
                    icon: isGroup ? "person-add-outline" : "people-outline",
                    label: isGroup ? "Thêm TV" : "Tạo nhóm",
                    onPress: () => {
                      if (isGroup) {
                        if (canInvite) {
                          setIsAddMemberVisible(true);
                        } else {
                          Alert.alert(
                            "Thông báo",
                            "Trưởng/phó nhóm đã tắt quyền mời thành viên đối với thành viên thường.",
                          );
                        }
                      } else {
                        setIsAddMemberVisible(true);
                      }
                    },
                    active: false,
                  },
                  {
                    icon: "qr-code-outline",
                    label: "Mã QR",
                    onPress: () => setIsQrModalVisible(true),
                    active: false,
                  },
                ].map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={action.onPress}
                    className="items-center gap-1.5"
                    style={{ width: width / 4 }}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${action.active ? "bg-[#dbeafe]" : "bg-[#f3f4f6]"}`}
                    >
                      <Ionicons
                        name={action.icon as any}
                        size={20}
                        color={action.active ? "#0068ff" : "#374151"}
                      />
                    </View>

                    <Text
                      className={`text-[11px] text-center px-1 ${action.active ? "text-[#0068ff]" : "text-[#4b5563]"}`}
                      numberOfLines={2}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {isGroup && (isOwner || isAdmin) && joinRequests.length > 0 && (
              <View className="bg-white mb-2">
                <SectionHeader
                  icon={
                    <Ionicons name="person-add" size={18} color="#0068ff" />
                  }
                  title={`Yêu cầu tham gia (${joinRequests.length})`}
                  expanded={expandedRequests}
                  onToggle={() => setExpandedRequests(!expandedRequests)}
                />
                {expandedRequests && (
                  <View className="px-4 pb-2.5">
                    {joinRequests.map((req) => (
                      <View
                        key={req._id}
                        className="flex-row items-center py-2 bg-[#f0f7ff] px-2.5 rounded-lg mb-2"
                      >
                        <Image
                          source={{
                            uri:
                              req.userId?.profile?.avatarUrl ||
                              "https://via.placeholder.com/150",
                          }}
                          className="w-9 h-9 rounded-full mr-2.5"
                        />
                        <View className="flex-1">
                          <Text
                            className="text-sm font-semibold text-[#111]"
                            numberOfLines={1}
                          >
                            {req.userId?.profile?.name}
                          </Text>
                          <Text className="text-[11px] text-[#666] mt-0.5">
                            Mời bởi: {req.invitedBy?.profile?.name}
                          </Text>
                        </View>
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => onHandleRequest(req._id, "APPROVED")}
                            className="w-[30px] h-[30px] rounded-full bg-[#0068ff] items-center justify-center"
                          >
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="white"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onHandleRequest(req._id, "REJECTED")}
                            className="w-[30px] h-[30px] rounded-full bg-[#e5e7eb] items-center justify-center"
                          >
                            <Ionicons name="close" size={16} color="#666" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {isGroup && (isOwner || isAdmin) && (
              <View className="bg-white mb-2">
                <SectionHeader
                  icon={
                    <Ionicons
                      name="settings-outline"
                      size={18}
                      color="#4b5563"
                    />
                  }
                  title="Cài đặt nhóm"
                  expanded={expandedManagement}
                  onToggle={() => setExpandedManagement(!expandedManagement)}
                />
                {expandedManagement && (
                  <View className="px-4 pb-4">
                    <View className="flex-row items-center py-3 border-b border-[#f0f0f0]">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-[#333]">
                          Quyền mời thành viên
                        </Text>
                        <Text className="text-[11px] text-[#888] mt-0.5">
                          Thành viên thường có thể mời người khác
                        </Text>
                      </View>
                      <Switch
                        value={localSettings.allowMembersInvite}
                        onValueChange={(val) =>
                          handleUpdateSetting("allowMembersInvite", val)
                        }
                        trackColor={{ false: "#d1d5db", true: "#34d399" }}
                      />
                    </View>

                    <View className="flex-row items-center py-3 border-b border-[#f0f0f0]">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-[#333]">
                          Quyền gửi tin nhắn
                        </Text>
                        <Text className="text-[11px] text-[#888] mt-0.5">
                          Cho phép mọi người cùng nhắn tin
                        </Text>
                      </View>
                      <Switch
                        value={localSettings.allowMembersSendMessages}
                        onValueChange={(val) =>
                          handleUpdateSetting("allowMembersSendMessages", val)
                        }
                        trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
                      />
                    </View>

                    <View className="flex-row items-center py-3 border-b border-[#f0f0f0]">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-[#0068ff]">
                          Phê duyệt thành viên mới
                        </Text>
                        <Text className="text-[11px] text-[#888] mt-0.5">
                          Admin cần duyệt trước khi vào nhóm
                        </Text>
                      </View>
                      <Switch
                        value={localSettings.approvalRequired}
                        onValueChange={(val) =>
                          handleUpdateSetting("approvalRequired", val)
                        }
                        trackColor={{ false: "#d1d5db", true: "#0068ff" }}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Unified Media, File, Link Section */}
            {isReady && (
              <View className="bg-white mb-2 pb-4">
                <SectionHeader
                  icon={
                    <Ionicons name="folder-open-outline" size={18} color="#374151" />
                  }
                  title="Ảnh, file, link"
                  expanded={expandedMedia}
                  onToggle={() => setExpandedMedia((v) => !v)}
                />
                {expandedMedia && (
                  <View className="px-4 pt-1">
                    {medias.length === 0 ? (
                      <TouchableOpacity
                        onPress={() => {
                          setStorageInitialTab("media");
                          setStorageSheetVisible(true);
                        }}
                        className="py-5 bg-[#f9fafb] border border-dashed border-gray-200 rounded-2xl items-center justify-center"
                      >
                        <Ionicons name="images-outline" size={22} color="#9ca3af" />
                        <Text className="text-[11px] text-gray-400 mt-1 font-semibold">
                          Chưa có ảnh, file hoặc link. Bấm để xem kho
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="flex-row items-center gap-1.5">
                        {/* Display up to 4 preview thumbnails */}
                        {medias.slice(0, 4).map((media, idx) => {
                          const file = media?.content?.file;
                          if (!file) return null;
                          const isVideo = file?.type === "VIDEO";
                          const tileWidth = (width - 32 - 24) / 5;

                          return (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => {
                                setPreviewIndex(idx);
                              }}
                              className="bg-[#e5e7eb] rounded-xl overflow-hidden"
                              style={{
                                width: tileWidth,
                                height: tileWidth,
                              }}
                            >
                              {isVideo ? (
                                <View className="flex-1 items-center justify-center bg-black">
                                  <Ionicons
                                    name="play-circle"
                                    size={24}
                                    color="white"
                                  />
                                </View>
                              ) : (
                                <Image
                                  source={{ uri: file?.fileKey }}
                                  style={{ width: "100%", height: "100%" }}
                                  contentFit="cover"
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}

                        {/* Last element: The special arrow tile to see all */}
                        <TouchableOpacity
                          onPress={() => {
                            setStorageInitialTab("media");
                            setStorageSheetVisible(true);
                          }}
                          className="bg-[#e5f1ff] rounded-xl items-center justify-center border border-blue-50/50"
                          style={{
                            width: (width - 32 - 24) / 5,
                            height: (width - 32 - 24) / 5,
                          }}
                        >
                          <Ionicons name="arrow-forward" size={24} color="#0068ff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {isReady && (
              <View className="bg-white mb-2">
                <SectionHeader
                  icon={
                    <Ionicons name="stats-chart" size={18} color="#374151" />
                  }
                  title="Bình chọn"
                  expanded={expandedPoll}
                  onToggle={handleTogglePolls}
                />
                {expandedPoll && (
                  <View className="px-3 pb-4">
                    {loadingPolls ? (
                      <ActivityIndicator size="small" color="#0068ff" />
                    ) : polls.length === 0 ? (
                      <Text className="text-xs text-[#9ca3af] text-center py-2">
                        Chưa có bình chọn nào trong cuộc trò chuyện
                      </Text>
                    ) : (
                      polls.map((msg, idx) => {
                        const pollData = msg.poll;
                        if (!pollData) return null;
                        return (
                          <TouchableOpacity
                            key={msg._id || idx}
                            className="p-3 rounded-xl bg-[#f9fafb] border border-[#f3f4f6] mb-2"
                            onPress={() => {
                              onClose();
                              router.push({
                                pathname: "/private/chat/[id]",
                                params: {
                                  id: conversation.conversationId,
                                  messageId: msg._id,
                                },
                              });
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              className="text-sm font-semibold text-[#111] mb-1"
                            >
                              {pollData.title || "Bình chọn không tiêu đề"}
                            </Text>
                            <Text className="text-[12px] text-[#6b7280]">
                              {pollData.totalParticipants || 0} người đã bình
                              chọn
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 3. DANH SÁCH THÀNH VIÊN */}
            {isGroup && isReady && (
              <View className="bg-white mb-2">
                <SectionHeader
                  icon={
                    <Ionicons name="people-outline" size={18} color="#4b5563" />
                  }
                  title={`Thành viên (${members.length})`}
                  expanded={expandedMembers}
                  onToggle={() => setExpandedMembers(!expandedMembers)}
                />
                {expandedMembers && (
                  <View className="px-4 pb-2.5">
                    {/* Chỉ render tối đa 15 người ở màn hình preview để đảm bảo độ mượt */}
                    {visibleMembers.map((m) => (
                      <TouchableOpacity
                        key={m.userId}
                        className="flex-row items-center py-3 border-b border-[#f3f4f6]"
                        onPress={() => handleMemberAction(m)}
                      >
                        <GroupAvatar
                          uri={m.avatarUrl || m.profile?.avatarUrl}
                          name={m.name || m.profile?.name || "User"}
                          size={44}
                        />
                        <View className="flex-1 ml-3">
                          <Text className="text-[15px] font-medium text-[#1f2937]">
                            {m.name || m.profile?.name}{" "}
                            {m.userId === currentUserId && "(Bạn)"}
                          </Text>
                          {m.role !== "MEMBER" && (
                            <Text className="text-[11px] text-[#0068ff] font-semibold mt-0.5">
                              {m.role === "OWNER" ? "Trưởng nhóm" : "Phó nhóm"}
                            </Text>
                          )}
                        </View>
                        {m.userId !== currentUserId && (
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={18}
                            color="#9ca3af"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                    {members.length > 15 && (
                      <TouchableOpacity
                        className="py-3 items-center"
                        onPress={() => setFullListType("member")}
                      >
                        <Text className="text-[#0068ff] text-sm">
                          {`Xem tất cả (${members.length})`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {shouldShowUnhideButton && (
              <View className="bg-white mb-2 py-2">
                <TouchableOpacity
                  className={`flex-row items-center px-4 py-3 ${isUnhiding ? "opacity-70" : ""}`}
                  onPress={() => setPinModalVisible(true)}
                  disabled={isUnhiding}
                >
                  {isUnhiding ? (
                    <ActivityIndicator size="small" color="#0b63ce" />
                  ) : (
                    <Ionicons name="eye-outline" size={20} color="#0b63ce" />
                  )}
                  <Text className="ml-3 text-[15px] text-[#0b63ce] font-semibold">
                    Gỡ ẩn trò chuyện
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="bg-white mb-2 py-1">
              {isGroup && isOwner && (
                <TouchableOpacity
                  className="flex-row items-center px-4 py-4 border-b border-[#f3f4f6]"
                  onPress={handleDeleteGroup}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <Text className="ml-3 text-[15px] text-[#ef4444] font-semibold">
                    Giải tán nhóm
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="flex-row items-center px-4 py-4"
                onPress={isGroup ? handleLeaveGroup : handleClearHistory}
              >
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text className="ml-3 text-[15px] text-[#ef4444] font-semibold">
                  {isGroup ? "Rời nhóm" : "Xóa lịch sử chat"}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="h-10" />
          </ScrollView>

          {fullListType !== null && (
            <Modal
              transparent
              visible
              animationType="slide"
              onRequestClose={() => setFullListType(null)}
            >
              <View className="flex-1 bg-black/40 justify-end">
                <View
                  className="bg-white rounded-t-[24px] max-h-[82%]"
                  style={{ paddingBottom: 20 }}
                >
                  <View className="flex-row items-center justify-between px-4 py-4 border-b border-[#f3f4f6]">
                    <Text className="text-base font-semibold text-[#1f2937]">
                      {fullListTitle}
                    </Text>
                    <TouchableOpacity onPress={() => setFullListType(null)}>
                      <Ionicons name="close" size={22} color="#6b7280" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    className="px-4 pt-4"
                    showsVerticalScrollIndicator={false}
                  >
                    {fullListType === "media" ? (
                      <View className="flex-row flex-wrap gap-0.5 pb-4">
                        {medias.map((media, idx) => {
                          const file = media?.content?.file;
                          const isVideo = file?.type === "VIDEO";
                          return (
                            <TouchableOpacity
                              key={`${file?.fileKey || "media"}-${idx}`}
                              onPress={() => {
                                setFullListType(null);
                                setPreviewIndex(idx);
                              }}
                              className="bg-[#e5e7eb] overflow-hidden"
                              style={{
                                width: (width - 32 - 4) / 3,
                                aspectRatio: 1,
                              }}
                            >
                              {isVideo ? (
                                <View className="flex-1 items-center justify-center bg-black">
                                  <Ionicons
                                    name="play-circle"
                                    size={36}
                                    color="white"
                                  />
                                </View>
                              ) : (
                                <Image
                                  source={{ uri: file?.fileKey }}
                                  style={{ width: "100%", height: "100%" }}
                                  contentFit="cover"
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}

                    {fullListType === "file"
                      ? files.map((item, idx) => {
                        const file = item.content?.file;
                        return (
                          <TouchableOpacity
                            key={`${file?.fileKey || "file"}-${idx}`}
                            onPress={() => handleDownload(file)}
                            disabled={downloadingId === file.fileKey}
                            className="flex-row items-center p-2.5 rounded-xl bg-[#f9fafb] border border-[#f3f4f6] mb-2 gap-2.5"
                          >
                            <View className="w-10 h-10 rounded-lg bg-[#dbeafe] items-center justify-center">
                              <Text className="text-[10px] font-bold text-[#1d4ed8]">
                                {getFileExt(file.fileName)}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text
                                numberOfLines={1}
                                className="text-[13px] font-medium text-[#111]"
                              >
                                {truncateFileName(file.fileName, 30)}
                              </Text>
                              <Text className="text-[11px] text-[#9ca3af]">
                                {getDateLabel(item.createdAt)} •{" "}
                                {formatFileSize(file.fileSize)}
                              </Text>
                            </View>
                            {downloadingId === file.fileKey ? (
                              <ActivityIndicator
                                size="small"
                                color="#0068ff"
                              />
                            ) : (
                              <Ionicons
                                name="download-outline"
                                size={17}
                                color="#0068ff"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })
                      : null}

                    {fullListType === "link"
                      ? links.map((item, idx) => {
                        const url = item.content?.text;
                        let domain = url;
                        try {
                          domain = new URL(url).hostname.replace("www.", "");
                        } catch { }
                        return (
                          <TouchableOpacity
                            key={`${url || "link"}-${idx}`}
                            onPress={() => Linking.openURL(url)}
                            className="flex-row items-center p-2.5 rounded-xl bg-[#f9fafb] border border-[#f3f4f6] mb-2 gap-2.5"
                          >
                            <View className="w-10 h-10 rounded-lg bg-[#f3f4f6] items-center justify-center">
                              <MaterialIcons
                                name="link"
                                size={20}
                                color="#6b7280"
                              />
                            </View>
                            <View className="flex-1">
                              <Text
                                numberOfLines={1}
                                className="text-[13px] text-[#0068ff]"
                              >
                                {url}
                              </Text>
                              <Text className="text-[11px] text-[#9ca3af]">
                                {domain}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                      : null}

                    {fullListType === "member"
                      ? members.map((m) => (
                        <TouchableOpacity
                          key={m.userId}
                          className="flex-row items-center py-3 border-b border-[#f3f4f6]"
                          onPress={() => handleMemberAction(m)}
                        >
                          <GroupAvatar
                            uri={m.profile?.avatarUrl}
                            name={m.profile?.name || "User"}
                            size={44}
                          />
                          <View className="flex-1 ml-3">
                            <Text className="text-[15px] font-medium text-[#1f2937]">
                              {m.profile?.name}{" "}
                              {m.userId === currentUserId && "(Bạn)"}
                            </Text>
                            {m.role !== "MEMBER" ? (
                              <Text className="text-[11px] text-[#0068ff] font-semibold mt-0.5">
                                {m.role === "OWNER"
                                  ? "Trưởng nhóm"
                                  : "Phó nhóm"}
                              </Text>
                            ) : null}
                          </View>
                          {m.userId !== currentUserId ? (
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={18}
                              color="#9ca3af"
                            />
                          ) : null}
                        </TouchableOpacity>
                      ))
                      : null}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}

          <MobileImageViewer
            visible={previewIndex !== null}
            onClose={() => setPreviewIndex(null)}
            initialIndex={previewIndex ?? 0}
            mediaList={medias.map((m: any) => ({
              fileKey: m.content?.file?.fileKey || "",
              type: m.content?.file?.type || "IMAGE",
              fileName: m.content?.file?.fileName,
              mimeType: m.content?.file?.mimeType,
            }))}
          />
        </Pressable>
      </Pressable>
      <Modal
        transparent
        visible={showMuteOptions}
        animationType="fade"
        onRequestClose={() => setShowMuteOptions(false)}
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setShowMuteOptions(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="absolute bottom-0 w-full bg-white rounded-t-2xl pb-7"
          >
            <Text className="text-center text-[15px] font-semibold py-3.5">
              Tắt thông báo
            </Text>

            {[
              { label: "Trong 1 giờ", duration: 60 },
              { label: "Trong 4 giờ", duration: 240 },
              { label: "Cho đến 8:00 AM", duration: -2 },
              { label: "Cho đến khi mở lại", duration: -1 },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  handleMute(item.duration);
                  setShowMuteOptions(false);
                }}
                className="py-3.5 px-5 border-t border-[#f3f4f6]"
              >
                <Text className="text-sm text-[#111]">{item.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowMuteOptions(false)}
              className="mt-2 py-3.5 items-center border-t-[6px] border-[#f3f4f6]"
            >
              <Text className="text-sm text-[#ef4444]">Hủy</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <CreateGroupModal
        visible={isAddMemberVisible}
        onClose={() => setIsAddMemberVisible(false)}
        mode="ADD_MEMBER"
        conversationId={conversation.conversationId}
        excludedIds={members.map((m) => m.userId)}
        onSuccess={fetchMembers}
      />

      {isGroup && (
        <ShareGroupQRModal
          visible={isQrModalVisible}
          onClose={() => setIsQrModalVisible(false)}
          conversationId={conversation.conversationId}
          conversationName={conversation.name}
          initialJoinToken={currentConversation?.group?.joinToken || null}
          myRole={currentUserRole as any}
          onTokenRefreshed={(newToken) => {
            dispatch(
              updateConversationSetting({
                conversationId: conversation.conversationId,
                group: { ...currentConversation.group, joinToken: newToken },
              }),
            );
          }}
        />
      )}
      <MemberActionSheet
        visible={!!selectedMemberForAction}
        onClose={() => setSelectedMemberForAction(null)}
        member={selectedMemberForAction}
        userRole={currentUserRole}
        onViewProfile={(uid) => router.push(`/user/${uid}`)}
        onChat={async (uid) => {
          const res: any = await conversationService.getOrCreateDirect(uid);
          const cid = res?.data?._id || res?._id;
          if (cid) {
            onClose();
            router.push(`/private/chat/${cid}`);
          }
        }}
        onPromoteAdmin={(uid, isPromote) => {
          const target = members.find((m) => m.userId === uid);
          if (target) updateRole(target, isPromote ? "ADMIN" : "MEMBER");
        }}
        onTransferOwner={(uid) => {
          const target = members.find((m) => m.userId === uid);
          if (target) confirmTransferOwner(target);
        }}
        onRemove={(uid) => {
          const target = members.find((m) => m.userId === uid);
          if (target) confirmRemoveMember(target);
        }}
      />
      <MobileImageViewer
        visible={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        initialIndex={previewIndex ?? 0}
        mediaList={medias.map((item: any) => ({
          fileKey: item.content?.file?.fileKey || "",
          type: item.content?.file?.type || "IMAGE",
          fileName: item.content?.file?.fileName,
          mimeType: item.content?.file?.mimeType,
        }))}
      />
      <ConversationStorageSheet
        visible={storageSheetVisible}
        onClose={() => setStorageSheetVisible(false)}
        initialTab={storageInitialTab}
        conversationId={conversation?.conversationId || currentConversation?.conversationId || ""}
        members={members}
        currentUserId={currentUserId}
      />
    </Modal>
  );
};

export default ConversationInfoSheet;
