import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GroupAvatar from "./GroupAvatar";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Member {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  member: Member | null;
  userRole: string; // "OWNER", "ADMIN", "MEMBER"
  onViewProfile: (userId: string) => void;
  onChat: (userId: string) => void;
  onPromoteAdmin?: (userId: string, isPromote: boolean) => void;
  onTransferOwner?: (userId: string) => void;
  onRemove?: (userId: string) => void;
}

const MemberActionSheet: React.FC<Props> = ({
  visible,
  onClose,
  member,
  userRole,
  onViewProfile,
  onChat,
  onPromoteAdmin,
  onTransferOwner,
  onRemove,
}) => {
  const insets = useSafeAreaInsets();
  if (!member) return null;

  const isOwner = userRole === "OWNER";
  const isAdmin = userRole === "ADMIN";
  const targetIsOwner = member.role === "OWNER";
  const targetIsAdmin = member.role === "ADMIN";

  const actions = [
    {
      label: "Xem trang cá nhân",
      icon: "person-outline" as const,
      onPress: () => onViewProfile(member.userId),
    },
    {
      label: "Nhắn tin riêng",
      icon: "chatbubble-outline" as const,
      onPress: () => onChat(member.userId),
    },
  ];

  if (isOwner && !targetIsOwner) {
    actions.push({
      label: targetIsAdmin ? "Gỡ phó nhóm" : "Bổ nhiệm phó nhóm",
      icon: targetIsAdmin ? ("shield-outline" as const) : ("shield-checkmark-outline" as const),
      onPress: () => onPromoteAdmin?.(member.userId, !targetIsAdmin),
    });
    actions.push({
      label: "Chuyển quyền trưởng nhóm",
      icon: "swap-horizontal-outline" as const,
      onPress: () => onTransferOwner?.(member.userId),
    });
  }

  if ((isOwner && !targetIsOwner) || (isAdmin && member.role === "MEMBER")) {
    actions.push({
      label: "Mời ra khỏi nhóm",
      icon: "log-out-outline" as const,
      onPress: () => onRemove?.(member.userId),
      isDestructive: true,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
              <View style={styles.header}>
                <GroupAvatar
                  uri={member.avatarUrl}
                  name={member.name}
                  size={48}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>
                    {member.role === "OWNER"
                      ? "Trưởng nhóm"
                      : member.role === "ADMIN"
                        ? "Phó nhóm"
                        : "Thành viên"}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.actionsList}>
                {actions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.actionItem}
                    onPress={() => {
                      onClose();
                      setTimeout(() => action.onPress(), 100);
                    }}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        action.isDestructive && styles.destructiveIconContainer,
                      ]}
                    >
                      <Ionicons
                        name={action.icon}
                        size={20}
                        color={action.isDestructive ? "#ef4444" : "#4b5563"}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionLabel,
                        action.isDestructive && styles.destructiveLabel,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e5e7eb",
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  memberRole: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  actionsList: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  destructiveIconContainer: {
    backgroundColor: "#fee2e2",
  },
  actionLabel: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  destructiveLabel: {
    color: "#ef4444",
  },
});

export default MemberActionSheet;
