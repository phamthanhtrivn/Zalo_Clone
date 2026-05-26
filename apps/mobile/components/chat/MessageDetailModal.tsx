import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GroupAvatar from "../ui/GroupAvatar";
import type { MessagesType } from "@/types/messages.type";

interface Props {
  visible: boolean;
  onClose: () => void;
  message: MessagesType | null;
}

const MessageDetailModal: React.FC<Props> = ({ visible, onClose, message }) => {
  const insets = useSafeAreaInsets();
  if (!message) return null;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "white",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "60%",
            paddingBottom: 16 + insets.bottom,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
              Thông tin tin nhắn
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 20, color: "#6b7280" }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Read receipts */}
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 12, color: "#374151" }}>
              Đã xem ({message.readReceipts?.length || 0})
            </Text>

            {(!message.readReceipts || message.readReceipts.length === 0) ? (
              <Text style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 16 }}>
                Chưa có ai xem tin nhắn này
              </Text>
            ) : (
              <FlatList
                data={message.readReceipts?.filter(
                  (item: any) =>
                    !!(
                      item?.userId?.profile?.avatarUrl ||
                      item?.userId?.avatarUrl
                    ),
                )}
                keyExtractor={(_, i) => i.toString()}
                numColumns={4}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <GroupAvatar
                      uri={
                        item.userId?.profile?.avatarUrl ||
                        item.userId?.avatarUrl ||
                        ""
                      }
                      name={item.userId?.profile?.name || item.userId?.name || "U"}
                      size={46}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 11, color: "#374151", textAlign: "center", width: 60 }}
                    >
                      {item.userId?.profile?.name || item.userId?.name}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default MessageDetailModal;
