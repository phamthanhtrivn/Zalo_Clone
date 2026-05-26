import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { conversationService } from "@/services/conversation.service";
import { useAppSelector } from "@/store/store";

interface Props {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  conversationName: string;
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  initialJoinToken: string | null;
  onTokenRefreshed: (newToken: string) => void;
}

const ShareGroupQRModal: React.FC<Props> = ({
  visible,
  onClose,
  conversationId,
  conversationName,
  myRole: roleFromProp,
  initialJoinToken,
  onTokenRefreshed,
}) => {
  const [loading, setLoading] = useState(false);
  
  const conversation = useAppSelector((state) =>
    state.conversation.conversations.find((c) => c.conversationId === conversationId)
  );

  const token = conversation?.group?.joinToken || initialJoinToken;
  
  const myRole = roleFromProp || conversation?.myRole || "MEMBER";
  const isManager = myRole === "OWNER" || myRole === "ADMIN";

  // keep localToken in sync with incoming token
  const [localToken, setLocalToken] = useState<string | null>(token || null);
  const [attemptedAutoRefresh, setAttemptedAutoRefresh] = useState(false);

  const handleRefreshToken = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const res: any = await conversationService.refreshGroupJoinToken(conversationId);
      if (res.success) {
        onTokenRefreshed(res.joinToken);
        // also update local token immediately so the QR updates
        setLocalToken(res.joinToken);
      }
    } catch (error) {
      console.error("Refresh QR error (Mobile):", error);
      Alert.alert("Lỗi", "Không có quyền tạo mã QR (403 Forbidden)");
    } finally {
      setLoading(false);
    }
  }, [isManager, conversationId, onTokenRefreshed]);

  useEffect(() => {
    setLocalToken(token || null);

    if (visible && !token && isManager && !attemptedAutoRefresh) {
      setAttemptedAutoRefresh(true);
      handleRefreshToken();
    }
  }, [visible, token, isManager, handleRefreshToken, attemptedAutoRefresh]);


  const handleShare = async () => {
    if (!token) return;
    const qrValue = `zaloclone://group?id=${conversationId}&token=${token}`;
    try {
      await Share.share({
        message: `Tham gia nhóm ${conversationName} trên Zalo Clone: ${qrValue}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  if (!visible) return null;

  const qrValue = `zaloclone://group?id=${conversationId}&token=${localToken}`;
  // append timestamp to force reload when token changes
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    qrValue
  )}&_=${localToken || ""}`;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Mã QR của nhóm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.subTitle}>
              Quét mã QR này để tham gia nhóm{"\n"}
              <Text style={{ fontWeight: "bold", color: "#1a1a1a" }}>{conversationName}</Text>
            </Text>

            <View style={styles.qrWrapper}>
              {token ? (
                <Image
                  source={{ uri: qrImageUrl }}
                  style={[styles.qrImage, { transform: [{ rotate: "0deg" }] }]}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.loader}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#0068ff" />
                  ) : (
                    <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
                      <Ionicons name="alert-circle-outline" size={50} color="#ccc" />
                      <Text style={{ fontSize: 12, color: "#999", textAlign: "center", marginTop: 10 }}>
                        Mã QR chưa được khởi tạo. Vui lòng nhờ Trưởng/Phó nhóm tạo mã.
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {loading && token && (
                <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              )}
            </View>

            <View style={styles.actionRow}>
              {isManager && (
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={handleRefreshToken}
                  disabled={loading}
                >
                  <Ionicons name="refresh" size={20} color="#333" />
                  <Text style={styles.btnText}>Làm mới</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.shareBtn, !isManager && { flex: 1 }]}
                onPress={handleShare}
                disabled={!token || loading}
              >
                <Ionicons name="share-social" size={20} color="white" />
                <Text style={[styles.btnText, { color: "white" }]}>Chia sẻ</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
             <Ionicons name="information-circle-outline" size={16} color="#666" />
             <Text style={styles.footerText}>
               {isManager 
                 ? "Mã QR này giúp mọi người tham gia nhóm ngay lập tức. Bạn có thể làm mới mã bất cứ lúc nào." 
                 : "Chỉ Trưởng/Phó nhóm mới có quyền làm mới mã QR này."}
             </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 24,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  subTitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: "#f0f7ff",
    borderRadius: 20,
    marginBottom: 30,
    position: "relative",
  },
  qrImage: {
    width: 200,
    height: 200,
    backgroundColor: "white",
  },
  loader: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  refreshBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0068ff",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  footer: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
    lineHeight: 16,
  },
});

export default ShareGroupQRModal;
