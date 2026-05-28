import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store, useAppDispatch, useAppSelector } from "@/store/store";
import { useEffect, useRef } from "react";
import { restoreSession } from "@/store/auth/authThunk";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";
import { Dimensions, Image, Text, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { handleNotificationTap } from "@/utils/notification.util";


const queryClient = new QueryClient();
const { width: screenWidth } = Dimensions.get("window");

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView>
            <BottomSheetModalProvider>
              <StatusBar style="dark" backgroundColor="#0068ff" translucent={false} />
              <AppNavigation />
              <Toast topOffset={56} />
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}

const AppNavigation = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  // Lắng nghe khi user tap vào notification → navigate đến conversation
  useEffect(() => {
    // Xử lý notification tap khi app đang ở background/foreground
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationTap(response);
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const isLoggedIn = !!user?.userId;
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      key={isLoggedIn ? "user" : "guest"}
    >
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="private" />
      </Stack.Protected>
    </Stack>
  );
};

