import { Pressable, Text, View } from "react-native";

export default function FeedTopTabs({ activeTab, onChange }: any) {
  return (
    <View className="flex-row bg-white px-4">
      {[
        { key: "diary", label: "Nhật ký" },
        { key: "video", label: "Zalo Video" },
      ].map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className="flex-1 items-center py-2"
          >
            <Text className={`text-sm ${active ? "font-semibold text-[#111827]" : "text-[#9ca3af]"}`}>
              {tab.label}
            </Text>
            <View className={`mt-3 h-[2.5px] w-[62%] rounded-full ${active ? "bg-[#111827]" : "bg-transparent"}`} />
          </Pressable>
        );
      })}
    </View>
  );
}
