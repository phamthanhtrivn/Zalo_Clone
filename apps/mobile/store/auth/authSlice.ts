import { createSlice } from "@reduxjs/toolkit";
import {
  changePassword,
  completeSignUp,
  logOut,
  logout2,
  resetPassword,
  restoreSession,
  scanQrLogin,
  signIn,
  verifyOtp,
} from "./authThunk";
import { AuthUser } from "@/constants/types";

interface AuthSliceState {
  error: any;
  loading: boolean;
  user: AuthUser | null;
  tmp_token: string;
}

const initialState = {
  error: {},
  loading: false,
  user: null,
  tmp_token: "",
} as AuthSliceState;

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth(state) {
      state.error = {};
      state.user = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = {};
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(restoreSession.pending, (state) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = {};
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
      })
      .addCase(logOut.pending, (state) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(logOut.fulfilled, (state) => {
        state.loading = false;
        state.error = {};
        state.user = null;
      })
      .addCase(logOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(completeSignUp.pending, (state, action) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(completeSignUp.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = {};
      })
      .addCase(completeSignUp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(verifyOtp.pending, (state, action) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.tmp_token = action.payload.tmp_token;
        state.loading = false;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
      .addCase(resetPassword.pending, (state, action) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
      .addCase(changePassword.pending, (state, action) => {
        state.loading = true;
        state.error = {};
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.loading = false;
        state.user = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
      .addCase(logout2.fulfilled, (state) => {
        state.user = null;
      })
      .addCase(scanQrLogin.pending, (state) => {
        state.loading = true;
      })
      .addCase(scanQrLogin.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(scanQrLogin.rejected, (state) => {
        state.loading = false;
      });
  },
});

const { reducer } = authSlice;
export default reducer;
