import Container from "@/components/common/Container";
import { conversationService } from "@/services/conversation.service";
import { userService } from "@/services/user.service";
import { fetchConversations } from "@/store/slices/conversationSlice";
import { useAppDispatch } from "@/store/store";
import { showToast } from "@/utils/toast";
import Ionicons from "@expo/vector-icons/Ionicons";
import GroupAvatar from "@/components/ui/GroupAvatar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";

type RelationshipStatus =
  | "NONE"
  | "PENDING"
  | "REQUESTED"
  | "ACCEPTED"
  | "BLOCKED"
  | "BLOCKED_BY_OTHER"
  | "REJECTED";

function parseRelationshipStatus(value?: string): RelationshipStatus {
  if (value === "PENDING") return "REQUESTED";
  if (value === "REQUESTED") return "PENDING";
  if (value === "ACCEPTED") return "ACCEPTED";
  if (value === "BLOCKED") return "BLOCKED_BY_OTHER";
  if (value === "BLOCKED_BY_OTHER") return "BLOCKED";
  if (value === "REJECTED") return "REJECTED";
  return "NONE";
}

function formatPhoneForDisplay(phone?: string): string {
  if (!phone) return "";
  if (phone.startsWith("84")) return `(+84) ${phone.slice(2)}`;
  if (phone.startsWith("0")) return `(+84) ${phone.slice(1)}`;
  return `(+84) ${phone}`;
}

