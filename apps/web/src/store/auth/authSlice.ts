import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  changePassword,
  completeSignUp,
  exchangeToken,
  getSessions,
  logOut,
  logOutDevice,
  resetPassword,
  restoreSession,
  signIn,
  verifyOtp,
} from "./authThunk";

import type { AuthUser } from "@/constants/types";

interface AuthSliceState {
  loading: boolean;
  user: AuthUser | null;
  tmp_token: string;
  accessToken: string;
}

const initialState = {
  loading: false,
  user: null,
  tmp_token: "",
  accessToken: "",
} as AuthSliceState;

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth(state) {
      state.user = null;
      state.accessToken = "";
      state.loading = false;
    },
    updateToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    setAuth(state, action) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(signIn.rejected, (state) => {
        state.loading = false;
      })
      .addCase(restoreSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload?.user;
        console.log(state.user);
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
      })
      .addCase(logOut.pending, (state) => {
        state.loading = true;
      })
      .addCase(logOut.fulfilled, (state) => {
        state.loading = false;
        state.accessToken = "";
        state.user = null;
      })
      .addCase(logOut.rejected, (state) => {
        state.loading = false;
      })
      .addCase(completeSignUp.pending, (state) => {
        state.loading = true;
      })
      .addCase(completeSignUp.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(completeSignUp.rejected, (state) => {
        state.loading = false;
      })
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.tmp_token = action.payload.tmp_token;
        state.loading = false;
      })
      .addCase(verifyOtp.rejected, (state) => {
        state.loading = false;
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(resetPassword.rejected, (state) => {
        state.loading = false;
      })
      .addCase(changePassword.pending, (state) => {
        state.loading = true;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(changePassword.rejected, (state) => {
        state.loading = false;
      })
      .addCase(getSessions.pending, (state) => {
        state.loading = true;
      })
      .addCase(getSessions.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(getSessions.rejected, (state) => {
        state.loading = false;
      })
      .addCase(logOutDevice.pending, (state) => {
        state.loading = true;
      })
      .addCase(logOutDevice.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(logOutDevice.rejected, (state) => {
        state.loading = false;
      })
      .addCase(exchangeToken.pending, (state) => {
        state.loading = true;
      })
      .addCase(exchangeToken.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(exchangeToken.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { updateToken, clearAuth, setAuth } = authSlice.actions;
const { reducer } = authSlice;
export default reducer;
