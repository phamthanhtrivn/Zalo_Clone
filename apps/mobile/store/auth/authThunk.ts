import {
  ChangePassword,
  CompleteSignUp,
  OtpVerify,
  ResetPassword,
  UserLogin,
} from "@/constants/types";
import { api } from "@/services/api";
import { authService } from "@/services/auth.service";
import { createAsyncThunk } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";

export const signIn = createAsyncThunk(
  "auth/signIn",
  async (userLogin: UserLogin, thunkAPI) => {
    try {
      const data = await authService.signIn(userLogin);
      await SecureStore.setItemAsync("refresh_token", data.refreshToken);
      await SecureStore.setItemAsync("access_token", data.accessToken);

      api.defaults.headers.common["Authorization"] =
        `Bearer ${data.accessToken}`;

      return data.user;
    } catch (err: any) {
      if (!err.response) {
        return thunkAPI.rejectWithValue({
          message: "Không thể kết nối đến máy chủ!",
        });
      }
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const signUp = createAsyncThunk(
  "auth/signUp",
  async (phone: string, thunkAPI) => {
    try {
      const res = await authService.signUp(phone);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const forgotPassword = createAsyncThunk(
  "auth/forgot-password",
  async (phone: string, thunkAPI) => {
    try {
      const res = await authService.forgotPassWord(phone);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const resetPassword = createAsyncThunk(
  "auth/reset-password",
  async (payload: { data: ResetPassword; tempToken: string }, thunkAPI) => {
    try {
      const data = await authService.resetPassword(
        payload.data,
        payload.tempToken,
      );
      await SecureStore.setItemAsync("refresh_token", data.refreshToken);
      await SecureStore.setItemAsync("access_token", data.accessToken);

      api.defaults.headers.common["Authorization"] =
        `Bearer ${data.accessToken}`;

      return data.user;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const completeSignUp = createAsyncThunk(
  "auth/complete-sign-up",
  async (payload: { data: CompleteSignUp; tempToken: string }, thunkAPI) => {
    try {
      const data = await authService.completeRegister(
        payload.data,
        payload.tempToken,
      );

      await SecureStore.setItemAsync("refresh_token", data.refreshToken);
      await SecureStore.setItemAsync("access_token", data.accessToken);

      api.defaults.headers.common["Authorization"] =
        `Bearer ${data.accessToken}`;

      return data.user;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, thunkAPI) => {
    try {
      const token = await SecureStore.getItemAsync("access_token");

      if (!token) return null;

      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const user = await authService.getMe();

      return user;
    } catch {
      await SecureStore.deleteItemAsync("access_token");
      await SecureStore.deleteItemAsync("refresh_token");
      return null;
    }
  },
);

export const logOut = createAsyncThunk("auth/logOut", async (_, thunkApi) => {
  try {
    const refreshToken = await SecureStore.getItemAsync("refresh_token");

    if (!refreshToken) {
      throw new Error();
    }

    const message = await authService.signOut(refreshToken);

    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");

    return message;
  } catch (err: any) {
    return thunkApi.rejectWithValue(err.response?.data);
  }
});

//cưỡng chế
export const logout2 = createAsyncThunk("auth/logout", async () => {
  await SecureStore.deleteItemAsync("access_token");
  await SecureStore.deleteItemAsync("refresh_token");
});

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async (payload: OtpVerify, thunkAPI) => {
    try {
      const res = await authService.verifyOtp(payload);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const changePassword = createAsyncThunk(
  "auth/change-password",
  async (payload: ChangePassword, thunkAPI) => {
    try {
      const res = await authService.changePassword(payload);

      await SecureStore.deleteItemAsync("access_token");
      await SecureStore.deleteItemAsync("refresh_token");

      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const scanQrLogin = createAsyncThunk(
  "auth/scan-login-qr",
  async (qrToken: string, thunkAPI) => {
    try {
      const res = await authService.scanQrLogin(qrToken);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const confirmLogin = createAsyncThunk(
  "auth/confirm-login-qr",
  async (qrToken: string, thunkAPI) => {
    try {
      const res = await authService.confirmQrLogin(qrToken);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const getSessions = createAsyncThunk(
  "auth/get-sessions",
  async (_, thunkAPI) => {
    try {
      const res = await authService.getSessions();
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const logOutDevice = createAsyncThunk(
  "auth/logout-device",
  async (deviceId: string, thunkAPI) => {
    try {
      const res = await authService.logOutDevice(deviceId);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const logOutOther = createAsyncThunk(
  "auth/logout-other",
  async (_, thunkAPI) => {
    try {
      const res = await authService.logOutOther();
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);