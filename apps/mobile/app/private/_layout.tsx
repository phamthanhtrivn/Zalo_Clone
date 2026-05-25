import { Stack } from "expo-router";
import { SocketProvider } from "@/contexts/SocketContext";
import { VideoCallProvider, useVideoCall } from "@/contexts/VideoCallContext";
import IncomingCallOverlay from "@/components/video-call/IncomingCallOverlay";
import OutgoingCallOverlay from "@/components/video-call/OutgoingCallOverlay";
import ActiveCallOverlay from "@/components/video-call/ActiveCallOverlay";

function CallOverlays() {
  const { callMode } = useVideoCall();

  if (callMode === 'NONE') return null;

  return (
    <>
      {callMode === 'DIRECT' && (
        <>
          <IncomingCallOverlay />
          <OutgoingCallOverlay />
        </>
      )}
      <ActiveCallOverlay />
    </>
  );
}

export default function PrivateLayout() {
  return (
    <SocketProvider>
      <VideoCallProvider>
        <CallOverlays />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat" />
          <Stack.Screen
            name="story-create"
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen name="story-viewer" />
          <Stack.Screen name="post-viewer" />
          <Stack.Screen
            name="social/create-post"
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="social/video-feed"
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              animation: "fade",
            }}
          />
          <Stack.Screen
            name="social/video-profile"
            options={{
              headerShown: false,
              presentation: "card",
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="social/video-upload"
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="social/video-publish"
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen name="social-notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="search" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="update-profile" />
          <Stack.Screen name="qr-scanner" />
          <Stack.Screen name="confirm-qr-login" />
        </Stack>

      </VideoCallProvider>
    </SocketProvider>
  );
}
