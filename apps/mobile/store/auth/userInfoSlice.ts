import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { userService } from "../../services/user.service";

interface UserState {
  userInfo: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  userInfo: null,
  loading: false,
  error: null,
};

export const fetchUserById = createAsyncThunk(
  "user/fetchUserById",
  async (userId: string, thunkAPI) => {
    try {
      const res = await userService.getProfile(userId);
      return res;
    } catch (err: any) {
      console.error("Error fetching user by ID:", err);
      return thunkAPI.rejectWithValue(err.response?.data || err.message);
    }
  },
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserInfo: (state, action: PayloadAction<any>) => {
      state.userInfo = action.payload;
    },
    updateUserProfile: (state, action: PayloadAction<any>) => {
      if (state.userInfo) {
        state.userInfo.profile = {
          ...state.userInfo.profile,
          ...action.payload,
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.userInfo = action.payload;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setUserInfo, updateUserProfile } = userSlice.actions;
export default userSlice.reducer;
