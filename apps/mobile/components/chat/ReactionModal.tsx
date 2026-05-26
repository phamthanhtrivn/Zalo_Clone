import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
} from "react-native";
import { EMOJI_MAP, type EmojiType } from "@/constants/emoji.constant";
import type { ReactionType } from "@/types/messages.type";
import GroupAvatar from "../ui/GroupAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
  reactions: ReactionType[];
}

const ReactionModal: React.FC<Props> = ({ visible, onClose, reactions }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"all" | EmojiType>("all");

  const { emojiCounts, totalReactions } = useMemo(() => {
    const counts = {} as Record<EmojiType, number>;
    let total = 0;
    reactions.forEach((r) => {
      r.emoji.forEach((e) => {
        const name = e.name as EmojiType;
        counts[name] = (counts[name] || 0) + e.quantity;
        total += e.quantity;
      });
    });
    return { emojiCounts: counts, totalReactions: total };
  }, [reactions]);

  const sortedEmojiCounts = Object.entries(emojiCounts).sort(
    (a, b) => b[1] - a[1]
  );

  const filteredReactions = useMemo(() => {
    return activeTab === "all"
      ? reactions
      : reactions.filter((r) => r.emoji.some((e) => e.name === activeTab));
  }, [reactions, activeTab]);

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
            maxHeight: "70%",
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
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#111" }}>
              Biểu cảm
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 20, color: "#6b7280" }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab row */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 16,
              paddingVertical: 8,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab("all")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: activeTab === "all" ? "#0068ff" : "#f3f4f6",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: activeTab === "all" ? "white" : "#374151",
                }}
              >
                Tất cả {totalReactions}
              </Text>
            </TouchableOpacity>

            {sortedEmojiCounts.map(([emoji, count]) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => setActiveTab(emoji as EmojiType)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor:
                    activeTab === emoji ? "#0068ff" : "#f3f4f6",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 16 }}>
                  {EMOJI_MAP[emoji as EmojiType]}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: activeTab === emoji ? "white" : "#374151",
                  }}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          <FlatList
            data={filteredReactions}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 8 + insets.bottom
            }}
            renderItem={({ item }) => {
              const emojisToShow =
                activeTab === "all"
                  ? item.emoji
                  : item.emoji.filter((e) => e.name === activeTab);

              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {/* Avatar */}
                    <GroupAvatar
                      uri={item.userId.profile?.avatarUrl}
                      name={item.userId.profile?.name || "Người dùng"}
                      size={42}
                    />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#111" }}>
                      {item.userId.profile?.name}
                    </Text>
                  </View>

                  {/* Emojis */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {emojisToShow.map((e, j) => (
                      <Text key={j} style={{ fontSize: 20 }}>
                        {EMOJI_MAP[e.name as EmojiType] || e.name}
                      </Text>
                    ))}
                    {activeTab === "all" && (
                      <Text style={{ fontSize: 12, color: "#6b7280" }}>
                        {item.emoji.reduce((acc, e) => acc + e.quantity, 0)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default ReactionModal;
