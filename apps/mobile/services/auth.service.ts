import {
  ChangePassword,
  CompleteSignUp,
  OtpVerify,
  ResetPassword,
  UserLogin,
} from "@/constants/types";
import { api } from "./api";

export const authService = {
  signIn: async (payload: UserLogin) => {
    const res = await api.post("/auth/sign-in", payload);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get("/auth/profile");
    return res.data;
  },
  signOut: async (refreshToken: string) => {
    const res = await api.post("/auth/sign-out", { refreshToken });
    return res.data;
  },
  signUp: async (phone: string) => {
    const res = await api.post("/auth/sign-up", { phone });
    return res.data;
  },
  completeRegister: async (data: CompleteSignUp, tempToken: string) => {
    const res = await api.post("/auth/complete-sign-up", data, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    return res.data;
  },
  verifyOtp: async (payload: OtpVerify) => {
    const res = await api.post("/auth/otp/verify", payload);
    return res.data;
  },
  forgotPassWord: async (phone: string) => {
    const res = await api.post("/auth/forgot-password", { phone });
    return res.data;
  },
  resetPassword: async (payload: ResetPassword, tempToken: string) => {
    const res = await api.post("/auth/reset-password", payload, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    return res.data;
  },
  changePassword: async (payload: ChangePassword) => {
    const res = await api.post("/auth/change-password", payload);
    return res.data;
  },
  scanQrLogin: async (qrToken: string) => {
    const res = await api.post("/auth/qr-login/scan", {
      qrToken,
    });
    return res.data;
  },
  confirmQrLogin: async (qrToken: string) => {
    const res = await api.post("/auth/qr-login/confirm", {
      qrToken,
    });
    return res.data;
  },
  getSessions: async () => {
    const res = await api.get("/auth/sessions");
    return res.data;
  },
  logOutDevice: async (deviceId: string) => {
    const res = await api.post("/auth/logout-device", { deviceId });
    return res.data;
  },
  logOutOther: async () => {
    const res = await api.post("/auth/logout-others");
    return res.data;
  },
  requestUpdatePhone: async (phone: string) => {
    const res = await api.post("/auth/update-phone/request", { phone });
    return res.data;
  },
  verifyUpdatePhone: async (phone: string, otp: string) => {
    const res = await api.post("/auth/update-phone/verify", { phone, otp });
    return res.data;
  },
};
