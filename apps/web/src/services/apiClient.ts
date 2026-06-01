import axios from "axios";

function normalizeApiBaseUrl(url: string | undefined): string {
  if (!url) return "";
  const trimmed = url.replace(/\/$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

const API_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
import { store } from "@/store";
import { clearAuth, updateToken } from "@/store/auth/authSlice";
import { getDeviceId } from "@/utils/device.util";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },

});

// Dùng riêng cho refresh token
const refreshApi = axios.create({
  baseURL: `${API_URL}`,
  timeout: 10000,
  withCredentials: true,
});

refreshApi.interceptors.request.use((config) => {
  config.headers["x-device-id"] = getDeviceId();
  return config;
});

apiClient.interceptors.request.use((config) => {
  //gắn device id vào headers
  config.headers["x-device-id"] = getDeviceId();
  const state = store.getState();
  const token = state.auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // những api không cần check
    if (
      originalRequest?.url?.includes("/api/auth/sign-in") ||
      originalRequest?.url?.includes("/api/auth/sign-up") ||
      originalRequest?.url?.includes("/api/auth/qr-login/exchange")
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await refreshApi.post(
          "/api/auth/token/refresh",
          {},
          { withCredentials: true },
        );

        const newAccessToken = res.data.data.accessToken;

        store.dispatch(updateToken(newAccessToken));

        processQueue(null, newAccessToken);

        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        store.dispatch(clearAuth()); // Refresh lỗi thì xóa sạch data
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
