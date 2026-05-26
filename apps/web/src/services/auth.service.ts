import type {
  ChangePassword,
  CompleteSignUp,
  OtpVerify,
  ResetPassword,
  UserLogin,
} from "@/constants/types";
import { apiClient } from "./apiClient";

export const authService = {
  signIn: async (payload: UserLogin) => {
    const res = await apiClient.post("/api/auth/sign-in", payload);
    return res.data.data;
  },
  getMe: async () => {
    const res = await apiClient.get("/api/auth/profile");
    return res.data.data;
  },
  signOut: async () => {
    const res = await apiClient.post("/api/auth/sign-out");
    return res.data.data;
  },
  signUp: async (phone: string) => {
    const res = await apiClient.post("/api/auth/sign-up", { phone });
    return res.data.data;
  },
  completeRegister: async (data: CompleteSignUp, tempToken: string) => {
    const res = await apiClient.post("/api/auth/complete-sign-up", data, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    return res.data.data;
  },
  verifyOtp: async (payload: OtpVerify) => {
    const res = await apiClient.post("/api/auth/otp/verify", payload);
    return res.data.data;
  },
  forgotPassWord: async (phone: string) => {
    const res = await apiClient.post("/api/auth/forgot-password", { phone });
    return res.data.data;
  },
  resetPassword: async (payload: ResetPassword, tempToken: string) => {
    const res = await apiClient.post("/api/auth/reset-password", payload, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    return res.data.data;
  },
  changePassword: async (payload: ChangePassword) => {
    const res = await apiClient.post("/api/auth/change-password", payload);
    return res.data.data;
  },
  getSessions: async () => {
    const res = await apiClient.get("/api/auth/sessions");
    return res.data.data;
  },
  logOutDevice: async (deviceId: string) => {
    const res = await apiClient.post("/api/auth/logout-device", { deviceId });
    return res.data.data;
  },
  logOutDevices: async () => {
    const res = await apiClient.post("/api/auth/logout-others");
    return res.data.data;
  },
  // qr-login/exchange
  exchangeToken: async (ticket: string) => {
    const res = await apiClient.post("/api/auth/qr-login/exchange", { ticket });
    return res.data.data;
  },
  requestUpdatePhone: async (phone: string) => {
    const res = await apiClient.post("/api/auth/update-phone/request", { phone });
    return res.data.data;
  },
  verifyUpdatePhone: async (phone: string, otp: string) => {
    const res = await apiClient.post("/api/auth/update-phone/verify", { phone, otp });
    return res.data.data;
  },
};
