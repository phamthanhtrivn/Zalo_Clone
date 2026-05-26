import { io, Socket } from "socket.io-client";
import { getDeviceId } from "@/utils/device.util";

let authSocket: Socket | null = null;

export const connectAuthSocket = () => {
  if (authSocket) return authSocket;

  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  authSocket = io(`${apiUrl}/auth`);

  return authSocket;
};

export const requestQrCode = () => {
  const socket = connectAuthSocket();

  socket.emit("request_qr_code", {
    deviceId: getDeviceId(),
  });
};

export const onQrGenerated = (cb: (qrToken: string) => void) => {
  authSocket?.on("qr_code_generated", (data) => {
    cb(data.qrToken);
  });
};

export const onQrScanned = (cb: (user: any) => void) => {
  authSocket?.on("qr_scanned", (data) => {
    cb(data.user);
  });
};

export const onQrLoginSuccess = (cb: (ticket: string) => void) => {
  authSocket?.on("qr_login_success", (data) => {
    cb(data.ticket);
  });
};
