import React, { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ToastAndroid,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { scanQrLogin } from "@/store/auth/authThunk";
import { conversationService } from "@/services/conversation.service";
import GroupAvatar from "@/components/ui/GroupAvatar";
import { userService } from "@/services/user.service";

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [scannedId, setScannedId] = useState("");
  const [joinToken, setJoinToken] = useState("");

  const router = useRouter();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state: any) => state.auth.user?.userId || state.auth.user?._id);

  // 1. Kiểm tra quyền
  if (!permission) return <View style={{ flex: 1, backgroundColor: 'black' }} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: 'white', textAlign: 'center', marginBottom: 24, fontSize: 16 }}>
          Zalo cần quyền truy cập Camera để quét mã QR
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ backgroundColor: '#007AFF', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 100 }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
            Cấp quyền Camera
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);

    // --- CASE 1: THAM GIA NHÓM (zaloclone://group?id={id}&token={token}) ---
    if (data.startsWith("zaloclone://group")) {
      setLoading(true);
      try {
        const url = data.replace("zaloclone://group?", "");
        const params = new URLSearchParams(url);
        const id = params.get("id");
        const token = params.get("token");

        if (!id || !token) {
          throw new Error("Mã QR không hợp lệ");
        }

        const res: any = await conversationService.getGroupInfoByToken(id, token);
        
        console.log("[Mobile] DỮ LIỆU TỪ API QR:", JSON.stringify(res, null, 2));

        const info = res?.data?.data || res?.data || res;
      
        if (info) {
          setScannedId(id);
          setGroupInfo({
            conversationId: info.conversationId,
            name: info.name,
            avatarUrl: info.avatarUrl,
            memberCount: info.memberCount,
            approvalRequired: info.approvalRequired
          });
          setJoinToken(token);
          setShowModal(true);
        }
      } catch (error: any) {
        Alert.alert("Lỗi", error.response?.data?.message || "Mã QR nhóm không hợp lệ hoặc đã hết hạn");
        setScanned(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- CASE 2: TÌM KIẾM BẠN BÈ QUA SỐ ĐIỆN THOẠI ---
    const phoneRegex = /^[0-9]{10,11}$/;
    if (phoneRegex.test(data.trim())) {
      setLoading(true);
      try {
        const phoneFromQR = data.trim();
        const friendData = await userService.searchFriendByPhone(userId, phoneFromQR);
        if (!friendData) {
          ToastAndroid.show("Không tìm thấy người dùng", ToastAndroid.SHORT);
          setTimeout(() => setScanned(false), 2000);
          return;
        }

        router.replace({
          pathname: "/private/search-profile",
          params: {
            phone: phoneFromQR,
            friendId: friendData.friendId || "",
            name: friendData.name || "",
            avatarUrl: friendData.avatarUrl || "",
            status: friendData.status || "NONE",
          },
        });
      } catch (err: any) {
        ToastAndroid.show(
          err?.response?.data?.message || "Lỗi khi tìm kiếm người dùng",
          ToastAndroid.SHORT
        );
        setTimeout(() => setScanned(false), 2000);
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- CASE 3: ĐĂNG NHẬP WEB ---
    try {
      const rs = await dispatch(scanQrLogin(data)).unwrap();
      router.push({
        pathname: "/private/confirm-qr-login",
        params: { qrToken: data, device: JSON.stringify(rs.device) },
      });
    } catch (error: any) {
      ToastAndroid.show(
        error.response?.data?.message || "Mã QR không hợp lệ",
        ToastAndroid.LONG,
      );
      setScanned(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!scannedId || !joinToken) {
       Alert.alert("Lỗi", "Dữ liệu QR bị mất, vui lòng quét lại.");
       return;
    }
    setLoading(true);
    try {
      const res: any = await conversationService.joinViaQR(scannedId, joinToken);
      if (res.success) {
        setShowModal(false);
        if (res.isPending) {
           Alert.alert("Thông báo", "Yêu cầu tham gia đã được gửi. Vui lòng chờ quản trị viên duyệt.");
           router.back();
        } else {
           router.replace({
             pathname: "/private/chat",
             params: { id: scannedId }
           });
        }
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể tham gia nhóm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {/* Camera View */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Overlay UI */}
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 24 }}>
          {/* Top Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 24, zIndex: 10 }}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <FontAwesome5 name="user" size={14} color="white" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '500' }}>Mã QR của tôi</Text>
            </TouchableOpacity>

            <View style={{ width: 44 }} /> 
          </View>

          {/* Scanner Frame */}
          <View style={{ position: 'relative', width: 280, height: 280 }}>
            {/* Lớp phủ mờ bao quanh (Sử dụng cách vẽ truyền thống thay vì class mờ ảo) */}
            <View style={styles.scannerCornerTL} />
            <View style={styles.scannerCornerTR} />
            <View style={styles.scannerCornerBL} />
            <View style={styles.scannerCornerBR} />
            
            {loading && !showModal && (
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#0068ff" />
              </View>
            )}
          </View>

          {/* Bottom Text */}
          <View style={{ alignItems: 'center', paddingHorizontal: 40 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 14, marginBottom: 8, fontWeight: '500' }}>
              Quét mã QR để đăng nhập hoặc tham gia nhóm
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 12 }}>
              Mã QR phải nằm trong khung hình để được nhận diện
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Preview Group Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowModal(false);
          setScanned(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {groupInfo && (
              <View style={styles.modalContent}>
                {/* Avatar Nhóm */}
                <View style={styles.avatarWrapper}>
                  <GroupAvatar 
                    uri={groupInfo.avatarUrl} 
                    name={groupInfo.name || "Nhóm"} 
                    size={100} 
                  />
                </View>

                {/* Tên nhóm */}
                <Text style={styles.groupName} numberOfLines={2}>
                  {groupInfo.name || "Nhóm chưa đặt tên"}
                </Text>

                {/* Số lượng thành viên */}
                <Text style={styles.memberCount}>
                  {groupInfo.memberCount || 0} thành viên
                </Text>

                {/* Thông báo (Tùy theo Approval Required) */}
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color="#0068ff" />
                  <Text style={styles.infoText}>
                    {groupInfo.approvalRequired 
                      ? "Bạn cần được Trưởng/Phó nhóm phê duyệt để tham gia nhóm này."
                      : "Bạn sẽ tham gia nhóm ngay lập tức sau khi xác nhận."}
                  </Text>
                </View>

                {/* Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={() => {
                      setShowModal(false);
                      setScanned(false);
                    }}
                  >
                    <Text style={styles.cancelText}>Hủy</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.joinBtn, loading && { opacity: 0.7 }]} 
                    onPress={handleJoinGroup}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.joinText}>
                        {groupInfo.approvalRequired ? "Gửi yêu cầu" : "Tham gia nhóm"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scannerCornerTL: {
    position: 'absolute', top: 0, left: 0, width: 48, height: 48, 
    borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#0068ff', borderTopLeftRadius: 16 
  },
  scannerCornerTR: {
    position: 'absolute', top: 0, right: 0, width: 48, height: 48, 
    borderTopWidth: 4, borderRightWidth: 4, borderColor: '#0068ff', borderTopRightRadius: 16 
  },
  scannerCornerBL: {
    position: 'absolute', bottom: 0, left: 0, width: 48, height: 48, 
    borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#0068ff', borderBottomLeftRadius: 16 
  },
  scannerCornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: 48, height: 48, 
    borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#0068ff', borderBottomRightRadius: 16 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  modalContent: {
    padding: 30,
    alignItems: "center",
  },
  avatarWrapper: {
    marginBottom: 20,
    padding: 4,
    backgroundColor: "white",
    borderRadius: 100,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  groupName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  memberCount: {
    fontSize: 15,
    color: "#666",
    fontWeight: "500",
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#f0f7ff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 30,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#e0eefe",
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: "#0047b3",
    lineHeight: 18,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#f5f5f5",
    borderRadius: 14,
    alignItems: "center",
  },
  cancelText: { 
    color: "#4d4d4d", 
    fontWeight: "700", 
    fontSize: 16 
  },
  joinBtn: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: "#0068ff",
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#0068ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  joinText: { 
    color: "white", 
    fontWeight: "700", 
    fontSize: 16 
  },
});
