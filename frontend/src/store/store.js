import { configureStore } from "@reduxjs/toolkit";
import researchReducer from "./researchSlice.js";

export const store = configureStore({
  reducer: {
    research: researchReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});