export default function SearchProfileScreen() {
  const dispatch = useAppDispatch();
  const userId = useSelector((state: any) => state.auth.user.userId);
  const router = useRouter();
  const { friendId, phone, status, name, avatarUrl } = useLocalSearchParams<{
    friendId: string;
    phone: string;
    status: string;
    name: string;
    avatarUrl: string;
  }>();

  const [relationshipStatus, setRelationshipStatus] =
    useState<RelationshipStatus>(parseRelationshipStatus(status));
  const [isActing, setIsActing] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const profileName = useMemo(() => {
    if (typeof name !== "string") return "Người dùng";
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : "Người dùng";
  }, [name]);

  const profileAvatar = useMemo(() => {
    if (typeof avatarUrl !== "string") return "";
    return avatarUrl;
  }, [avatarUrl]);

  const profileCover = useMemo(() => {
    return (
      profileAvatar ||
      "https://images.unsplash.com/photo-1615567808141-0f9b6224d4d9?q=80&w=1800&auto=format&fit=crop"
    );
  }, [profileAvatar]);

  const isFriend = relationshipStatus === "ACCEPTED";
  const phoneDisplay = useMemo(() => formatPhoneForDisplay(phone), [phone]);

  const description = isFriend
    ? `${profileName} đã là bạn bè của bạn.`
    : `Bạn chưa thể xem nhật ký của ${profileName} khi chưa là bạn bè`;

  const renderPrimaryActionContent = () => {
    if (isActing) {
      return <ActivityIndicator size="small" color="#2563eb" />;
    }

    switch (relationshipStatus) {
      case "PENDING":
        return <Text className="text-[13px] font-semibold text-gray-500">ĐÃ GỬI</Text>;
      case "REQUESTED":
        return <Text className="text-[13px] font-semibold text-[#0091ff]">ĐỒNG Ý</Text>;
      case "REJECTED":
        return <Text className="text-[13px] font-semibold text-[#0091ff]">GỬI LẠI</Text>;
      case "BLOCKED":
        return <Text className="text-[13px] font-semibold text-[#ef4444]">BỎ CHẶN</Text>;
      case "BLOCKED_BY_OTHER":
        return <Text className="text-[13px] font-semibold text-gray-500">BỊ CHẶN</Text>;
      default:
        return (
          <>
            <Ionicons name="person-add-outline" size={18} color="#0a67d8" />
            <Text className="text-[15px] font-semibold text-[#0a67d8] ml-2">
              Kết bạn
            </Text>
          </>
        );
    }
  };

  const handleOpenConversation = async () => {
    if (!friendId) {
      showToast("Không tìm thấy người dùng để nhắn tin");
      return;
    }

    try {
      setIsOpeningChat(true);
      const response: any = await conversationService.getOrCreateDirect(friendId);
      const conversationId =
        response?.data?._id ||
        response?.data?.conversationId ||
        response?._id ||
        response?.conversationId;

      if (!conversationId) {
        throw new Error("Không tạo được cuộc trò chuyện");
      }

      try {
        await dispatch(fetchConversations()).unwrap();
      } catch {
        // Keep navigation working even if the refresh fails.
      }

      router.push({
        pathname: "/private/chat/[id]",
        params: { id: conversationId, otherUserId: friendId },
      });
    } catch (err) {
      showToast(
        (err as any)?.response?.data?.message ||
          "Không thể mở cuộc trò chuyện, vui lòng thử lại",
      );
    } finally {
      setIsOpeningChat(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (isActing) return;
    if (!friendId || !userId) {
      showToast("Thiếu thông tin để thực hiện thao tác");
      return;
    }

    setIsActing(true);

    let data;
    try {
      switch (relationshipStatus) {
        case "NONE":
          data = await userService.addFriend(friendId, userId);
          if (data) {
            setRelationshipStatus("PENDING");
            showToast(data?.message || "Đã gửi lời mời kết bạn");
          }
          break;
        case "REJECTED":
          data = await userService.addFriend(friendId, userId);
          if (data) {
            setRelationshipStatus("PENDING");
            showToast(data?.message || "Đã gửi lại lời mời kết bạn");
          }
          break;
        case "PENDING":
          showToast("Bạn đã gửi lời mời kết bạn trước đó");
          break;
        case "REQUESTED":
          data = await userService.acceptFriend(friendId, userId);
          if (data) {
            setRelationshipStatus("ACCEPTED");
            showToast(data?.message || "Đã chấp nhận lời mời kết bạn");
          }
          break;
        case "ACCEPTED":
          showToast(`${profileName} đã là bạn bè của bạn`);
          break;
        case "BLOCKED":
          data = await userService.cancelFriend(friendId, userId);
          if (data) {
            setRelationshipStatus("NONE");
            showToast(data?.message || "Đã bỏ chặn người dùng");
          }
          break;
        case "BLOCKED_BY_OTHER":
          showToast("Bạn đang bị người này chặn");
          break;
      }
    } catch (err) {
      showToast(
        (err as any)?.response?.data?.message ||
          "Không thể thực hiện thao tác, vui lòng thử lại",
      );
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Container className="bg-[#f0f0f5]">
      <View className="flex-1 bg-[#f0f0f5]">
        <View className="relative">
          <ImageBackground
            source={{ uri: profileCover }}
            className="h-[335px] w-full"
            resizeMode="cover"
          >
            <View className="absolute inset-0 bg-black/15" />

            <View className="pt-2 px-4 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-black/20 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>

              <View className="flex-row items-center">
                <TouchableOpacity className="w-10 h-10 rounded-full bg-black/20 items-center justify-center mr-2">
                  <Ionicons name="call-outline" size={22} color="white" />
                </TouchableOpacity>
                <TouchableOpacity className="w-10 h-10 rounded-full bg-black/20 items-center justify-center">
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View className="absolute top-20 left-4 bg-black/25 rounded-lg px-2 py-1 flex-row items-center">
              <GroupAvatar
                uri={profileAvatar}
                name={profileName}
                size={36}
              />
              <Text
                className="text-white text-[15px] font-semibold ml-2 max-w-[170px]"
                numberOfLines={1}
              >
                {profileName}
              </Text>
            </View>
          </ImageBackground>

          <View className="absolute -bottom-16 left-0 right-0 items-center">
            <View className="border-[5px] border-white rounded-full overflow-hidden">
              <GroupAvatar
                uri={profileAvatar}
                name={profileName}
                size={150}
              />
            </View>
          </View>
        </View>

        <View className="pt-20 px-6 items-center">
          <View className="flex-row items-center">
            <Text className="text-[18px] font-semibold text-[#1f2937]">
              {profileName}
            </Text>
          </View>

          {!!phoneDisplay && (
            <Text className="text-[14px] text-gray-500 mt-2">
              {phoneDisplay}
            </Text>
          )}

          <Text className="text-[16px] text-gray-500 text-center mt-7 leading-6 px-1">
            {description}
          </Text>

          <View className="w-full mt-6 flex-row items-center">
            <TouchableOpacity
              disabled={isOpeningChat}
              className={`h-14 rounded-full items-center justify-center flex-row ${
                isFriend || friendId === "69f438929cf8b39d88abd220" ? "w-full bg-[#dbeafe]" : "flex-1 bg-[#dbeafe]"
              } ${isOpeningChat ? "opacity-80" : ""}`}
              onPress={handleOpenConversation}
            >
              {isOpeningChat ? (
                <ActivityIndicator size="small" color="#0a67d8" />
              ) : (
                <>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={24}
                    color="#0a67d8"
                  />
                  <Text className="text-[#0a67d8] text-[16px] font-semibold ml-3">
                    Nhắn tin
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {!isFriend && friendId !== "69f438929cf8b39d88abd220" && (
              <TouchableOpacity
                disabled={isActing}
                onPress={handlePrimaryAction}
                className={`ml-3 h-14 min-w-[132px] px-5 rounded-full border items-center justify-center flex-row ${
                  relationshipStatus === "BLOCKED_BY_OTHER"
                    ? "bg-gray-50 border-gray-200"
                    : "bg-white border-gray-100"
                } ${isActing ? "opacity-80" : ""}`}
              >
                {renderPrimaryActionContent()}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Container>
  );
}
