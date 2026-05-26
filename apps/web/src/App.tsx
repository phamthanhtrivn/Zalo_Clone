import { Provider } from "react-redux";
import { store, useAppDispatch } from "./store";
import { AppRouter } from "./routes";
import "./App.css";
import { ToastContainer } from "react-toastify";
import { SocketProvider } from "./contexts/SocketContext";
import { CallProvider } from "@/contexts/VideoCallContext";
import IncomingCall from "./components/video-call/IncomingCall";
import OutgoingCall from "./components/video-call/OutgoingCall";
import VideoCallOverlay from "./components/video-call/VideoCallOverlay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { restoreSession } from "./store/auth/authThunk";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

const Bootstrap = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const restoreAuth = async () => {
      await dispatch(restoreSession());

      setIsReady(true);
    };
    restoreAuth();
  }, [dispatch]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        Đang tải trang...
      </div>
    );
  }

  return <>{children}</>;
};

function App() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("/notification-sw.js").catch((error) => {
      console.error("Failed to register notification service worker:", error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Bootstrap>
          <SocketProvider>
            <CallProvider>
              <AppRouter />
              <IncomingCall />
              <OutgoingCall />
              <VideoCallOverlay />
            </CallProvider>
          </SocketProvider>
          <ToastContainer />
        </Bootstrap>
      </Provider>
    </QueryClientProvider>
  );
}

export default App;
