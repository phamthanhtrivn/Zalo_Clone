import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { config } from "@/constants/config";
import { getDeviceId } from "@/utils/device.util";

console.log(config.apiUrl);

export const api = axios.create({
  baseURL: `${config.apiUrl}/api`,
});

// dùng instance riêng để refresh (tránh loop)
const refreshApi = axios.create({
  baseURL: `${config.apiUrl}/api`,
});

api.interceptors.request.use(async (config) => {
  config.headers["x-device-id"] = await getDeviceId();

  // Không gắn Authorization cho sign-in và token/refresh
  if (!config.url?.includes("/auth/sign-in") && !config.url?.includes("/auth/token/refresh")) {
    const token = await SecureStore.getItemAsync("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest.headers?.Authorization &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/sign-in") &&
      !originalRequest.url?.includes("/auth/token/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = await SecureStore.getItemAsync("refresh_token");

      try {
        const res = await refreshApi.post("/auth/token/refresh", {
          refreshToken,
        });

        const responseData = res.data;
        const newAccessToken = responseData?.data?.accessToken;

        if (!newAccessToken) {
          throw new Error("Mã xác thực mới không hợp lệ");
        }

        await SecureStore.setItemAsync("access_token", String(newAccessToken));

        processQueue(null, newAccessToken);

        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");

        try {
          const { logout2 } = require("@/store/auth/authThunk");
          const { store } = require("@/store/store");
          store.dispatch(logout2());
        } catch (dispatchErr) {
          console.error("Failed to dispatch logout2 in Axios interceptor:", dispatchErr);
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);