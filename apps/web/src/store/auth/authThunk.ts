import { apiClient } from "./../../services/apiClient";
import type {
  ChangePassword,
  CompleteSignUp,
  OtpVerify,
  ResetPassword,
  UserLogin,
} from "@/constants/types";
import { authService } from "@/services/auth.service";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { store } from "..";
import { updateToken } from "./authSlice";

export const signIn = createAsyncThunk(
  "auth/signIn",
  async (userLogin: UserLogin, thunkAPI) => {
    try {
      const data = await authService.signIn(userLogin);

      return data;
    } catch (err: any) {
      console.log(err);
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

      apiClient.defaults.headers.common["Authorization"] =
        `Bearer ${data.accessToken}`;

      return data;
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

      apiClient.defaults.headers.common["Authorization"] =
        `Bearer ${data.accessToken}`;

      return data;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.post(
        "/api/auth/token/refresh",
        {},
        { withCredentials: true },
      );

      store.dispatch(updateToken(res.data.data.accessToken));

      const user = await authService.getMe();
      return {
        user,
      };
    } catch (err: any) {
      const errorData = err.response?.data || {
        message: "Lỗi hệ thống hoặc phiên hết hạn",
      };
      return thunkAPI.rejectWithValue(errorData);
    }
  },
);

export const logOut = createAsyncThunk("auth/logOut", async (_, thunkApi) => {
  try {
    const message = await authService.signOut();

    return message;
  } catch (err: any) {
    return thunkApi.rejectWithValue(err.response?.data);
  }
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
      return res;
    } catch (err: any) {
      console.log(err.response.data);
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const getSessions = createAsyncThunk(
  "auth/sessions",
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
  async (deviceId: string, thunkApi) => {
    try {
      const res = await authService.logOutDevice(deviceId);
      return res;
    } catch (err: any) {
      return thunkApi.rejectWithValue(err.response?.data);
    }
  },
);

export const logOutOther = createAsyncThunk(
  "auth/logout-others",
  async (_, thunkApi) => {
    try {
      const res = await authService.logOutDevices();
      return res;
    } catch (err: any) {
      return thunkApi.rejectWithValue(err.response?.data);
    }
  },
);

export const exchangeToken = createAsyncThunk(
  "auth/exchange-token",
  async (ticket: string, thunkApi) => {
    try {
      const res = await authService.exchangeToken(ticket);
      console.log(res);
      return res;
    } catch (err: any) {
      return thunkApi.rejectWithValue(err.response?.data);
    }
  },
);

export const requestUpdatePhone = createAsyncThunk(
  "auth/request-update-phone",
  async (phone: string, thunkAPI) => {
    try {
      const res = await authService.requestUpdatePhone(phone);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);

export const verifyUpdatePhone = createAsyncThunk(
  "auth/verify-update-phone",
  async (payload: { phone: string; otp: string }, thunkAPI) => {
    try {
      const res = await authService.verifyUpdatePhone(payload.phone, payload.otp);
      return res;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data);
    }
  },
);
