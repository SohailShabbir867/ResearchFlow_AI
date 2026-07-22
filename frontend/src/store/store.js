import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice.js";
import researchReducer from "./researchSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    research: researchReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
