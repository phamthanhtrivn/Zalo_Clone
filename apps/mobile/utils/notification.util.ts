import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";

// Cấu hình cách hiển thị notification khi app đang foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Foreground: dùng Toast thay vì alert
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

/**
 * Xin quyền và tạo Android notification channel
 * Gọi một lần khi app khởi động
 */
export const setupNotifications = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notification] Permission not granted");
      return false;
    }

    // Tạo Android notification channel chuyên cho tin nhắn
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Tin nhắn",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0068ff",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    return true;
  } catch (error) {
    console.error("[Notification] Setup error:", error);
    return false;
  }
};

/**
 * Hiển thị local notification ngay lập tức (dùng khi app ở background)
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data?: { conversationId?: string; avatar?: string }
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: "default",
        badge: 1,
        ...(Platform.OS === "android" && {
          color: "#0068ff",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        }),
      },
      trigger: null, // Hiển thị ngay lập tức
    });
  } catch (error) {
    console.error("[Notification] Schedule error:", error);
  }
};

/**
 * Xử lý khi người dùng tap vào notification → navigate đến conversation
 */
export const handleNotificationTap = (
  response: Notifications.NotificationResponse
): void => {
  const data = response.notification.request.content.data as {
    conversationId?: string;
  };

  if (data?.conversationId) {
    router.push({
      pathname: "/private/chat/[id]",
      params: { id: data.conversationId },
    });
  }
};
