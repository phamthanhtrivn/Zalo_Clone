import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { conversationService } from "@/services/conversation.service";
import { userService } from "@/services/user.service";
import { useRouter } from "expo-router"; // Sửa lại router

interface Props {
  visible: boolean;
  onClose: () => void;
  mode?: "CREATE" | "ADD_MEMBER";
  conversationId?: string;
  excludedIds?: string[];
  onSuccess?: () => void;
}

const CreateGroupModal: React.FC<Props> = ({
  visible,
  onClose,
  mode = "CREATE",
  conversationId,
  excludedIds = [],
  onSuccess,
}) => {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [searchText, setSearchText] = useState("");
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- 1. ĐỊNH NGHĨA BIẾN HELPER ---
  const isAddMode = mode === "ADD_MEMBER";

  // --- 2. FETCH DATA ---
  useEffect(() => {
    if (visible) {
      setLoading(true);
      userService
        .getFriends()
        .then((res: any) => {
          const groups = res?.users || [];
          const rawFriends = groups.flatMap((g: any) => g.friends || []);
          const cleanFriends = rawFriends.map((f: any) => ({
            id: f.friendId || f._id,
            name: f.name || f.profile?.name || "Người dùng",
            avatar: f.avatarUrl || f.profile?.avatarUrl || "",
          }));
          setFriends(cleanFriends);
          setLoading(false);
        })
        .catch(() => {
          setFriends([]);
          setLoading(false);
        });
    }
  }, [visible]);

  // --- 3. LOGIC LỌC ---
  const filteredFriends = useMemo(() => {
    if (!Array.isArray(friends)) return [];
    return friends.filter((f: any) => {
      const isNotExcluded = !excludedIds.includes(f.id);
      const matchesSearch = f.name
        .toLowerCase()
        .includes(searchText.toLowerCase());
      return isNotExcluded && matchesSearch;
    });
  }, [friends, searchText, excludedIds]);

  const toggleSelect = (item: any) => {
    const isSelected = selectedFriends.some((f) => f.id === item.id);
    if (isSelected) {
      setSelectedFriends((prev) => prev.filter((f) => f.id !== item.id));
    } else {
      setSelectedFriends((prev) => [...prev, item]);
    }
  };

  // --- 4. ACTION CHÍNH ---
  const handleAction = async () => {
    // Logic validate theo mode
    const minRequired = isAddMode ? 1 : 2;
    if (selectedFriends.length < minRequired) {
      return Alert.alert(
        "Thông báo",
        `Vui lòng chọn ít nhất ${minRequired} thành viên`,
      );
    }

    setSubmitting(true);
    try {
      if (isAddMode && conversationId) {
        // CHẾ ĐỘ THÊM TV
        const res: any = await conversationService.addMembers(
          conversationId,
          selectedFriends.map((f) => f.id),
        );
        if (res.success) {
          Alert.alert("Thành công", "Đã thêm thành viên vào nhóm");
          onSuccess?.();
          handleClose();
        }
      } else {
        // CHẾ ĐỘ TẠO NHÓM
        const res: any = await conversationService.createGroup({
          name: groupName.trim() || undefined,
          memberIds: selectedFriends.map((f) => f.id),
        });

        const newId =
          res?.data?.data?.conversation?._id || res?.data?.conversation?._id;
        if (newId) {
          handleClose();
          setTimeout(() => router.push(`/private/chat/${newId}`), 300);
        }
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể thực hiện thao tác");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setGroupName("");
    setSearchText("");
    setSelectedFriends([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 0, backgroundColor: "#0068ff" }} />
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Hủy</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {isAddMode ? "Thêm vào nhóm" : "Nhóm mới"}
            </Text>
            <Text style={styles.headerSubTitle}>
              Đã chọn: {selectedFriends.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleAction}
            disabled={
              submitting ||
              (isAddMode
                ? selectedFriends.length < 1
                : selectedFriends.length < 2)
            }
            style={[
              styles.headerBtn,
              {
                opacity: (
                  isAddMode
                    ? selectedFriends.length < 1
                    : selectedFriends.length < 2
                )
                  ? 0.5
                  : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.headerBtnText}>
                {isAddMode ? "Thêm" : "Tạo"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* TOP SECTION */}
        <View style={styles.topSection}>
          {!isAddMode && (
            <View style={styles.groupInputRow}>
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={20} color="#666" />
              </View>
              <TextInput
                style={styles.inputName}
                placeholder="Đặt tên nhóm (không bắt buộc)"
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>
          )}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên bạn bè"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        {/* SELECTED LIST */}
        {selectedFriends.length > 0 && (
          <View style={styles.selectedContainer}>
            <FlatList
              horizontal
              data={selectedFriends}
              keyExtractor={(item) => "sel-" + item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.selectedAvatarWrapper}>
                  <Image
                    source={{
                      uri: item.avatar || "https://via.placeholder.com/150",
                    }}
                    style={styles.selectedAvatar}
                  />
                  <TouchableOpacity
                    onPress={() => toggleSelect(item)}
                    style={styles.removeIcon}
                  >
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        )}

        {/* FRIENDS LIST */}
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#0068ff" />
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedFriends.some((f) => f.id === item.id);
              return (
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() => toggleSelect(item)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <Image
                    source={{
                      uri: item.avatar || "https://via.placeholder.com/150",
                    }}
                    style={styles.avatar}
                  />
                  <Text style={styles.friendName}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: {
    height: 56,
    backgroundColor: "#0068ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerBtn: { minWidth: 40 },
  headerBtnText: { color: "white", fontSize: 16, fontWeight: "500" },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  headerTitle: { color: "white", fontSize: 17, fontWeight: "bold" },
  headerSubTitle: { color: "white", fontSize: 12, opacity: 0.8 },
  topSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  groupInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cameraIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  inputName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  selectedContainer: {
    paddingVertical: 12,
    paddingLeft: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedAvatarWrapper: { marginRight: 15, position: "relative" },
  selectedAvatar: { width: 44, height: 44, borderRadius: 22 },
  removeIcon: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "white",
    borderRadius: 10,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: "#0068ff", borderColor: "#0068ff" },
  avatar: { width: 48, height: 48, borderRadius: 24, marginLeft: 16 },
  friendName: { marginLeft: 12, fontSize: 16 },
});

export default CreateGroupModal;
