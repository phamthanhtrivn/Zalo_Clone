import Container from "@/components/common/Container";
import Header from "@/components/common/Header";
import SearchIcon from "@/components/common/SearchIcon";
import SearchLabel from "@/components/common/SearchLabel";
import FriendsTab from "@/components/contact/FriendsTab";
import GroupsTab from "@/components/contact/GroupsTab";
import TabSwitcher from "@/components/contact/TabSwitcher";
import { scale } from "@/utils/responsive";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

export default function Contact() {
  const [activeTab, setActiveTab] = useState("friends");
  const router = useRouter();

  const handleOpenAddFriend = () => {
    router.push("/private/search-friends");
  };

  return (
    <Container>
      <Header
        gradient
        centerChild={<SearchLabel />}
        leftChild={<SearchIcon />}
        rightChild={
          <TouchableOpacity onPress={handleOpenAddFriend}>
            <Ionicons name="person-add-outline" size={scale(18)} color="white" />
          </TouchableOpacity>
        }
      />

      <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

      <View className="flex-1 bg-gray-100">
        {activeTab === "friends" && <FriendsTab />}
        {activeTab === "groups" && <GroupsTab />}
      </View>
    </Container>
  );
}