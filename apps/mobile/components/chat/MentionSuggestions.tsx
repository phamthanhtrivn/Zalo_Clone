import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GroupAvatar from "../ui/GroupAvatar";

export interface Candidate {
  _id: string;
  name: string;
  avatarUrl: string;
  isAi: boolean;
}

interface MentionSuggestionsProps {
  visible: boolean;
  candidates: Candidate[];
  onSelect: (name: string) => void;
  onClose: () => void;
}

const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
  visible,
  candidates,
  onSelect,
  onClose,
}) => {
  if (!visible || candidates.length === 0) return null;

  return (
    <>
      {/* Tap outside overlay covering the screen area above the chat input */}
      <Pressable
        style={{
          position: "absolute",
          top: -1000,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          zIndex: 0,
        }}
        onPress={onClose}
      />

      <View className="bg-white border-t border-[#e5e7eb] max-h-[160px] w-full shadow-sm z-10">
        <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
          {candidates.map((c) => (
            <TouchableOpacity
              key={c._id}
              onPress={() => onSelect(c.name)}
              className="flex-row items-center px-4 py-3 border-b border-gray-50/50"
            >
              {c.isAi ? (
                <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Ionicons name="hardware-chip" size={18} color="#0068ff" />
                </View>
              ) : (
                <View className="mr-3">
                  <GroupAvatar uri={c.avatarUrl} name={c.name} size={32} />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-sm font-semibold text-black">{c.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
};

export default MentionSuggestions;
