import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import type { ConversationItemType } from "@/types/conversation-item.type";
import GroupAvatar from "../ui/GroupAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
  conversations: ConversationItemType[];
  selectedMessageIds: string[];
  onSubmit: (conversationIds: string[]) => void;
  loadingForward: boolean;
}

const ForwardModal: React.FC<Props> = ({
  visible,
  onClose,
  conversations,
  selectedMessageIds,
  onSubmit,
  loadingForward,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedConversations, setSelectedConversations] = useState<string[]>(
    [],
  );
  const [search, setSearch] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedConversations((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleClose = () => {
    setSelectedConversations([]);
    setSearch("");
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={handleClose}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "75%",
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
              <Text style={{ fontSize: 16, fontWeight: "600" }}>Chia sẻ</Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={{ fontSize: 20, color: "#6b7280" }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Tìm kiếm..."
                placeholderTextColor="#9ca3af"
                style={{
                  backgroundColor: "#f3f4f6",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: "#111",
                }}
              />
            </View>

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.conversationId}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const isSelected = selectedConversations.includes(
                  item.conversationId,
                );
                return (
                  <TouchableOpacity
                    onPress={() => toggleSelect(item.conversationId)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      gap: 14,
                    }}
                  >
                    {/* Checkbox */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected ? "#0068ff" : "#d1d5db",
                        backgroundColor: isSelected ? "#0068ff" : "white",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <Text style={{ color: "white", fontSize: 12 }}>✓</Text>
                      )}
                    </View>

                    {/* Avatar */}
                    <GroupAvatar
                      uri={item.avatar}
                      name={item.name}
                      size={42}
                    />

                    <Text
                      style={{ fontSize: 14, color: "#111", flex: 1 }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Footer */}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: "#f3f4f6",
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 16 + insets.bottom,
              }}
            >
              <Text
                style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}
              >
                Chia sẻ{" "}
                <Text style={{ fontWeight: "700", color: "#0068ff" }}>
                  {selectedMessageIds.length}
                </Text>{" "}
                tin nhắn tới{" "}
                <Text style={{ fontWeight: "700", color: "#0068ff" }}>
                  {selectedConversations.length}
                </Text>{" "}
                cuộc hội thoại
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: "#f3f4f6",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#374151" }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSubmit(selectedConversations)}
                  disabled={
                    selectedConversations.length === 0 || loadingForward
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor:
                      selectedConversations.length === 0 || loadingForward
                        ? "#93c5fd"
                        : "#0068ff",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, color: "white", fontWeight: "600" }}
                  >
                    {loadingForward ? "Đang gửi..." : "Chia sẻ"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ForwardModal;
