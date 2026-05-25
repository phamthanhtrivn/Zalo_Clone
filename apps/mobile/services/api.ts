import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { config } from "@/constants/config";
import { getDeviceId } from "@/utils/device.util";

console.log(config.apiUrl);

export const api = axios.create({
  baseURL: `${config.apiUrl}/api`,
  timeout: 20000,
});

// dùng instance riêng để refresh (tránh loop)
const refreshApi = axios.create({
  baseURL: `${config.apiUrl}/api`,
});

api.interceptors.request.use(async (config) => {
  config.headers["x-device-id"] = await getDeviceId();
  const token = await SecureStore.getItemAsync("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest.headers?.Authorization &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

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

        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
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
      }
    }

    return Promise.reject(error);
  },
);