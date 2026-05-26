import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store, useAppDispatch, useAppSelector } from "@/store/store";
import { useEffect } from "react";
import { restoreSession } from "@/store/auth/authThunk";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";
import { Dimensions, Image, Text, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
const { width: screenWidth } = Dimensions.get("window");
const incomingToastWidth = Math.min(screenWidth - 24, 420);

const toastConfig = {
  incomingMessage: ({
    text1,
    text2,
    props,
  }: {
    text1?: string;
    text2?: string;
    props?: { avatar?: string | null };
  }) => (
    <View
      style={{
        width: incomingToastWidth,
        minHeight: 108,
        borderRadius: 24,
        backgroundColor: "white",
        paddingHorizontal: 20,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#0f172a",
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
        borderLeftWidth: 4,
        borderLeftColor: "#7c3aed",
      }}
    >
      {props?.avatar ? (
        <Image
          source={{ uri: props.avatar }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            marginRight: 16,
            backgroundColor: "#e5e7eb",
          }}
        />
      ) : (
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            marginRight: 16,
            backgroundColor: "#dbeafe",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 26 }}>💬</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          {text1}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 6,
            fontSize: 17,
            lineHeight: 24,
            color: "#475569",
          }}
        >
          {text2}
        </Text>
      </View>
    </View>
  ),
};

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView>
            <BottomSheetModalProvider>
              <StatusBar style="dark" />
              <AppNavigation />
              <Toast config={toastConfig} topOffset={56} />
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

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

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
