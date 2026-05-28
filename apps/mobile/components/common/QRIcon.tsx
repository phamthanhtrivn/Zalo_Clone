import { TouchableOpacity } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { scale } from "@/utils/responsive";
import { useRouter } from "expo-router";

export default function QRIcon() {
  const router = useRouter();

  const onClick = () => {
    router.push("/private/qr-scanner");
  };
  return (
    <TouchableOpacity onPress={onClick}>
      <MaterialCommunityIcons
        name="qrcode-scan"
        size={scale(20)}
        color="white"
      />
    </TouchableOpacity>
  );
}
